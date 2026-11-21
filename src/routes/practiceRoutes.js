const express = require('express');
const router = express.Router();
const practiceService = require('../services/practiceService');
const { getAllSubjects, getSubjectById } = require('../config/subjects');
const pyqService = require('../services/pyqService');

// GET /practice - Practice Center Home
router.get('/', (req, res) => {
  const allSubjects = getAllSubjects();
  const selectedSubjectId = req.query.subject || (allSubjects[0] ? allSubjects[0].id : '');
  const stats = practiceService.getPracticeStats();

  res.render('pages/practice', {
    title: 'Practice Center: MCQs, Flashcards & Mock Tests - CSE Study Hub',
    subjects: allSubjects,
    selectedSubjectId,
    stats,
    activeNav: 'practice'
  });
});

// GET /practice/quiz - Interactive MCQ Quiz Page
router.get('/quiz', async (req, res) => {
  try {
    const { subject, unit, topic } = req.query;
    const allSubjects = getAllSubjects();
    const targetSubjectId = subject || (allSubjects[0] ? allSubjects[0].id : 'oops_java');

    const quizData = await practiceService.getTopicQuiz(
      targetSubjectId,
      unit ? parseInt(unit, 10) : 1,
      topic || ''
    );

    res.render('pages/practice-quiz', {
      title: `Topic Quiz: ${quizData.topicName} - CSE Study Hub`,
      quiz: quizData,
      subjects: allSubjects,
      activeNav: 'practice'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Quiz Error', error: err });
  }
});

// GET /practice/flashcards - Digital Flippable Flashcards Page
router.get('/flashcards', async (req, res) => {
  try {
    const { subject, unit, topic } = req.query;
    const allSubjects = getAllSubjects();
    const targetSubjectId = subject || (allSubjects[0] ? allSubjects[0].id : 'oops_java');

    const flashcardData = await practiceService.getTopicFlashcards(
      targetSubjectId,
      unit ? parseInt(unit, 10) : 1,
      topic || ''
    );

    res.render('pages/practice-flashcards', {
      title: `Flashcards: ${flashcardData.topicName} - CSE Study Hub`,
      deck: flashcardData,
      subjects: allSubjects,
      activeNav: 'practice'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Flashcards Error', error: err });
  }
});

// GET /practice/mock/:subjectId - Full Curriculum Timed Mock Test
router.get('/mock/:subjectId', async (req, res) => {
  try {
    const mockTest = await practiceService.generateMockTest(req.params.subjectId, 10);
    res.render('pages/practice-quiz', {
      title: `${mockTest.subject.name} Full Mock Exam - CSE Study Hub`,
      quiz: {
        subjectId: mockTest.subject.id,
        subjectName: mockTest.subject.name,
        topicName: 'Full Curriculum Mock Examination',
        questions: mockTest.questions
      },
      isMock: true,
      durationMinutes: mockTest.durationMinutes,
      subjects: getAllSubjects(),
      activeNav: 'practice'
    });
  } catch (err) {
    res.status(404).render('pages/404', { title: 'Mock Test Not Found', message: err.message });
  }
});

// POST /practice/api/submit - Record Quiz Score & Update Weak Topic Matrix
router.post('/api/submit', (req, res) => {
  try {
    const { subjectId, topicName, score, total, answers } = req.body;
    if (!subjectId || typeof score !== 'number' || typeof total !== 'number') {
      return res.status(400).json({ success: false, error: 'subjectId, score, and total are required.' });
    }

    const recorded = practiceService.recordQuizAttempt({
      subjectId,
      topicName,
      score,
      total,
      answers
    });

    res.json({
      success: true,
      attempt: recorded,
      weakTopics: practiceService.getWeakTopicAnalysis()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /practice/api/weak-topics - Weak Topics JSON
router.get('/api/weak-topics', (req, res) => {
  try {
    const weakTopics = practiceService.getWeakTopicAnalysis();
    res.json({ success: true, weakTopics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
