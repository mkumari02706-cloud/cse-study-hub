const express = require('express');
const router = express.Router();
const plannerService = require('../services/plannerService');
const noticeService = require('../services/noticeService');
const exploreService = require('../services/exploreService');
const { getAllSubjects } = require('../config/subjects');

// GET /planner - Personal Study Planner Dashboard with AI-Generated Exam & Roadmap Plans
router.get('/', async (req, res) => {
  try {
    const plannerData = plannerService.getPlannerData();
    const allSubjects = getAllSubjects();
    const exploreTracks = exploreService.getAllTracks();
    const upcomingEvents = await noticeService.getUpcomingEvents('default_student');
    const examCountdown = await noticeService.getLatestExamCountdown('default_student');

    // Get active study plan
    const activeExamPlan = await plannerService.getActiveStudyPlan('university_exam', '3', 'default_student');
    const activeExplorePlan = await plannerService.getActiveStudyPlan('explore_roadmap', 'devops', 'default_student');

    res.render('pages/planner', {
      title: 'Personal Study Planner & Exam Schedule - CSE Study Hub',
      planner: plannerData,
      activeExamPlan,
      activeExplorePlan,
      upcomingEvents,
      examCountdown,
      exploreTracks,
      subjects: allSubjects,
      activeNav: 'planner'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', error: err });
  }
});

// POST /planner/api/goal/add
router.post('/api/goal/add', (req, res) => {
  try {
    const { text, subjectId } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Goal text is required.' });
    }
    const goal = plannerService.addDailyGoal({ text, subjectId });
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/goal/toggle
router.post('/api/goal/toggle', (req, res) => {
  try {
    const { goalId } = req.body;
    const goal = plannerService.toggleDailyGoal(goalId);
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/goal/delete
router.post('/api/goal/delete', (req, res) => {
  try {
    const { goalId } = req.body;
    plannerService.deleteDailyGoal(goalId);
    res.json({ success: true, message: 'Goal removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/timetable/add
router.post('/api/timetable/add', (req, res) => {
  try {
    const { day, time, subjectId, topic, type } = req.body;
    if (!day || !time || !topic) {
      return res.status(400).json({ success: false, error: 'Day, time, and topic are required.' });
    }
    const slot = plannerService.addTimetableSlot(day, { time, subjectId, topic, type });
    res.json({ success: true, slot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/timetable/delete
router.post('/api/timetable/delete', (req, res) => {
  try {
    const { day, slotId } = req.body;
    plannerService.deleteTimetableSlot(day, slotId);
    res.json({ success: true, message: 'Slot deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/revision/schedule
router.post('/api/revision/schedule', (req, res) => {
  try {
    const { topicName, subjectId, unitNumber } = req.body;
    if (!topicName || !subjectId) {
      return res.status(400).json({ success: false, error: 'topicName and subjectId are required.' });
    }
    const item = plannerService.scheduleRevision({ topicName, subjectId, unitNumber });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/revision/toggle
router.post('/api/revision/toggle', (req, res) => {
  try {
    const { revisionId, cycleNumber } = req.body;
    const item = plannerService.toggleRevisionCycle(revisionId, parseInt(cycleNumber, 10));
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/exam/update
router.post('/api/exam/update', (req, res) => {
  try {
    const { examName, subjectId, date, targetScore } = req.body;
    const exam = plannerService.setExamCountdown({ examName, subjectId, date, targetScore });
    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// AI STUDY PLANNER API ENDPOINTS
// =========================================================================

// POST /planner/api/plan/generate - Generate or Regenerate Personalized Exam Plan
router.post('/api/plan/generate', async (req, res) => {
  try {
    const { semester, targetExamDate, dailyAvailableHours } = req.body;
    const result = await plannerService.generatePersonalStudyPlan({
      semester: semester || 3,
      targetExamDate: targetExamDate || null,
      dailyAvailableHours: dailyAvailableHours || 3,
      studentId: 'default_student',
      regenerate: true
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/plan/explore - Generate Explore & Learn Roadmap Plan
router.post('/api/plan/explore', async (req, res) => {
  try {
    const { trackId, targetDate, dailyAvailableHours } = req.body;
    if (!trackId || !targetDate) {
      return res.status(400).json({ success: false, error: 'trackId and targetDate are required.' });
    }

    const result = await plannerService.generateExploreStudyPlan({
      trackId,
      targetDate,
      dailyAvailableHours: dailyAvailableHours || 2,
      studentId: 'default_student'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/task/toggle - Mark Task Completed & Sync Progress
router.post('/api/task/toggle', async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required.' });

    const task = await plannerService.toggleStudyTask(taskId);
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/task/reschedule - Reschedule Overdue / Unfinished Tasks
router.post('/api/task/reschedule', async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, error: 'planId is required.' });

    const result = await plannerService.rescheduleUnfinishedTasks(planId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/task/update - Update Task Date / Duration / Title
router.post('/api/task/update', async (req, res) => {
  try {
    const { taskId, date, allocatedHours, topicTitle } = req.body;
    if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required.' });

    const task = await plannerService.updateStudyTask(taskId, { date, allocatedHours, topicTitle });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/task/cancel - Cancel individual scheduled study task
router.post('/api/task/cancel', async (req, res) => {
  try {
    const taskId = req.body.taskId || req.body.id;
    if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required.' });

    const result = await plannerService.cancelStudyTask(taskId);
    res.json({ success: true, message: 'Study task cancelled successfully.', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /planner/api/task/:id - Delete study task
router.delete('/api/task/:id', async (req, res) => {
  try {
    const result = await plannerService.cancelStudyTask(req.params.id);
    res.json({ success: true, message: 'Study task removed successfully.', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/task/delete
router.post('/api/task/delete', async (req, res) => {
  try {
    const taskId = req.body.taskId || req.body.id;
    if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required.' });

    const result = await plannerService.cancelStudyTask(taskId);
    res.json({ success: true, message: 'Study task removed successfully.', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/plan/cancel - Cancel active study plan
router.post('/api/plan/cancel', async (req, res) => {
  try {
    const planId = req.body.planId || req.body.id;
    if (!planId) return res.status(400).json({ success: false, error: 'planId is required.' });

    const plan = await plannerService.cancelStudyPlan(planId);
    res.json({ success: true, message: 'Study plan cancelled successfully. It will no longer appear as an active plan.', plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /planner/api/plan/:id - Delete study plan permanently
router.delete('/api/plan/:id', async (req, res) => {
  try {
    await plannerService.deleteStudyPlan(req.params.id);
    res.json({ success: true, message: 'Study plan deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /planner/api/plan/delete
router.post('/api/plan/delete', async (req, res) => {
  try {
    const planId = req.body.planId || req.body.id;
    if (!planId) return res.status(400).json({ success: false, error: 'planId is required.' });

    await plannerService.deleteStudyPlan(planId);
    res.json({ success: true, message: 'Study plan deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /planner/api/views - Daily, Weekly, Monthly Schedule Views
router.get('/api/views', async (req, res) => {
  try {
    const { planId, date } = req.query;
    if (!planId) return res.status(400).json({ success: false, error: 'planId is required.' });

    const views = await plannerService.getScheduleViews(planId, date);
    res.json({ success: true, views });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
