const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { getSubjectById, ROOT_DIR } = require('../config/subjects');
const aiService = require('./aiService');
const { sanitizeFilename } = require('./fileService');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const PYQ_INDEX_PATH = path.join(DATA_DIR, 'pyqs.json');

function loadPYQIndex() {
  if (!fs.existsSync(PYQ_INDEX_PATH)) {
    fs.writeFileSync(PYQ_INDEX_PATH, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    const raw = fs.readFileSync(PYQ_INDEX_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function savePYQIndex(index) {
  fs.writeFileSync(PYQ_INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Processes an uploaded question paper (PDF or TXT)
 * Features auto-fallback to Gemini Multimodal OCR for scanned papers
 */
async function processUploadedPaper({
  subjectId,
  unitNumber,
  year,
  examType,
  uploadedFile
}) {
  const subject = getSubjectById(subjectId);
  if (!subject) throw new Error(`Invalid subject ID: ${subjectId}`);

  let extractedRawText = '';
  let isScannedPaper = false;

  // Extract text depending on file format
  if (uploadedFile.mimetype === 'application/pdf') {
    const buffer = fs.readFileSync(uploadedFile.path);
    try {
      const data = await pdf(buffer);
      extractedRawText = data.text || '';
    } catch (pdfErr) {
      console.warn('[PDF Parse Warning] Digital text extraction failed, checking for scanned paper:', pdfErr.message);
    }

    // If PDF has minimal or no digital text, invoke Gemini Multimodal OCR
    if (!extractedRawText || extractedRawText.trim().length < 50) {
      if (aiService.isConfigured()) {
        try {
          console.log('[PYQ OCR] Scanned paper detected. Invoking Gemini Multimodal OCR...');
          extractedRawText = await aiService.ocrScannedPaper(buffer);
          isScannedPaper = true;
        } catch (ocrErr) {
          console.warn('[PYQ OCR] OCR failed:', ocrErr.message);
        }
      }
    }
  } else {
    // Read text file directly
    extractedRawText = fs.readFileSync(uploadedFile.path, 'utf-8');
  }

  if (!extractedRawText || !extractedRawText.trim()) {
    throw new Error('Could not extract readable text from the uploaded document. If this is a scanned document, please ensure GEMINI_API_KEY is configured in your .env for OCR extraction.');
  }

  // Target directory inside subject's 04_PYQs folder
  const safeYear = sanitizeFilename(year || 'General');
  const safeExam = sanitizeFilename(examType || 'SemesterExam');
  const paperDirName = `${safeYear}_${safeExam}`;
  const targetDir = path.join(subject.fullPath, '04_PYQs', paperDirName);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy original uploaded file to preserve it permanently
  const originalFileName = `${paperDirName}_Original${path.extname(uploadedFile.originalname)}`;
  const savedFilePath = path.join(targetDir, originalFileName);
  fs.copyFileSync(uploadedFile.path, savedFilePath);

  // Collect all topics from subject syllabus for accurate mapping
  const syllabusTopics = (subject.units || []).flatMap(u => (u.topics || []).map(t => ({
    topic: t,
    unit: u.number
  })));
  const allTopicNames = syllabusTopics.map(s => s.topic);

  // Extract structured individual questions
  const structuredQuestions = await aiService.extractStructuredQuestions(
    subject.name,
    allTopicNames,
    extractedRawText
  );

  // Generate authentic markdown questions view
  let extractedQuestions = '';
  if (structuredQuestions.length > 0) {
    extractedQuestions = structuredQuestions.map((q, idx) => {
      return `### Question ${q.qNum || (idx + 1)} (${q.marks || 5} Marks) [${q.type || 'Theory'}]\n- **Syllabus Topic**: ${q.topic || 'General'}\n- **Content**: ${q.question}\n`;
    }).join('\n---\n\n');
  } else if (aiService.isConfigured()) {
    try {
      extractedQuestions = await aiService.extractQuestionsFromPYQ(
        subject.name,
        unitNumber ? `Unit ${unitNumber}` : 'All Units',
        extractedRawText
      );
    } catch (err) {
      extractedQuestions = `*AI Question Parsing Note: ${err.message}*\n\n### Raw Extracted Text:\n\n${extractedRawText.slice(0, 4000)}`;
    }
  } else {
    extractedQuestions = `> [!NOTE]\n> Extracted Exam Paper Text:\n\n${extractedRawText.slice(0, 6000)}`;
  }

  // Save extracted questions file
  const questionsFilePath = path.join(targetDir, 'Extracted_Questions.md');
  const mdContent = `# Previous Year Exam Paper: ${subject.name} - ${year || ''} (${examType || ''})

- **Subject**: ${subject.name} (${subject.code})
- **Year / Session**: ${year || 'Unspecified'}
- **Examination Type**: ${examType || 'University Exam'}
- **Original Document**: \`${originalFileName}\`
- **Scanned OCR Processed**: ${isScannedPaper ? 'Yes' : 'No'}
- **Questions Extracted**: ${structuredQuestions.length}
- **Date Processed**: ${new Date().toISOString().slice(0, 10)}

---

## 📝 Authentically Extracted Questions

${extractedQuestions}
`;
  fs.writeFileSync(questionsFilePath, mdContent, 'utf-8');

  // Record in PYQ Index
  const id = `pyq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const pyqRecord = {
    id,
    subjectId: subject.id,
    subjectName: subject.name,
    unitNumber: unitNumber || null,
    year,
    examType,
    originalFileName,
    originalFilePath: savedFilePath,
    questionsFilePath,
    extractedQuestions,
    structuredQuestions,
    isScannedPaper,
    totalQuestions: structuredQuestions.length,
    totalMarks: structuredQuestions.reduce((sum, q) => sum + (q.marks || 0), 0),
    createdAt: new Date().toISOString()
  };

  const index = loadPYQIndex();
  index.unshift(pyqRecord);
  savePYQIndex(index);

  return pyqRecord;
}

/**
 * Process Multiple Uploaded Question Papers in a Batch
 */
async function processMultiplePapers({
  subjectId,
  unitNumber,
  year,
  examType,
  uploadedFiles = []
}) {
  const results = [];
  const errors = [];

  for (let i = 0; i < uploadedFiles.length; i++) {
    const file = uploadedFiles[i];
    try {
      // Guess year or suffix if multiple files uploaded
      const effectiveYear = uploadedFiles.length > 1 ? `${year || new Date().getFullYear()} (Paper ${i + 1})` : (year || `${new Date().getFullYear()}`);
      const record = await processUploadedPaper({
        subjectId,
        unitNumber,
        year: effectiveYear,
        examType,
        uploadedFile: file
      });
      results.push(record);
    } catch (err) {
      errors.push({ filename: file.originalname, error: err.message });
    } finally {
      if (fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  }

  return { success: results.length > 0, results, errors };
}

/**
 * Gets all PYQ records, optionally filtered by subject
 */
function getPYQs(subjectId) {
  const index = loadPYQIndex();
  if (subjectId) {
    return index.filter(p => p.subjectId === subjectId);
  }
  return index;
}

/**
 * Question Similarity & Text Normalization Helper
 */
function normalizeQuestionText(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(what|is|explain|the|and|or|of|in|to|with|for|define|differentiate|between|write|short|note|on|how|does|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateJaccardSimilarity(textA, textB) {
  const wordsA = new Set(normalizeQuestionText(textA).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeQuestionText(textB).split(' ').filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? (intersection / union) : 0;
}

/**
 * Detects Repeated Questions across all uploaded papers for a subject
 */
function detectRepeatedQuestions(subjectId) {
  const papers = getPYQs(subjectId);
  const allQuestions = [];

  papers.forEach(p => {
    const list = p.structuredQuestions && p.structuredQuestions.length > 0
      ? p.structuredQuestions
      : aiService.heuristicQuestionParser(p.extractedQuestions);

    list.forEach(q => {
      allQuestions.push({
        ...q,
        paperId: p.id,
        year: p.year,
        examType: p.examType
      });
    });
  });

  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < allQuestions.length; i++) {
    if (visited.has(i)) continue;
    const qA = allQuestions[i];
    const cluster = [qA];
    visited.add(i);

    for (let j = i + 1; j < allQuestions.length; j++) {
      if (visited.has(j)) continue;
      const qB = allQuestions[j];

      // Match if from different papers and high text similarity or same topic with high overlap
      const sim = calculateJaccardSimilarity(qA.question, qB.question);
      const sameTopic = qA.topic && qB.topic && qA.topic.toLowerCase() === qB.topic.toLowerCase();

      if (sim >= 0.55 || (sameTopic && sim >= 0.40)) {
        cluster.push(qB);
        visited.add(j);
      }
    }

    if (cluster.length >= 2) {
      // It's a repeated question across sessions/years!
      const uniqueYears = [...new Set(cluster.map(c => c.year))];
      const maxMarks = Math.max(...cluster.map(c => c.marks || 5));
      const totalMarks = cluster.reduce((sum, c) => sum + (c.marks || 5), 0);

      clusters.push({
        representativeQuestion: cluster[0].question,
        topic: cluster[0].topic || 'Core Topic',
        appearances: cluster.length,
        years: uniqueYears,
        maxMarks,
        totalMarks,
        instances: cluster.map(c => ({
          year: c.year,
          examType: c.examType,
          marks: c.marks,
          question: c.question
        }))
      });
    }
  }

  // Sort by appearance frequency and total marks descending
  clusters.sort((a, b) => b.appearances - a.appearances || b.totalMarks - a.totalMarks);
  return clusters;
}

/**
 * Topic Frequency Analysis & Unit-Wise Importance Ranking
 */
function getSubjectPYQAnalytics(subjectId) {
  const subject = getSubjectById(subjectId);
  if (!subject) return null;

  const papers = getPYQs(subjectId);
  const repeatedQuestions = detectRepeatedQuestions(subjectId);

  // Build map of all syllabus topics
  const topicMap = {};
  (subject.units || []).forEach(unit => {
    (unit.topics || []).forEach(t => {
      topicMap[t.toLowerCase()] = {
        name: t,
        unitNumber: unit.number,
        unitTitle: unit.title,
        appearances: 0,
        years: new Set(),
        totalMarks: 0,
        questions: []
      };
    });
  });

  let totalQuestionsCount = 0;
  let totalMarksCount = 0;
  const marksDistribution = { short: 0, medium: 0, long: 0 };
  const yearWiseHistory = {};

  papers.forEach(p => {
    const yKey = `${p.year} (${p.examType || 'Exam'})`;
    if (!yearWiseHistory[yKey]) {
      yearWiseHistory[yKey] = {
        year: p.year,
        examType: p.examType,
        questions: []
      };
    }

    const questionsList = (p.structuredQuestions && p.structuredQuestions.length > 0)
      ? p.structuredQuestions
      : aiService.heuristicQuestionParser(p.extractedQuestions);

    questionsList.forEach(q => {
      totalQuestionsCount++;
      const marks = q.marks || 5;
      totalMarksCount += marks;

      if (marks <= 3) marksDistribution.short++;
      else if (marks <= 7) marksDistribution.medium++;
      else marksDistribution.long++;

      yearWiseHistory[yKey].questions.push(q);

      // Match question to syllabus topic
      const qLower = (q.topic || '').toLowerCase();
      let matchedKey = null;

      if (topicMap[qLower]) {
        matchedKey = qLower;
      } else {
        // Find best match in topicMap
        for (const key of Object.keys(topicMap)) {
          if (q.question.toLowerCase().includes(key) || key.includes(qLower) || calculateJaccardSimilarity(q.question, key) > 0.4) {
            matchedKey = key;
            break;
          }
        }
      }

      if (matchedKey && topicMap[matchedKey]) {
        topicMap[matchedKey].appearances++;
        topicMap[matchedKey].years.add(p.year);
        topicMap[matchedKey].totalMarks += marks;
        topicMap[matchedKey].questions.push({
          year: p.year,
          marks,
          question: q.question
        });
      }
    });
  });

  // Calculate Evidence-Based Importance Ranking
  const allRankedTopics = Object.values(topicMap).map(t => {
    const yearsArr = Array.from(t.years);
    let level = 'LOW';
    let badgeClass = 'badge-low';

    if (t.appearances >= 3 || t.totalMarks >= 18) {
      level = 'HIGH';
      badgeClass = 'badge-high';
    } else if (t.appearances >= 1 || t.totalMarks >= 5) {
      level = 'MEDIUM';
      badgeClass = 'badge-medium';
    }

    return {
      topic: t.name,
      unitNumber: t.unitNumber,
      unitTitle: t.unitTitle,
      appearances: t.appearances,
      totalMarks: t.totalMarks,
      years: yearsArr,
      level,
      badgeClass,
      evidence: yearsArr.length > 0 
        ? `Appeared ${t.appearances}x in ${yearsArr.join(', ')} (${t.totalMarks} Total Marks)`
        : 'Not yet observed in uploaded papers'
    };
  });

  allRankedTopics.sort((a, b) => b.appearances - a.appearances || b.totalMarks - a.totalMarks);

  // Unit-wise Important Topics grouping
  const unitWiseImportance = {};
  (subject.units || []).forEach(unit => {
    unitWiseImportance[unit.number] = {
      unitNumber: unit.number,
      unitTitle: unit.title,
      topics: allRankedTopics.filter(t => t.unitNumber === unit.number)
    };
  });

  return {
    subject,
    totalPapers: papers.length,
    totalQuestions: totalQuestionsCount,
    totalMarks: totalMarksCount,
    repeatedQuestions,
    importanceRanking: allRankedTopics,
    unitWiseImportance,
    marksDistribution,
    yearWiseHistory
  };
}

/**
 * Returns all PYQs and repeated questions matching a specific topic
 */
function getRelatedPYQsForTopic(subjectId, topicName) {
  if (!subjectId || !topicName) return null;

  const papers = getPYQs(subjectId);
  const matchedQuestions = [];
  const yearsSet = new Set();
  let totalMarks = 0;

  const targetNorm = normalizeQuestionText(topicName);

  papers.forEach(p => {
    const qList = (p.structuredQuestions && p.structuredQuestions.length > 0)
      ? p.structuredQuestions
      : aiService.heuristicQuestionParser(p.extractedQuestions);

    qList.forEach(q => {
      const qNorm = normalizeQuestionText(q.question);
      const topicNorm = normalizeQuestionText(q.topic || '');
      const sim = calculateJaccardSimilarity(qNorm, targetNorm);

      if (
        topicNorm.includes(targetNorm) ||
        targetNorm.includes(topicNorm) ||
        qNorm.includes(targetNorm) ||
        sim >= 0.45
      ) {
        matchedQuestions.push({
          paperId: p.id,
          year: p.year,
          examType: p.examType,
          marks: q.marks || 5,
          question: q.question,
          type: q.type || 'Theory'
        });
        yearsSet.add(p.year);
        totalMarks += (q.marks || 5);
      }
    });
  });

  const appearances = matchedQuestions.length;
  let importance = 'NORMAL';
  if (appearances >= 3 || totalMarks >= 15) importance = 'HIGH';
  else if (appearances >= 1) importance = 'MEDIUM';

  return {
    topic: topicName,
    appearances,
    totalMarks,
    years: Array.from(yearsSet),
    importance,
    questions: matchedQuestions
  };
}

/**
 * Permanently deletes a single PYQ record and cleans up associated files on disk
 */
function deletePYQ(id) {
  const index = loadPYQIndex();
  const pyq = index.find(p => p.id === id);
  if (!pyq) {
    throw new Error(`Question paper record with ID "${id}" not found.`);
  }

  // 1. Clean up original uploaded paper file
  if (pyq.originalFilePath && fs.existsSync(pyq.originalFilePath)) {
    try {
      fs.unlinkSync(pyq.originalFilePath);
    } catch (e) {
      console.warn('[PYQ Delete] Could not unlink original paper file:', e.message);
    }
  }

  // 2. Clean up extracted questions markdown file
  if (pyq.questionsFilePath && fs.existsSync(pyq.questionsFilePath)) {
    try {
      fs.unlinkSync(pyq.questionsFilePath);
    } catch (e) {
      console.warn('[PYQ Delete] Could not unlink questions markdown:', e.message);
    }
  }

  // 3. Remove paper folder if empty
  if (pyq.questionsFilePath) {
    const paperDir = path.dirname(pyq.questionsFilePath);
    try {
      if (fs.existsSync(paperDir) && fs.readdirSync(paperDir).length === 0) {
        fs.rmdirSync(paperDir);
      }
    } catch (e) {}
  }

  // 4. Remove record from index without affecting any other records
  const updatedIndex = index.filter(p => p.id !== id);
  savePYQIndex(updatedIndex);

  return { success: true, deletedId: id };
}

module.exports = {
  loadPYQIndex,
  savePYQIndex,
  processUploadedPaper,
  processMultiplePapers,
  getPYQs,
  deletePYQ,
  detectRepeatedQuestions,
  getSubjectPYQAnalytics,
  getRelatedPYQsForTopic
};
