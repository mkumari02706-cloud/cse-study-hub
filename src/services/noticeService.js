const path = require('path');
const fs = require('fs');
const { UniversityNotice, AcademicEvent } = require('../models');
const aiService = require('./aiService');

/**
 * Notice & Academic Event Service
 */
class NoticeService {
  /**
   * Extracts notice details from uploaded file (PDF/Image), pasted text, or manual inputs
   */
  async extractNotice({ file = null, text = '', manualData = null }) {
    if (manualData && typeof manualData === 'object') {
      return {
        success: true,
        extracted: {
          universityName: manualData.universityName || 'University',
          semester: parseInt(manualData.semester, 10) || 3,
          noticeType: manualData.noticeType || 'Exam Timetable',
          noticeDate: manualData.noticeDate || new Date().toISOString().slice(0, 10),
          title: manualData.title || `${manualData.universityName || 'University'} Academic Notice`,
          examinationDates: manualData.examinationDates || { start: manualData.examStart || null, end: manualData.examEnd || null },
          timetable: Array.isArray(manualData.timetable) ? manualData.timetable : [],
          practicalDates: Array.isArray(manualData.practicalDates) ? manualData.practicalDates : [],
          internalDates: Array.isArray(manualData.internalDates) ? manualData.internalDates : [],
          assignmentDeadlines: Array.isArray(manualData.assignmentDeadlines) ? manualData.assignmentDeadlines : [],
          holidays: Array.isArray(manualData.holidays) ? manualData.holidays : [],
          registrationDeadlines: Array.isArray(manualData.registrationDeadlines) ? manualData.registrationDeadlines : [],
          resultAnnouncements: Array.isArray(manualData.resultAnnouncements) ? manualData.resultAnnouncements : [],
          academicDeadlines: Array.isArray(manualData.academicDeadlines) ? manualData.academicDeadlines : []
        },
        rawText: text || 'Manual Entry'
      };
    }

    let buffer = null;
    let mimeType = 'text/plain';
    let filename = '';

    if (file) {
      if (file.path && fs.existsSync(file.path)) {
        buffer = fs.readFileSync(file.path);
        filename = file.originalname;
        mimeType = file.mimetype;
      } else if (file.buffer) {
        buffer = file.buffer;
        filename = file.originalname || 'uploaded_notice';
        mimeType = file.mimetype || 'application/pdf';
      }
    }

    const analysis = await aiService.analyzeNoticeDocument({
      text,
      buffer,
      mimeType,
      filename
    });

    return {
      success: true,
      extracted: analysis.extracted,
      rawText: analysis.rawText
    };
  }

