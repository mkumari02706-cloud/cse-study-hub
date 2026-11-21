const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { subjects, getAllSubjects, getSubjectById } = require('../config/subjects');
const fileService = require('../services/fileService');

// Library List Page
router.get('/', (req, res) => {
  const selectedSubject = req.query.subject || '';
  const searchQuery = req.query.q || '';
  const lectures = fileService.getLectures({ subjectId: selectedSubject, search: searchQuery });

  res.render('pages/library', {
    title: 'Study Library - CSE Study Hub',
    subjects: getAllSubjects(),
    lectures,
    selectedSubject,
    searchQuery,
    activeNav: 'library'
  });
});

// Single Note View Page
router.get('/:id', (req, res) => {
  const lecture = fileService.getLectureById(req.params.id);
  if (!lecture) {
    return res.status(404).render('pages/404', { title: 'Note Not Found', message: 'The requested study note does not exist.' });
  }

  const subject = getSubjectById(lecture.subjectId);

  res.render('pages/note-detail', {
    title: `${lecture.topicTitle} - Study Notes`,
    lecture,
    subject,
    activeNav: 'library'
  });
});

// API: Update Note Content
router.post('/api/:id/update', (req, res) => {
  try {
    const { materials } = req.body;
    const updated = fileService.updateLectureContent(req.params.id, materials);
    res.json({ success: true, lecture: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /library/api/:id - Delete study note and associated files
router.delete('/api/:id', (req, res) => {
  try {
    const result = fileService.deleteLecture(req.params.id);
    res.json({ success: true, message: 'Study note and generated files deleted successfully.', result });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /library/api/:id/delete
router.post('/api/:id/delete', (req, res) => {
  try {
    const result = fileService.deleteLecture(req.params.id);
    res.json({ success: true, message: 'Study note and generated files deleted successfully.', result });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// POST /library/api/delete
router.post('/api/delete', (req, res) => {
  try {
    const id = req.body.id || req.body.lectureId;
    if (!id) return res.status(400).json({ success: false, error: 'Lecture ID is required.' });
    const result = fileService.deleteLecture(id);
    res.json({ success: true, message: 'Study note and generated files deleted successfully.', result });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// Export as Markdown
router.get('/:id/export/markdown', (req, res) => {
  const lecture = fileService.getLectureById(req.params.id);
  if (!lecture) return res.status(404).send('Note not found');

  const m = lecture.materials || {};
  const mdContent = `# ${lecture.topicTitle}

- **Subject**: ${lecture.subjectName}
- **Unit**: Unit ${lecture.unitNumber} - ${lecture.unitTitle || ''}
- **Lecture**: ${lecture.lectureTitle}
- **Video Reference**: ${lecture.videoUrl || 'N/A'}
- **Date Exported**: ${new Date().toISOString().slice(0, 10)}

---

## 🇮🇳 Hinglish Conceptual Explanation

${m.hinglish || '*N/A*'}

---

## 📖 English University Exam Notes

${m.examNotes || '*N/A*'}

---

## ❓ Important Exam Questions

${m.importantQuestions || '*N/A*'}

---

## ⚡ Quick Revision & Key Points

${m.quickRevision || '*N/A*'}

${m.codeExamples ? `---

## 💻 Code Implementation & Dry Run

${m.codeExamples}
` : ''}
`;

  const filename = `${lecture.topicTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_StudyPack.md`;
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(mdContent);
});

// Export / Print View for PDF
router.get('/:id/export/print', (req, res) => {
  const lecture = fileService.getLectureById(req.params.id);
  if (!lecture) return res.status(404).send('Note not found');

  const subject = getSubjectById(lecture.subjectId);
  res.render('pages/note-print', {
    title: `${lecture.topicTitle} - Exam Printout`,
    lecture,
    subject
  });
});

module.exports = router;
