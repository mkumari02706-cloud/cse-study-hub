const { createModel } = require('./baseModel');

/**
 * AcademicEvent Model
 * Individual academic milestone extracted or scheduled from a notice (exams, deadlines, practicals, holidays).
 */
const AcademicEvent = createModel('AcademicEvent', 'academic_events', {
  studentId: { type: String, default: 'default_student' },
  noticeId: { type: String, default: null },
  title: { type: String, required: true },
  eventType: { type: String, required: true }, // Examination, Practical Exam, Internal Exam, Assignment Deadline, Holiday, Registration, Result, Academic Deadline
  subjectName: { type: String, default: null },
  subjectCode: { type: String, default: null },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, default: null }, // e.g. 10:00 AM - 01:00 PM
  semester: { type: Number, default: 3 },
  description: { type: String, default: '' },
  isConfirmed: { type: Boolean, default: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = AcademicEvent;
