const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { ROOT_DIR, getAllSubjects } = require('../config/subjects');
const noticeService = require('../services/noticeService');
const plannerService = require('../services/plannerService');

const upload = multer({
  dest: path.join(ROOT_DIR, 'uploads'),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// GET /notices - University Notices Dashboard & Archive
router.get('/', async (req, res) => {
  try {
    const semesterFilter = req.query.semester || 'all';
    const notices = await noticeService.getAllNotices('default_student', semesterFilter);
    const upcomingEvents = await noticeService.getUpcomingEvents('default_student');
    const examCountdown = await noticeService.getLatestExamCountdown('default_student');

    res.render('pages/notices', {
      title: 'University Notices & Exam Timetable - CSE Study Hub',
      notices,
      upcomingEvents,
      examCountdown,
      selectedSemester: semesterFilter,
      subjects: getAllSubjects(),
      activeNav: 'notices'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', error: err });
  }
});

// POST /notices/api/extract - Multipart Notice File (PDF/Image) or Text Extraction
router.post('/api/extract', upload.single('noticeFile'), async (req, res) => {
  try {
    const { noticeText, manualData } = req.body;
    let parsedManual = null;
    if (manualData) {
      try { parsedManual = typeof manualData === 'string' ? JSON.parse(manualData) : manualData; } catch (e) {}
    }

    const result = await noticeService.extractNotice({
      file: req.file,
      text: noticeText,
      manualData: parsedManual
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /notices/api/confirm - Confirm & Save Extracted Notice to Database
router.post('/api/confirm', async (req, res) => {
  try {
    const noticePayload = req.body;
    if (!noticePayload || !noticePayload.title) {
      return res.status(400).json({ success: false, error: 'Notice title and details are required.' });
    }

    const saveResult = await noticeService.confirmAndSaveNotice(noticePayload, 'default_student');

    // If autoGeneratePlan requested and exam timetable exists, trigger planner sync
    if (req.body.syncWithPlanner && saveResult.notice.extractedData.examinationDates) {
      try {
        await plannerService.generatePersonalStudyPlan({
          semester: saveResult.notice.semester,
          targetExamDate: saveResult.notice.extractedData.examinationDates.start,
          dailyAvailableHours: 3,
          studentId: 'default_student',
          regenerate: true
        });
      } catch (planErr) {
        console.warn('[Notice Route] Planner auto-sync note:', planErr.message);
      }
    }

    res.json(saveResult);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /notices/api/:id - Delete Notice & Associated Events
router.delete('/api/:id', async (req, res) => {
  try {
    await noticeService.deleteNotice(req.params.id);
    res.json({ success: true, message: 'Notice and events deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /notices/api/:id/delete
router.post('/api/:id/delete', async (req, res) => {
  try {
    await noticeService.deleteNotice(req.params.id);
    res.json({ success: true, message: 'Notice and events deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /notices/api/delete
router.post('/api/delete', async (req, res) => {
  try {
    const id = req.body.id || req.body.noticeId;
    if (!id) return res.status(400).json({ success: false, error: 'Notice id is required.' });
    await noticeService.deleteNotice(id);
    res.json({ success: true, message: 'Notice and events deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /notices/api/upcoming - Upcoming events JSON endpoint
router.get('/api/upcoming', async (req, res) => {
  try {
    const events = await noticeService.getUpcomingEvents('default_student');
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /notices/:id - Notice Details & Timetable Breakdown
router.get('/:id', async (req, res) => {
  try {
    const notice = await noticeService.getNoticeById(req.params.id);
    if (!notice) {
      return res.status(404).render('pages/404', {
        title: 'Notice Not Found',
        message: 'The requested university notice was not found.'
      });
    }

    res.render('pages/notices-detail', {
      title: `${notice.title} - CSE Study Hub`,
      notice,
      subjects: getAllSubjects(),
      activeNav: 'notices'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', error: err });
  }
});

module.exports = router;
