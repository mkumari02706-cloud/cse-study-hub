const express = require('express');
const router = express.Router();
const { subjects, getAllSubjects } = require('../config/subjects');
const progressService = require('../services/progressService');

// Master Progress Tracker Page
router.get('/', (req, res) => {
  const selectedSemester = req.query.semester || 'all';
  const stats = progressService.getProgressStats(selectedSemester);

  res.render('pages/progress', {
    title: 'Progress Tracker - CSE Study Hub',
    subjects: getAllSubjects(),
    stats,
    selectedSemester,
    activeNav: 'progress'
  });
});

// API: Toggle Topic Completion
router.post('/api/toggle', (req, res) => {
  try {
    const { subjectId, topicName } = req.body;
    if (!subjectId || !topicName) {
      return res.status(400).json({ success: false, error: 'subjectId and topicName are required.' });
    }

    const result = progressService.toggleTopic(subjectId, topicName);
    const updatedStats = progressService.getProgressStats();

    res.json({
      success: true,
      result,
      overallPercentage: updatedStats.overallPercentage,
      subjectStats: updatedStats.subjects.find(s => s.subject.id === subjectId)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
