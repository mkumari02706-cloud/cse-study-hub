const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { subjects, getAllSubjects, getSubjectById, ROOT_DIR } = require('../config/subjects');
const pyqService = require('../services/pyqService');
const aiService = require('../services/aiService');

const upload = multer({
  dest: path.join(ROOT_DIR, 'uploads'),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB for papers
});

// Middleware supporting single 'paperFile' or multiple 'paperFiles'
const pyqUploadMiddleware = upload.fields([
  { name: 'paperFile', maxCount: 1 },
  { name: 'paperFiles', maxCount: 10 }
]);

// PYQ Portal Page
router.get('/', (req, res) => {
  const selectedSubject = req.query.subject || '';
  const pyqs = pyqService.getPYQs(selectedSubject);
  const allSubs = getAllSubjects();

  // If a subject is selected, compute analytics for quick summary on main page
  let analytics = null;
  if (selectedSubject) {
    analytics = pyqService.getSubjectPYQAnalytics(selectedSubject);
  }

  res.render('pages/pyqs', {
    title: 'PYQ Management & Frequency Analyzer - CSE Study Hub',
    subjects: allSubs,
    pyqs,
    selectedSubject,
    analytics,
    aiConfigured: aiService.isConfigured(),
    activeNav: 'pyqs'
  });
});

// Dedicated Subject Analytics Dashboard
router.get('/analytics/:subjectId', (req, res) => {
  const subject = getSubjectById(req.params.subjectId);
  if (!subject) {
    return res.status(404).render('pages/404', { title: 'Subject Not Found', message: 'Subject does not exist.' });
  }

  const analytics = pyqService.getSubjectPYQAnalytics(subject.id);

  res.render('pages/pyq-analytics', {
    title: `PYQ Analytics: ${subject.name} - CSE Study Hub`,
    subject,
    analytics,
    subjects: getAllSubjects(),
    activeNav: 'pyqs'
  });
});

// API: Upload Exam Paper(s) & Extract Questions (Supports single & multiple PDF uploads)
router.post('/api/upload', pyqUploadMiddleware, async (req, res) => {
  try {
    const files = [];
    if (req.files && req.files['paperFile'] && req.files['paperFile'][0]) {
      files.push(req.files['paperFile'][0]);
    }
    if (req.files && req.files['paperFiles'] && req.files['paperFiles'].length > 0) {
      files.push(...req.files['paperFiles']);
    }

    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'Please upload at least one PDF or TXT question paper file.' });
    }

    const { subjectId, unitNumber, year, examType } = req.body;
    if (!subjectId) {
      files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
      return res.status(400).json({ success: false, error: 'Subject is required.' });
    }

    if (files.length === 1) {
      const result = await pyqService.processUploadedPaper({
        subjectId,
        unitNumber: unitNumber ? parseInt(unitNumber, 10) : null,
        year: year || `${new Date().getFullYear()}`,
        examType: examType || 'End-Sem',
        uploadedFile: files[0]
      });

      if (fs.existsSync(files[0].path)) {
        try { fs.unlinkSync(files[0].path); } catch (e) {}
      }

      return res.json({ success: true, pyq: result, count: 1 });
    } else {
      // Multiple file batch upload
      const batchResult = await pyqService.processMultiplePapers({
        subjectId,
        unitNumber: unitNumber ? parseInt(unitNumber, 10) : null,
        year: year || `${new Date().getFullYear()}`,
        examType: examType || 'University Exam',
        uploadedFiles: files
      });

      return res.json({
        success: batchResult.success,
        pyq: batchResult.results[0],
        allResults: batchResult.results,
        count: batchResult.results.length,
        errors: batchResult.errors
      });
    }
  } catch (err) {
    if (req.files) {
      Object.values(req.files).flat().forEach(f => {
        if (f && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (e) {}
        }
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get Topic-specific PYQ questions & importance status
router.get('/api/topic-questions', (req, res) => {
  try {
    const { subjectId, topic } = req.query;
    if (!subjectId || !topic) {
      return res.status(400).json({ success: false, error: 'subjectId and topic are required query parameters.' });
    }

    const result = pyqService.getRelatedPYQsForTopic(subjectId, topic);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Subject PYQ Analytics JSON
router.get('/api/analytics/:subjectId', (req, res) => {
  try {
    const analytics = pyqService.getSubjectPYQAnalytics(req.params.subjectId);
    if (!analytics) {
      return res.status(404).json({ success: false, error: 'Subject not found.' });
    }
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /pyqs/api/:id - Delete PYQ and files
router.delete('/api/:id', (req, res) => {
  try {
    const result = pyqService.deletePYQ(req.params.id);
    res.json({ success: true, message: 'Question paper record and files deleted successfully.', result });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /pyqs/api/:id/delete
router.post('/api/:id/delete', (req, res) => {
  try {
    const result = pyqService.deletePYQ(req.params.id);
    res.json({ success: true, message: 'Question paper record and files deleted successfully.', result });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /pyqs/api/delete
router.post('/api/delete', (req, res) => {
  try {
    const id = req.body.id || req.body.pyqId;
    if (!id) return res.status(400).json({ success: false, error: 'PYQ id is required.' });
    const result = pyqService.deletePYQ(id);
    res.json({ success: true, message: 'Question paper record and files deleted successfully.', result });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// View Extracted Questions of a specific paper
router.get('/:id', (req, res) => {
  const pyqList = pyqService.getPYQs();
  const pyq = pyqList.find(p => p.id === req.params.id);
  if (!pyq) {
    return res.status(404).render('pages/404', { title: 'PYQ Not Found', message: 'The requested question paper record was not found.' });
  }

  const subject = getSubjectById(pyq.subjectId);
  res.render('pages/pyq-detail', {
    title: `PYQ: ${pyq.subjectName} - ${pyq.year}`,
    pyq,
    subject,
    activeNav: 'pyqs'
  });
});

module.exports = router;
