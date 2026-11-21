const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const aiService = require('./aiService');
const {
  addSubject,
  updateSubject,
  getSubjectById,
  getAllSubjects,
  getThemeForSubject
} = require('../config/subjects');
const progressService = require('./progressService');

/**
 * Validates and sanitizes syllabus data extracted from AI or parser.
 * Never blindly trusts generated JSON.
 */
function validateExtractedSyllabus(rawInput, fallbackSemester = 4) {
  let parsed = null;

  if (typeof rawInput === 'string') {
    let clean = rawInput.trim();
    // Strip markdown JSON fences
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      // Try to find JSON substring if extra commentary surrounded it
      const startIdx = clean.indexOf('{');
      const endIdx = clean.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
          parsed = JSON.parse(clean.substring(startIdx, endIdx + 1));
        } catch (innerErr) {
          return {
            isValid: false,
            error: `Malformed JSON returned by AI: ${parseErr.message}`
          };
        }
      } else {
        return {
          isValid: false,
          error: `Failed to parse AI syllabus JSON: ${parseErr.message}`
        };
      }
    }
  } else if (typeof rawInput === 'object' && rawInput !== null) {
    parsed = rawInput;
  } else {
    return { isValid: false, error: 'Invalid input: expected JSON string or object.' };
  }

  // Normalize semester
  let semester = parseInt(parsed.semester, 10);
  if (isNaN(semester) || semester < 1 || semester > 8) {
    semester = parseInt(fallbackSemester, 10) || 4;
  }

  // Normalize subjects array
  let rawSubjects = parsed.subjects;
  if (!Array.isArray(rawSubjects)) {
    // If the AI returned a single subject directly at root
    if (parsed.name && (parsed.units || parsed.topics)) {
      rawSubjects = [parsed];
    } else {
      return { isValid: false, error: 'Syllabus JSON must contain a "subjects" array.' };
    }
  }

  if (rawSubjects.length === 0) {
    return { isValid: false, error: 'No subjects could be detected in the syllabus.' };
  }

  const validatedSubjects = [];

  for (let sIdx = 0; sIdx < rawSubjects.length; sIdx++) {
    const rawSub = rawSubjects[sIdx];
    const name = (rawSub.name || `Subject ${sIdx + 1}`).trim();
    const code = (rawSub.code || `CS-${semester}0${sIdx + 1}`).trim().toUpperCase();
    const subSem = parseInt(rawSub.semester || semester, 10);

    const theme = getThemeForSubject(name, code);

    // Validate units
    const rawUnits = Array.isArray(rawSub.units) ? rawSub.units : [];
    const validatedUnits = [];

    rawUnits.forEach((u, uIdx) => {
      const unitNum = parseInt(u.number, 10) || (uIdx + 1);
      const unitTitle = (u.title || `Unit ${unitNum}`).trim();

      // Normalize topics to non-empty strings
      const rawTopics = Array.isArray(u.topics) ? u.topics : [];
      const topics = [];
      const seenTopics = new Set();

      rawTopics.forEach(t => {
        const cleanTopic = String(t).trim().replace(/^[\s•\-\*\d+\.\)]+/, '').trim();
        if (cleanTopic.length > 1 && !seenTopics.has(cleanTopic.toLowerCase())) {
          seenTopics.add(cleanTopic.toLowerCase());
          topics.push(cleanTopic);
        }
      });

      validatedUnits.push({
        number: unitNum,
        title: unitTitle,
        topics
      });
    });

    // Ensure at least one unit exists
    if (validatedUnits.length === 0) {
      validatedUnits.push({
        number: 1,
        title: 'Core Topics',
        topics: ['Introduction to ' + name, 'Key Principles', 'Applications']
      });
    }

    validatedSubjects.push({
      name,
      code,
      semester: subSem >= 1 && subSem <= 8 ? subSem : semester,
      icon: theme.icon,
      badge: theme.badge,
      color: theme.color,
      gradient: theme.gradient,
      description: rawSub.description || `${name} (${code}) curriculum for Semester ${subSem}.`,
      units: validatedUnits
    });
  }

  return {
    isValid: true,
    data: {
      semester,
      subjects: validatedSubjects
    }
  };
}

/**
 * Main PDF Syllabus Processing Pipeline
 */
