const express = require('express');
const router = express.Router();
const { subjects, getAllSubjects, getSubjectsBySemester } = require('../config/subjects');
const fileService = require('../services/fileService');
const progressService = require('../services/progressService');
const pyqService = require('../services/pyqService');
const plannerService = require('../services/plannerService');
const practiceService = require('../services/practiceService');
const noticeService = require('../services/noticeService');

// Dashboard Page with Multi-Semester Filtering and Comprehensive Analytics
router.get('/', async (req, res) => {
  const selectedSemester = req.query.semester || 'all';
  const stats = progressService.getProgressStats(selectedSemester);
  const displaySubjects = getSubjectsBySemester(selectedSemester);
  const recentLectures = fileService.getLectures().slice(0, 6);
  const plannerData = plannerService.getPlannerData();
  const practiceStats = practiceService.getPracticeStats();

  let recentNotices = [];
  let upcomingEvents = [];
  let latestNoticeExam = null;
  try {
    recentNotices = await noticeService.getAllNotices('default_student', selectedSemester);
    upcomingEvents = await noticeService.getUpcomingEvents('default_student');
    latestNoticeExam = await noticeService.getLatestExamCountdown('default_student');
  } catch (e) {
    console.warn('[Dashboard] Notice load warning:', e.message);
  }

  // 1. Gather Important Topics across active subjects
  const allHighYieldTopics = [];
  displaySubjects.forEach(sub => {
    const pyqAnalytics = pyqService.getSubjectPYQAnalytics(sub.id);
    if (pyqAnalytics && pyqAnalytics.importanceRanking) {
      const high = pyqAnalytics.importanceRanking.filter(t => t.level === 'HIGH' || t.appearances > 0);
      high.forEach(t => {
        allHighYieldTopics.push({
          ...t,
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color
        });
      });
    }
  });

  // Sort by appearances descending
  allHighYieldTopics.sort((a, b) => b.appearances - a.appearances || b.totalMarks - a.totalMarks);
  const topImportantTopics = allHighYieldTopics.slice(0, 6);

  // 2. Pending Revisions across curriculum
  const pendingRevisions = [];
  stats.subjects.forEach(s => {
    (s.pendingTopics || []).slice(0, 2).forEach(pTopic => {
      pendingRevisions.push({
        subjectId: s.subject.id,
        subjectName: s.subject.name,
        subjectColor: s.subject.color,
        topic: pTopic
      });
    });
  });

  // 3. Personalized Recommendations
  const recommendations = [];

  // Rec 1: Upcoming Exam Countdown
  const exam = plannerData.examCountdown && plannerData.examCountdown[0];
  if (exam && exam.daysLeft <= 30) {
    recommendations.push({
      type: 'exam',
      badge: 'Target Deadline',
      icon: '⏱️',
      title: `${exam.daysLeft} Days to ${exam.examName}`,
      desc: `Focus on high-yield questions for ${exam.subjectName} and solve full-syllabus mock papers.`,
      link: '/practice',
      linkText: 'Practice Center'
    });
  }

  // Rec 2: Diagnostic Weak Topics
  if (practiceStats.weakTopics && practiceStats.weakTopics.length > 0) {
    const topWeak = practiceStats.weakTopics[0];
    recommendations.push({
      type: 'weak',
      badge: 'Diagnostic Alert',
      icon: '⚠️',
      title: `Reinforce: ${topWeak.topicName}`,
      desc: `Scoring ${topWeak.averageAccuracy}% in practice quizzes. Review lecture transcripts and re-test.`,
      link: `/practice/quiz?subject=${topWeak.subjectId}&topic=${encodeURIComponent(topWeak.topicName)}`,
      linkText: 'Retake Quiz'
    });
  }

  // Rec 3: High-Yield Topic Recommendation
  if (topImportantTopics.length > 0) {
    const topTopic = topImportantTopics[0];
    recommendations.push({
      type: 'pyq',
      badge: 'High Yield',
      icon: '🔥',
      title: `Master ${topTopic.topic}`,
      desc: `${topTopic.evidence} in ${topTopic.subjectName}. Guaranteed exam return on investment.`,
      link: `/subject/${topTopic.subjectId}`,
      linkText: 'Open Topic Hub'
    });
  } else {
    recommendations.push({
      type: 'explore',
      badge: 'Career Skills',
      icon: '🧭',
      title: 'Advance Your Technical Specialization',
      desc: 'Explore career roadmaps in AI/ML, DevOps, Cybersecurity, and Advanced DSA.',
      link: '/explore',
      linkText: 'Explore Roadmaps'
    });
  }

  res.render('pages/dashboard', {
    title: 'CSE Study Hub - Personal Learning Dashboard',
    subjects: displaySubjects,
    allSubjects: getAllSubjects(),
    selectedSemester,
    stats,
    recentLectures,
    planner: plannerData,
    practiceStats,
    topImportantTopics,
    pendingRevisions: pendingRevisions.slice(0, 6),
    recommendations,
    recentNotices,
    upcomingEvents,
    latestNoticeExam,
    activeNav: 'dashboard'
  });
});

// Global Search
router.get('/search', (req, res) => {
  const query = req.query.q || '';
  const searchResults = fileService.getLectures({ search: query });
  const allSubs = getAllSubjects();

  // Also search static syllabus topics across all subjects
  const matchingTopics = [];
  if (query.trim()) {
    const qLower = query.toLowerCase();
    allSubs.forEach(sub => {
      (sub.units || []).forEach(unit => {
        (unit.topics || []).forEach(topic => {
          if (topic.toLowerCase().includes(qLower) || (unit.title && unit.title.toLowerCase().includes(qLower))) {
            matchingTopics.push({
              subject: sub,
              unit,
              topic
            });
          }
        });
      });
    });
  }

  res.render('pages/search', {
    title: `Search: ${query} - CSE Study Hub`,
    query,
    searchResults,
    matchingTopics,
    activeNav: 'search'
  });
});

module.exports = router;
