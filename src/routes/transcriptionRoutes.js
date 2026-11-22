const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { ROOT_DIR, getAllSubjects, getSubjectById } = require('../config/subjects');
const exploreService = require('../services/exploreService');
const transcriptionService = require('../services/transcriptionService');
const aiService = require('../services/aiService');

const upload = multer({
  dest: path.join(ROOT_DIR, 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET /transcription - Lecture Transcription Workspace
router.get('/', async (req, res) => {
  try {
    const selectedCategory = req.query.category || '';
    const selectedTopic = req.query.topic || '';
    const selectedTopicId = req.query.topicId || '';

    const exploreTracks = exploreService.getAllTracks();
    const curriculumSubjects = getAllSubjects();

    let selectedType = req.query.type || '';
    if (!selectedType) {
      if (selectedCategory && curriculumSubjects.some(s => s.id === selectedCategory)) {
        selectedType = 'curriculum';
      } else {
        selectedType = 'explore';
      }
    }
    const history = await transcriptionService.getTranscripts({ studentId: 'default_student' });

    res.render('pages/transcription', {
      title: 'Lecture Transcription Workspace - CSE Study Hub',
      selectedCategory,
      selectedTopic,
      selectedTopicId,
      selectedType,
      exploreTracks,
      curriculumSubjects,
      history,
      subjects: curriculumSubjects,
      aiConfigured: aiService.isConfigured(),
      activeNav: 'transcription'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', error: err });
  }
});

// POST /transcription/api/fetch-youtube - Extract YouTube Captions & Timestamps
router.post('/api/fetch-youtube', async (req, res) => {
  try {
    const { videoUrl, language } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ success: false, error: 'YouTube video URL or Video ID is required.' });
    }

    const result = await transcriptionService.transcribeYouTube({ url: videoUrl, language: language || 'en' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /transcription/api/upload-text-file - Upload and parse .txt, .srt, .vtt transcript file
router.post('/api/upload-text-file', upload.single('transcriptFile'), async (req, res) => {
  try {
    if (!req.file && !req.body.text) {
      return res.status(400).json({ success: false, error: 'Please upload a transcript file or provide text.' });
    }

    const result = await transcriptionService.transcribeTextFile({
      file: req.file,
      rawText: req.body.text,
      fileName: req.file ? req.file.originalname : 'transcript.txt'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /transcription/api/upload-media - Upload Audio/Video/Recording & Transcribe Speech-to-Text
router.post('/api/upload-media', upload.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No media file uploaded.' });
    }

    const language = req.body.language || 'en';
    const result = await transcriptionService.transcribeMediaFile({ file: req.file, language });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /transcription/api/generate-materials - Generate 10-Dimension Academic Study Pack
router.post('/api/generate-materials', async (req, res) => {
  try {
    const { categoryName, topicTitle, transcriptText } = req.body;
    if (!transcriptText || !transcriptText.trim()) {
      return res.status(400).json({ success: false, error: 'Transcript text is required to generate study materials.' });
    }

    const result = await transcriptionService.generateStudyMaterials({
      categoryName: categoryName || 'Computer Science',
      topicTitle: topicTitle || 'General Topic',
      transcriptText
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /transcription/api/regenerate-section - Regenerate individual academic section
router.post('/api/regenerate-section', async (req, res) => {
  try {
    const { transcriptId, sectionName, categoryName, topicTitle, transcriptText } = req.body;
    if (!sectionName) {
      return res.status(400).json({ success: false, error: 'sectionName is required.' });
    }

    if (transcriptId) {
      const result = await transcriptionService.regenerateSection(transcriptId, sectionName);
      return res.json(result);
    }

    const content = await aiService.regenerateSingleSection(
      sectionName,
      categoryName || 'Computer Science',
      topicTitle || 'General Topic',
      transcriptText || ''
    );
    res.json({ success: true, sectionName, content, data: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /transcription/api/save - Save Transcript, Notes & Update Roadmap Progress
router.post('/api/save', async (req, res) => {
  try {
    const payload = req.body;
    const saveResult = await transcriptionService.saveTranscriptAndNotes({
      ...payload,
      studentId: 'default_student'
    });
    res.json(saveResult);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /transcription/api/history - Search & Filter Lecture History
router.get('/api/history', async (req, res) => {
  try {
    const { category, topic, search } = req.query;
    const history = await transcriptionService.getTranscripts({
      categoryId: category,
      topicId: topic,
      search,
      studentId: 'default_student'
    });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /transcription/api/:id - Rename / Edit Transcript
router.put('/api/:id', async (req, res) => {
  try {
    const { title, rawText, isCompleted } = req.body;
    const updated = await transcriptionService.updateTranscript(req.params.id, { title, rawText, isCompleted });
    res.json({ success: true, transcript: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /transcription/api/:id - Delete Transcript & Linked Notes
router.delete('/api/:id', async (req, res) => {
  try {
    await transcriptionService.deleteTranscript(req.params.id);
    res.json({ success: true, message: 'Transcript and study notes deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /transcription/api/:id/delete
router.post('/api/:id/delete', async (req, res) => {
  try {
    await transcriptionService.deleteTranscript(req.params.id);
    res.json({ success: true, message: 'Transcript and study notes deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /transcription/api/delete
router.post('/api/delete', async (req, res) => {
  try {
    const id = req.body.id || req.body.transcriptId;
    if (!id) return res.status(400).json({ success: false, error: 'Transcript ID is required.' });
    await transcriptionService.deleteTranscript(id);
    res.json({ success: true, message: 'Transcript and study notes deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /transcription/:id - View Lecture Transcript & Comprehensive Study Pack
router.get('/:id', async (req, res) => {
  try {
    const data = await transcriptionService.getTranscriptWithNotes(req.params.id);
    if (!data || !data.transcript) {
      return res.status(404).render('pages/404', {
        title: 'Lecture Not Found',
        message: 'The requested lecture transcript was not found.'
      });
    }

    res.render('pages/transcription-detail', {
      title: `${data.transcript.title} - Lecture Workspace`,
      transcript: data.transcript,
      notes: data.notes || {},
      subjects: getAllSubjects(),
      activeNav: 'transcription'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', error: err });
  }
});

module.exports = router;
