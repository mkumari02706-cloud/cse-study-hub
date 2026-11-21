const fs = require('fs');
const path = require('path');
const { getSubjectById, ROOT_DIR } = require('../config/subjects');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const LIBRARY_INDEX_PATH = path.join(DATA_DIR, 'library.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadLibraryIndex() {
  if (!fs.existsSync(LIBRARY_INDEX_PATH)) {
    fs.writeFileSync(LIBRARY_INDEX_PATH, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    const raw = fs.readFileSync(LIBRARY_INDEX_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveLibraryIndex(index) {
  fs.writeFileSync(LIBRARY_INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Creates clean, filesystem-safe filename
 */
function sanitizeFilename(text) {
  return text
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

/**
 * Ensures unique filename without overwriting existing files
 */
function getUniqueFilePath(dir, baseName, extension) {
  let candidate = path.join(dir, `${baseName}${extension}`);
  if (!fs.existsSync(candidate)) return candidate;

  let counter = 2;
  while (fs.existsSync(path.join(dir, `${baseName}_v${counter}${extension}`))) {
    counter++;
  }
  return path.join(dir, `${baseName}_v${counter}${extension}`);
}

/**
 * Saves a full study pack into existing subject folders
 */
async function saveStudyPack({
  subjectId,
  unitNumber,
  unitTitle,
  topicTitle,
  lectureTitle,
  videoUrl,
  videoId,
  transcriptText,
  studyMaterials
}) {
  const subject = getSubjectById(subjectId);
  if (!subject) throw new Error(`Subject with ID "${subjectId}" not found.`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeTopic = sanitizeFilename(topicTitle || 'Lecture');
  const safeLecture = sanitizeFilename(lectureTitle || 'Topic');
  const baseFilename = `Unit${String(unitNumber).padStart(2, '0')}_${safeTopic}`;

  const savedPaths = {};

  // 1. Save Transcript in 01_Video_Transcripts
  if (transcriptText) {
    const transcriptDir = path.join(subject.fullPath, '01_Video_Transcripts');
    if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });
    
    const targetFile = getUniqueFilePath(transcriptDir, `${baseFilename}_Transcript`, '.md');
    const content = `# Video Transcript: ${lectureTitle || topicTitle}

- **Subject**: ${subject.name}
- **Unit**: Unit ${unitNumber} - ${unitTitle || ''}
- **Topic**: ${topicTitle}
- **Video URL**: ${videoUrl || 'Manual Transcript'}
- **Date Added**: ${dateStr}

---

## Transcript Content

${transcriptText}
`;
    fs.writeFileSync(targetFile, content, 'utf-8');
    savedPaths.transcript = targetFile;
  }

  // 2. Save Exam Notes in 02_Notes
  if (studyMaterials && (studyMaterials.examNotes || studyMaterials.hinglish)) {
    const notesDir = path.join(subject.fullPath, '02_Notes');
    if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });

    const targetFile = getUniqueFilePath(notesDir, `${baseFilename}_Notes`, '.md');
    const content = `# Study Notes: ${topicTitle}

- **Subject**: ${subject.name}
- **Unit**: Unit ${unitNumber} - ${unitTitle || ''}
- **Lecture**: ${lectureTitle}
- **Video**: ${videoUrl || 'N/A'}
- **Date**: ${dateStr}

---

## 📖 English Exam Notes

${studyMaterials.examNotes || '*No English exam notes generated.*'}

---

## 🇮🇳 Hinglish Conceptual Explanation

${studyMaterials.hinglish || '*No Hinglish explanation generated.*'}
`;
    fs.writeFileSync(targetFile, content, 'utf-8');
    savedPaths.notes = targetFile;
  }

  // 3. Save Questions in 05_Important_Questions
  if (studyMaterials && studyMaterials.importantQuestions) {
    const qDir = path.join(subject.fullPath, '05_Important_Questions');
    if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });

    const targetFile = getUniqueFilePath(qDir, `${baseFilename}_Questions`, '.md');
    const content = `# Important Questions: ${topicTitle}

- **Subject**: ${subject.name}
- **Unit**: Unit ${unitNumber} - ${unitTitle || ''}
- **Date**: ${dateStr}

---

${studyMaterials.importantQuestions}
`;
    fs.writeFileSync(targetFile, content, 'utf-8');
    savedPaths.questions = targetFile;
  }

  // 4. Save Code Examples in 06_Code_Examples (if available)
  if (studyMaterials && studyMaterials.codeExamples) {
    const codeDir = path.join(subject.fullPath, '06_Code_Examples');
    if (!fs.existsSync(codeDir)) fs.mkdirSync(codeDir, { recursive: true });

    const targetFile = getUniqueFilePath(codeDir, `${baseFilename}_Code`, '.md');
    const content = `# Practical Code & Dry-Run: ${topicTitle}

- **Subject**: ${subject.name}
- **Unit**: Unit ${unitNumber} - ${unitTitle || ''}
- **Date**: ${dateStr}

---

${studyMaterials.codeExamples}
`;
    fs.writeFileSync(targetFile, content, 'utf-8');
    savedPaths.code = targetFile;
  }

  // 5. Save Revision Material in 07_Revision
  if (studyMaterials && studyMaterials.quickRevision) {
    const revDir = path.join(subject.fullPath, '07_Revision');
    if (!fs.existsSync(revDir)) fs.mkdirSync(revDir, { recursive: true });

    const targetFile = getUniqueFilePath(revDir, `${baseFilename}_Revision`, '.md');
    const content = `# Quick Revision: ${topicTitle}

- **Subject**: ${subject.name}
- **Unit**: Unit ${unitNumber} - ${unitTitle || ''}
- **Date**: ${dateStr}

---

${studyMaterials.quickRevision}
`;
    fs.writeFileSync(targetFile, content, 'utf-8');
    savedPaths.revision = targetFile;
  }

  // Record in Library Index
  const id = `lec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const indexItem = {
    id,
    subjectId: subject.id,
    subjectName: subject.name,
    unitNumber,
    unitTitle,
    topicTitle,
    lectureTitle,
    videoUrl,
    videoId,
    createdAt: new Date().toISOString(),
    files: savedPaths,
    materials: studyMaterials
  };

  const index = loadLibraryIndex();
  index.unshift(indexItem);
  saveLibraryIndex(index);

  return indexItem;
}

/**
 * Retrieves all saved lecture entries, optionally filtered by subject or search
 */
function getLectures({ subjectId, search } = {}) {
  let items = loadLibraryIndex();

  if (subjectId) {
    items = items.filter(item => item.subjectId === subjectId);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(item =>
      (item.topicTitle && item.topicTitle.toLowerCase().includes(q)) ||
      (item.lectureTitle && item.lectureTitle.toLowerCase().includes(q)) ||
      (item.unitTitle && item.unitTitle.toLowerCase().includes(q)) ||
      (item.subjectName && item.subjectName.toLowerCase().includes(q))
    );
  }

  return items;
}

/**
 * Gets a single lecture entry by ID
 */
function getLectureById(id) {
  const items = loadLibraryIndex();
  return items.find(item => item.id === id);
}

/**
 * Updates a lecture's content safely
 */
function updateLectureContent(id, updatedMaterials) {
  const items = loadLibraryIndex();
  const item = items.find(i => i.id === id);
  if (!item) throw new Error('Lecture not found.');

  item.materials = { ...item.materials, ...updatedMaterials };
  item.updatedAt = new Date().toISOString();

  // If there's an existing notes file, update it
  if (item.files && item.files.notes && fs.existsSync(item.files.notes)) {
    const notesContent = `# Study Notes: ${item.topicTitle}

- **Subject**: ${item.subjectName}
- **Unit**: Unit ${item.unitNumber} - ${item.unitTitle || ''}
- **Lecture**: ${item.lectureTitle}
- **Updated**: ${new Date().toISOString().slice(0, 10)}

---

## 📖 English Exam Notes

${item.materials.examNotes || '*No English exam notes.*'}

---

## 🇮🇳 Hinglish Conceptual Explanation

${item.materials.hinglish || '*No Hinglish explanation.*'}
`;
    fs.writeFileSync(item.files.notes, notesContent, 'utf-8');
  }

  saveLibraryIndex(items);
  return item;
}

/**
 * Permanently deletes a saved lecture note study pack and unlinks all generated files
 */
function deleteLecture(id) {
  const items = loadLibraryIndex();
  const item = items.find(i => i.id === id);
  if (!item) {
    throw new Error(`Study note with ID "${id}" not found.`);
  }

  // Clean up all associated markdown/notes files on disk
  if (item.files && typeof item.files === 'object') {
    Object.values(item.files).forEach(filePath => {
      if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn('[FileService Delete] Could not unlink file:', filePath, err.message);
        }
      }
    });
  }

  const updatedItems = items.filter(i => i.id !== id);
  saveLibraryIndex(updatedItems);
  return { success: true, deletedId: id };
}

module.exports = {
  loadLibraryIndex,
  saveStudyPack,
  getLectures,
  getLectureById,
  updateLectureContent,
  deleteLecture,
  sanitizeFilename
};