async function processUploadedSyllabusPDF(filePath, targetSemester = null) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Uploaded PDF file not found on disk.');
  }

  const pdfBuffer = fs.readFileSync(filePath);
  let pdfText = '';
  let isScanned = false;

  try {
    const parsedPdf = await pdf(pdfBuffer);
    pdfText = (parsedPdf.text || '').trim();
  } catch (pdfErr) {
    console.warn('[Syllabus] pdf-parse warning:', pdfErr.message);
  }

  // If text is short or sparse, the PDF is likely scanned
  if (pdfText.length < 100) {
    isScanned = true;
  }

  let rawExtraction = null;
  let extractionSource = 'gemini';

  if (isScanned) {
    // For scanned PDF, use Gemini Multimodal if key configured
    if (aiService.isConfigured() && process.env.GEMINI_API_KEY) {
      try {
        rawExtraction = await aiService.extractSyllabusFromPDFBuffer(pdfBuffer, targetSemester);
      } catch (err) {
        console.warn(`[Syllabus] Scanned PDF OCR failed via Gemini (${err.message}). Falling back to heuristic extraction.`);
        rawExtraction = aiService.heuristicSyllabusParser(pdfText || `Semester ${targetSemester}\nSubject: Computer Science Foundation\nUnit 1: Fundamentals`, targetSemester);
        extractionSource = 'heuristic-fallback';
      }
    } else {
      throw new Error('This appears to be a scanned / image-only PDF. Please set your GEMINI_API_KEY in .env to enable AI Vision syllabus extraction, or upload a text-searchable PDF.');
    }
  } else {
    // Text-based PDF
    if (aiService.isConfigured()) {
      try {
        rawExtraction = await aiService.extractSyllabusFromText(pdfText, targetSemester);
      } catch (err) {
        console.warn('[Syllabus] Gemini API call failed, falling back to heuristic parser:', err.message);
        rawExtraction = aiService.heuristicSyllabusParser(pdfText, targetSemester);
        extractionSource = 'heuristic-fallback';
      }
    } else {
      // Offline fallback heuristic parser
      console.log('[Syllabus] No AI API key found. Using heuristic syllabus parser.');
      rawExtraction = aiService.heuristicSyllabusParser(pdfText, targetSemester);
      extractionSource = 'heuristic';
    }
  }

  // Validate the generated or parsed output strictly
  const validation = validateExtractedSyllabus(rawExtraction, targetSemester);
  if (!validation.isValid) {
    // If AI output was invalid JSON, attempt heuristic fallback as a safety net
    if (pdfText && pdfText.length >= 100) {
      console.warn('[Syllabus] AI output was invalid. Attempting heuristic recovery...');
      const fallbackResult = aiService.heuristicSyllabusParser(pdfText, targetSemester);
      const fallbackValidation = validateExtractedSyllabus(fallbackResult, targetSemester);
      if (fallbackValidation.isValid) {
        return {
          ...fallbackValidation.data,
          source: 'heuristic-recovery',
          warning: 'AI produced malformed data; structured curriculum was safely recovered via text analysis.'
        };
      }
    }
    throw new Error(`Syllabus validation failed: ${validation.error}`);
  }

  return {
    ...validation.data,
    source: extractionSource
  };
}

/**
 * Confirms and persists extracted subjects into the study hub
 */
function saveConfirmedSyllabus(semester, subjectsList, options = {}) {
  const allowOverwrite = Boolean(options.overwrite);
  const existingAll = getAllSubjects();
  const savedSubjects = [];
  const errors = [];

  const targetSemester = parseInt(semester, 10) || 4;

  if (!Array.isArray(subjectsList) || subjectsList.length === 0) {
    throw new Error('No subjects provided to save.');
  }

  for (const subData of subjectsList) {
    const subSem = parseInt(subData.semester || targetSemester, 10);
    const code = (subData.code || '').trim().toUpperCase();
    const name = (subData.name || '').trim();

    if (!name || !code) {
      errors.push(`Skipped invalid subject with missing name or code.`);
      continue;
    }

    // Check for existing subject
    const existing = existingAll.find(s => s.code.toUpperCase() === code && s.semester === subSem);

    if (existing) {
      if (allowOverwrite) {
        // Update existing subject
        try {
          const updated = updateSubject(existing.id, {
            name,
            code,
            semester: subSem,
            units: subData.units,
            description: subData.description
          });
          savedSubjects.push(updated);
        } catch (updateErr) {
          errors.push(`Could not update ${code}: ${updateErr.message}`);
        }
      } else {
        errors.push(`Subject "${code} - ${existing.name}" already exists in Semester ${subSem}. Confirmation is required to overwrite.`);
      }
    } else {
      // Add as new subject
      try {
        const added = addSubject({
          name,
          code,
          semester: subSem,
          units: subData.units,
          description: subData.description,
          icon: subData.icon,
          badge: subData.badge,
          color: subData.color,
          gradient: subData.gradient
        });
        savedSubjects.push(added);

        // Initialize progress tracker entry
        progressService.loadProgress();
      } catch (addErr) {
        errors.push(`Could not add ${code}: ${addErr.message}`);
      }
    }
  }

  return {
    success: savedSubjects.length > 0,
    savedCount: savedSubjects.length,
    savedSubjects,
    errors
  };
}

module.exports = {
  validateExtractedSyllabus,
  processUploadedSyllabusPDF,
  saveConfirmedSyllabus
};