  /**
   * Confirms and persists the extracted notice and generates AcademicEvents
   */
  async confirmAndSaveNotice(noticePayload, studentId = 'default_student') {
    const {
      title,
      universityName,
      semester,
      noticeType,
      noticeDate,
      examinationDates,
      timetable = [],
      practicalDates = [],
      internalDates = [],
      assignmentDeadlines = [],
      holidays = [],
      registrationDeadlines = [],
      resultAnnouncements = [],
      academicDeadlines = [],
      rawText = '',
      fileUrl = null,
      fileName = null,
      fileType = 'text'
    } = noticePayload;

    // Check duplicate by title and noticeDate
    const existing = await UniversityNotice.findOne({
      studentId,
      title: title.trim(),
      noticeDate: noticeDate || new Date().toISOString().slice(0, 10)
    });

    const noticeDoc = existing || new UniversityNotice({
      studentId,
      title: title.trim(),
      universityName: universityName || 'University',
      semester: parseInt(semester, 10) || 3,
      noticeType: noticeType || 'Exam Timetable',
      noticeDate: noticeDate || new Date().toISOString().slice(0, 10),
      fileUrl,
      fileName,
      fileType,
      rawText,
      extractedData: {
        universityName,
        semester: parseInt(semester, 10) || 3,
        examinationDates,
        timetable,
        practicalDates,
        internalDates,
        assignmentDeadlines,
        holidays,
        registrationDeadlines,
        resultAnnouncements,
        academicDeadlines
      },
      confirmed: true,
      confirmedAt: new Date().toISOString()
    });

    if (existing) {
      noticeDoc.extractedData = {
        universityName,
        semester: parseInt(semester, 10) || 3,
        examinationDates,
        timetable,
        practicalDates,
        internalDates,
        assignmentDeadlines,
        holidays,
        registrationDeadlines,
        resultAnnouncements,
        academicDeadlines
      };
      noticeDoc.confirmed = true;
      noticeDoc.confirmedAt = new Date().toISOString();
    }

    await noticeDoc.save();

    // Remove existing events for this notice to prevent duplicates upon re-save
    await AcademicEvent.deleteMany({ noticeId: noticeDoc._id });

    const createdEvents = [];

    // 1. Create Timetable Exam Events
    if (Array.isArray(timetable)) {
      for (const item of timetable) {
        if (item.date) {
          const ev = await AcademicEvent.create({
            studentId,
            noticeId: noticeDoc._id,
            title: `${item.subjectName || 'Exam'} (${item.subjectCode || 'Theory'})`,
            eventType: 'Examination',
            subjectName: item.subjectName,
            subjectCode: item.subjectCode,
            date: item.date,
            time: item.time || '10:00 AM - 01:00 PM',
            semester: parseInt(semester, 10) || 3,
            description: `University Examination in ${item.room || 'Main Hall'}`
          });
          createdEvents.push(ev);
        }
      }
    }

    // 2. Create Practical Events
    if (Array.isArray(practicalDates)) {
      for (const item of practicalDates) {
        if (item.date) {
          const ev = await AcademicEvent.create({
            studentId,
            noticeId: noticeDoc._id,
            title: `Practical / Viva: ${item.subjectName || 'Lab'}`,
            eventType: 'Practical Exam',
            subjectName: item.subjectName,
            date: item.date,
            time: item.time || '09:00 AM',
            semester: parseInt(semester, 10) || 3,
            description: 'Laboratory practical assessment'
          });
          createdEvents.push(ev);
        }
      }
    }

    // 3. Create Assignment Deadlines
    if (Array.isArray(assignmentDeadlines)) {
      for (const item of assignmentDeadlines) {
        if (item.deadline) {
          const ev = await AcademicEvent.create({
            studentId,
            noticeId: noticeDoc._id,
            title: `Assignment Due: ${item.title || item.subjectName}`,
            eventType: 'Assignment Deadline',
            subjectName: item.subjectName,
            date: item.deadline,
            semester: parseInt(semester, 10) || 3,
            description: 'Coursework submission deadline'
          });
          createdEvents.push(ev);
        }
      }
    }

    // 4. Create Holidays
    if (Array.isArray(holidays)) {
      for (const item of holidays) {
        if (item.date) {
          const ev = await AcademicEvent.create({
            studentId,
            noticeId: noticeDoc._id,
            title: `University Holiday: ${item.name}`,
            eventType: 'Holiday',
            date: item.date,
            semester: parseInt(semester, 10) || 3,
            description: 'Official academic holiday'
          });
          createdEvents.push(ev);
        }
      }
    }

    return {
      success: true,
      notice: noticeDoc,
      eventsCount: createdEvents.length,
      events: createdEvents
    };
  }

  /**
   * Retrieves all notices
   */
  async getAllNotices(studentId = 'default_student', semesterFilter = 'all') {
    const query = { studentId };
    if (semesterFilter && semesterFilter !== 'all') {
      query.semester = parseInt(semesterFilter, 10);
    }
    const notices = await UniversityNotice.find(query);
    return notices.sort((a, b) => (b.noticeDate || '').localeCompare(a.noticeDate || ''));
  }

  /**
   * Retrieves single notice
   */
  async getNoticeById(id) {
    return await UniversityNotice.findById(id);
  }

  /**
   * Deletes notice, cleans up any associated file, and removes related academic events
   */
  async deleteNotice(id) {
    const notice = await UniversityNotice.findById(id);
    if (notice && notice.fileUrl && fs.existsSync(notice.fileUrl)) {
      try { fs.unlinkSync(notice.fileUrl); } catch (e) {}
    }
    await AcademicEvent.deleteMany({ noticeId: id });
    return await UniversityNotice.deleteOne({ _id: id });
  }

  /**
   * Retrieves upcoming academic events
   */
  async getUpcomingEvents(studentId = 'default_student') {
    const today = new Date().toISOString().slice(0, 10);
    const events = await AcademicEvent.find({ studentId });
    return events
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Computes earliest upcoming exam countdown
   */
  async getLatestExamCountdown(studentId = 'default_student') {
    const events = await AcademicEvent.find({ studentId, eventType: 'Examination' });
    const today = new Date().toISOString().slice(0, 10);
    const future = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

    if (future.length === 0) {
      return null;
    }

    const firstExam = future[0];
    const diffMs = new Date(firstExam.date).getTime() - new Date().getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      examName: firstExam.title,
      subjectName: firstExam.subjectName || 'Semester Examination',
      date: firstExam.date,
      daysLeft,
      totalPapers: future.length,
      papers: future
    };
  }
}

module.exports = new NoticeService();
