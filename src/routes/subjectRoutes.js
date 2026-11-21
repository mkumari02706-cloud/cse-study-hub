const express = require('express');
const router = express.Router();
const { getSubjectById, subjects } = require('../config/subjects');
const fileService = require('../services/fileService');
const progressService = require('../services/progressService');
const pyqService = require('../services/pyqService');
const topicInterconnectService = require('../services/topicInterconnectService');

// Subject Detail Page
router.get('/:id', (req, res) => {
  const subject = getSubjectById(req.params.id);
  if (!subject) {
    return res.status(404).render('pages/404', { title: 'Subject Not Found', message: 'The requested subject does not exist.' });
  }

  const lectures = fileService.getLectures({ subjectId: subject.id });
  const pyqs = pyqService.getPYQs(subject.id);
  const progressStats = progressService.getProgressStats();
  const subjectProgress = progressStats.subjects.find(s => s.subject.id === subject.id);
  const pyqAnalytics = pyqService.getSubjectPYQAnalytics(subject.id);

  res.render('pages/subject', {
    title: `${subject.name} - CSE Study Hub`,
    subject,
    lectures,
    pyqs,
    progress: subjectProgress,
    pyqAnalytics,
    activeNav: subject.id
  });
});

// API: Get Full Interconnected Topic Hub Data
router.get('/:id/topic-hub', (req, res) => {
  try {
    const { topic, unit } = req.query;
    if (!topic) {
      return res.status(400).json({ success: false, error: 'topic query parameter is required.' });
    }

    const data = topicInterconnectService.getInterconnectedTopicHub(
      req.params.id,
      topic,
      unit ? parseInt(unit, 10) : null
    );

    res.json({ success: true, hub: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
