const { createModel } = require('./baseModel');

/**
 * UniversityNotice Model
 * Stores extracted and confirmed university notifications (PDF, image, text, or manual).
 */
const UniversityNotice = createModel('UniversityNotice', 'university_notices', {
  studentId: { type: String, default: 'default_student' },
  title: { type: String, required: true },
  universityName: { type: String, default: 'University' },
  semester: { type: Number, default: 3 },
  noticeType: { type: String, default: 'Exam Timetable' }, // Exam Timetable, Assignment Deadline, Holiday, Practical Exam, Internal Exam, Registration, Result, General
  noticeDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileType: { type: String, default: 'text' }, // pdf, image, text, manual
  rawText: { type: String, default: '' },
  extractedData: {
    universityName: String,
    semester: Number,
    examinationDates: { start: String, end: String },
    timetable: [{ subjectName: String, subjectCode: String, date: String, time: String, room: String }],
    practicalDates: [{ subjectName: String, date: String, time: String }],
    internalDates: [{ subjectName: String, date: String }],
    assignmentDeadlines: [{ title: String, subjectName: String, deadline: String }],
    holidays: [{ name: String, date: String }],
    registrationDeadlines: [{ title: String, deadline: String }],
    resultAnnouncements: [{ title: String, expectedDate: String }],
    academicDeadlines: [{ title: String, date: String }]
  },
  confirmed: { type: Boolean, default: false },
  confirmedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = UniversityNotice;
