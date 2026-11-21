const { createModel } = require('./baseModel');

/**
 * LearningProgress Model
 * Tracks progress across roadmaps and curriculum subjects.
 */
const LearningProgress = createModel('LearningProgress', 'learning_progress', {
  studentId: { type: String, default: 'default_student' },
  type: { type: String, default: 'explore' }, // 'explore' or 'curriculum'
  entityId: { type: String, required: true }, // trackId or subjectId
  completedMilestones: { type: [String], default: [] },
  completedLectures: { type: [String], default: [] },
  completedTopics: { type: [String], default: [] },
  totalMilestones: { type: Number, default: 0 },
  percentComplete: { type: Number, default: 0 },
  targetCompletionDate: { type: String, default: null },
  dailyStudyHours: { type: Number, default: 2 },
  lastActiveDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = LearningProgress;
