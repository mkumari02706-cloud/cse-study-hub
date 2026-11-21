const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  ROOT_DIR,
  subjects,
  getAllSubjects,
  getSubjectById,
  getSubjectsBySemester,
  addSubject,
  updateSubject,
  deleteSubject
} = require('../config/subjects');
const syllabusService = require('../services/syllabusService');
const aiService = require('../services/aiService');
const fileService = require('../services/fileService');
const progressService = require('../services/progressService');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer upload setup for PDF syllabus
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';
    if (isPdfMime || isPdfExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF documents (.pdf) are supported.'));
    }
  }
});

// GET /syllabus - Redirects to /syllabus/upload
router.get('/', (req, res) => {
  res.redirect('/syllabus/upload');
});

// GET /syllabus/upload - Syllabus Upload & Multi-Semester Management View
router.get('/upload', (req, res) => {
  const allSubs = getAllSubjects();
  const selectedSem = req.query.semester || 'all';

  res.render('pages/syllabus-upload', {
    title: 'Upload Syllabus & Manage Subjects - CSE Study Hub',
    subjects: allSubs,
    selectedSemester: selectedSem,
    aiConfigured: aiService.isConfigured(),
    activeNav: 'syllabus-upload'
  });
});

// POST /syllabus/api/extract - AI-Powered PDF Extraction
router.post('/api/extract', (req, res, next) => {
  upload.single('syllabusPdf')(req, res, err => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File exceeds 25MB maximum size limit.' });
      }
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  const filePath = req.file ? req.file.path : null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please choose a syllabus PDF to upload.' });
    }

    const targetSemester = req.body.semester ? parseInt(req.body.semester, 10) : null;
    const extractedData = await syllabusService.processUploadedSyllabusPDF(filePath, targetSemester);

    res.json({
      success: true,
      syllabus: extractedData
    });
  } catch (err) {
    console.error('[Syllabus Extraction Error]', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to extract syllabus from uploaded PDF.'
    });
  } finally {
    // Guaranteed cleanup of uploaded temporary file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn('[Syllabus] Could not clean up temporary upload file:', unlinkErr.message);
      }
    }
  }
});

// POST /syllabus/api/save - Save Confirmed Syllabus
router.post('/api/save', (req, res) => {
  try {
    const { semester, subjects: subjectsList, overwrite } = req.body;

    if (!subjectsList || !Array.isArray(subjectsList) || subjectsList.length === 0) {
      return res.status(400).json({ success: false, error: 'No subjects provided to save.' });
    }

    const result = syllabusService.saveConfirmedSyllabus(semester, subjectsList, { overwrite });

    res.json({
      success: result.success,
      savedCount: result.savedCount,
      savedSubjects: result.savedSubjects,
      errors: result.errors
    });
  } catch (err) {
    console.error('[Syllabus Save Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /syllabus/api/subject/add - Manual Subject Creation
router.post('/api/subject/add', (req, res) => {
  try {
    const { name, code, semester, description, units, icon, badge, color } = req.body;
    if (!name || !code || !semester) {
      return res.status(400).json({ success: false, error: 'Subject name, code, and semester are required.' });
    }

    const newSubject = addSubject({
      name,
      code,
      semester: parseInt(semester, 10),
      description,
      units: units || [],
      icon,
      badge,
      color
    });

    // Refresh progress
    progressService.loadProgress();

    res.json({ success: true, subject: newSubject });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /syllabus/api/subject/:id - Update Subject
router.put('/api/subject/:id', (req, res) => {
  try {
    const updated = updateSubject(req.params.id, req.body);
    res.json({ success: true, subject: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /syllabus/api/subject/:id - Delete Subject
router.delete('/api/subject/:id', (req, res) => {
  try {
    deleteSubject(req.params.id);
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /syllabus/api/subject/:id/delete - Fallback Delete Subject
router.post('/api/subject/:id/delete', (req, res) => {
  try {
    deleteSubject(req.params.id);
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /syllabus/api/subject/delete - Fallback Delete Subject by Body ID
router.post('/api/subject/delete', (req, res) => {
  try {
    const id = req.body.id || req.body.subjectId;
    if (!id) return res.status(400).json({ success: false, error: 'Subject ID is required' });
    deleteSubject(id);
    res.json({ success: true, message: 'Subject deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /syllabus/api/topic-study - Topic-Wise AI Study Generation
router.post('/api/topic-study', async (req, res) => {
  try {
    const { subjectId, unitTitle, topic, feature, language, question } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'Topic title is required.' });
    }

    const subject = getSubjectById(subjectId);
    const subjectName = subject ? subject.name : 'Computer Science';
    const safeUnit = unitTitle || 'Core Unit';

    let content = '';

    switch (feature) {
      case 'explanation':
        content = await aiService.generateTopicExplanation(subjectName, safeUnit, topic, language || 'hinglish');
        break;
      case 'shortNotes':
        content = await aiService.generateTopicShortNotes(subjectName, safeUnit, topic);
        break;
      case 'importantQuestions':
        content = await aiService.generateTopicImportantQuestions(subjectName, safeUnit, topic);
        break;
      case 'revisionSummary':
        content = await aiService.generateTopicRevisionSummary(subjectName, safeUnit, topic);
        break;
      case 'askTutor':
        if (!question || !question.trim()) {
          return res.status(400).json({ success: false, error: 'Please provide a question for the AI tutor.' });
        }
        content = await aiService.askTopicAssistant(subjectName, safeUnit, topic, question);
        break;
      default:
        return res.status(400).json({ success: false, error: `Invalid feature: ${feature}` });
    }

    res.json({ success: true, feature, content });
  } catch (err) {
    console.error('[Topic AI Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /syllabus/api/topic-study/save - Save generated AI material to Library
router.post('/api/topic-study/save', async (req, res) => {
  try {
    const {
      subjectId,
      unitNumber,
      unitTitle,
      topic,
      studyMaterials
    } = req.body;

    if (!subjectId || !topic) {
      return res.status(400).json({ success: false, error: 'Subject and Topic are required.' });
    }

    const saved = await fileService.saveStudyPack({
      subjectId,
      unitNumber: parseInt(unitNumber, 10) || 1,
      unitTitle: unitTitle || 'Syllabus Topic',
      topicTitle: topic,
      lectureTitle: `${topic} (AI Study Pack)`,
      videoUrl: 'Syllabus AI Generated',
      videoId: '',
      transcriptText: `AI generated study pack for syllabus topic: ${topic}`,
      studyMaterials: studyMaterials || {}
    });

    res.json({ success: true, lecture: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
