const { createModel } = require('./baseModel');

/**
 * StudyTask Model
 * Day-by-day scheduled study units (topics, revision sessions, practice drills, mock exams).
 */
const StudyTask = createModel('StudyTask', 'study_tasks', {
  studentId: { type: String, default: 'default_student' },
  planId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  dayOfWeek: { type: String, default: '' },
  subjectId: { type: String, default: null }, // e.g. 'oops_java' or 'devops'
  subjectName: { type: String, default: '' },
  unitNumber: { type: Number, default: null },
  unitTitle: { type: String, default: '' },
  topicTitle: { type: String, required: true },
  taskType: { type: String, default: 'syllabus_topic' }, // syllabus_topic, revision, practice_test, weak_topic_drill, mock_exam, explore_topic
  allocatedHours: { type: Number, default: 1.5 },
  pyqImportance: { type: String, default: 'Normal' }, // High, Medium, Low
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: String, default: null },
  rescheduledCount: { type: Number, default: 0 },
  notesTranscriptId: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = StudyTask;
