const { createModel } = require('./baseModel');

/**
 * StudyPlan Model
 * Top-level personalized preparation plan for University Exam or Explore Roadmap.
 */
const StudyPlan = createModel('StudyPlan', 'study_plans', {
  studentId: { type: String, default: 'default_student' },
  title: { type: String, required: true },
  planType: { type: String, default: 'university_exam' }, // 'university_exam' | 'explore_roadmap'
  targetId: { type: String, default: '3' }, // semester number e.g. '3' or trackId e.g. 'devops'
  targetName: { type: String, default: 'Semester 3 Preparation' },
  startDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  targetDate: { type: String, required: true }, // Exam date or roadmap completion date
  dailyAvailableHours: { type: Number, default: 3 },
  status: { type: String, default: 'active' }, // active, completed, archived
  noticeId: { type: String, default: null }, // linked notice if university_exam
  totalTasks: { type: Number, default: 0 },
  completedTasks: { type: Number, default: 0 },
  progressPercentage: { type: Number, default: 0 },
  weakTopicsCount: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = StudyPlan;
