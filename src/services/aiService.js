require('dotenv').config();

function getGeminiKey() {
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]/g, '');
  return clean.length > 0 ? clean : null;
}

function isConfigured() {
  return Boolean(getGeminiKey() || (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()));
}

async function callGeminiAPI(geminiKey, payload, preferredModel) {
  const cleanKey = geminiKey ? geminiKey.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]/g, '') : getGeminiKey();
  if (!cleanKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const modelsToTry = [
    preferredModel,
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest'
  ].filter((m, idx, arr) => m && typeof m === 'string' && m.trim() && arr.indexOf(m) === idx);

  let lastError = null;
  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000)
      });

      if (!res.ok) {
        const errBody = await res.text();
        let errorMsg = `Gemini API error (${res.status})`;
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.error && parsed.error.message) errorMsg = parsed.error.message;
        } catch {
          errorMsg = errBody.slice(0, 150);
        }

        if (res.status === 401) {
          throw new Error(`Google API 401 UNAUTHENTICATED: ${errorMsg}`);
        }

        lastError = new Error(`Gemini API Error: ${errorMsg}`);
        if (model !== modelsToTry[modelsToTry.length - 1]) continue;
        throw lastError;
      }

      const data = await res.json();
      const candidate = data.candidates && data.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts) {
        throw new Error('Gemini API returned an empty response.');
      }
      return candidate.content.parts.map(p => p.text).join('\n').trim();
    } catch (err) {
      lastError = err;
      if (err.message && err.message.includes('401 UNAUTHENTICATED')) throw err;
      if (model !== modelsToTry[modelsToTry.length - 1]) continue;
      throw err;
    }
  }
  throw lastError || new Error('All Gemini models failed.');
}

async function callLLM(systemInstruction, userPrompt, jsonMode = false, preferredModel = null) {
  const geminiKey = getGeminiKey();
  const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();

  if (geminiKey) {
    const model = preferredModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const generationConfig = { temperature: 0.2, maxOutputTokens: 8192 };
    if (jsonMode) generationConfig.responseMimeType = 'application/json';

    return await callGeminiAPI(geminiKey, {
      contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
      generationConfig
    }, model);
  }

  if (openaiKey) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const bodyPayload = {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    };
    if (jsonMode) bodyPayload.response_format = { type: 'json_object' };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify(bodyPayload)
    });
    if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content.trim();
  }

  throw new Error('No AI API key found. Please set GEMINI_API_KEY in your environment.');
}

async function callGeminiMultimodal(systemInstruction, userPrompt, base64Data, mimeType = 'application/pdf', jsonMode = true) {
  const geminiKey = getGeminiKey();
  if (!geminiKey) throw new Error('GEMINI_API_KEY is required for multimodal analysis.');
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const generationConfig = { temperature: 0.2, maxOutputTokens: 8192 };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';

  return await callGeminiAPI(geminiKey, {
    contents: [{
      parts: [
        { text: `${systemInstruction}\n\n${userPrompt}` },
        { inlineData: { mimeType, data: base64Data } }
      ]
    }],
    generationConfig
  }, model);
}

async function extractSyllabusFromText(syllabusText, targetSemester = null) {
  const systemPrompt = `Extract ALL subjects, course codes, units, and topics into strict JSON: {"semester": ${targetSemester || 4}, "subjects": [{"name": "...", "code": "...", "units": [{"number": 1, "title": "...", "topics": ["..."]}]}]}`;
  const safeText = syllabusText.length > 50000 ? syllabusText.slice(0, 50000) : syllabusText;
  return await callLLM(systemPrompt, `Syllabus content:\n"""\n${safeText}\n"""`, true);
}

async function extractSyllabusFromPDFBuffer(pdfBuffer, targetSemester = null) {
  const base64Data = pdfBuffer.toString('base64');
  const systemPrompt = `Extract ALL subjects, codes, semester, units, and topics from this PDF into JSON: {"semester": ${targetSemester || 4}, "subjects": [{"name": "...", "code": "...", "units": [{"number": 1, "title": "...", "topics": ["..."]}]}]}`;
  return await callGeminiMultimodal(systemPrompt, 'Extract syllabus JSON.', base64Data, 'application/pdf');
}

function heuristicSyllabusParser(rawText, targetSemester = null) {
  const detectedSemester = parseInt(targetSemester, 10) || 4;
  return {
    semester: detectedSemester,
    subjects: [{
      name: 'Extracted Syllabus Subject',
      code: `CS-${detectedSemester}01`,
      units: [{ number: 1, title: 'Foundational Concepts', topics: ['Introduction and Overview', 'Core Architecture'] }]
    }]
  };
}

async function generateHinglish(subjectName, topicName, transcript, model = 'gemini-3.5-flash-lite') {
  const systemPrompt = `You are an expert Computer Science professor explaining concepts to Indian engineering students in clear, natural Hinglish (Hindi + English mix). Base explanations strictly on the transcript. Format in Markdown.`;
  return callLLM(systemPrompt, `Subject: ${subjectName}\nTopic: ${topicName}\n\nTranscript:\n"""\n${transcript.slice(0, 15000)}\n"""`, false, model);
}

async function generateExamNotes(subjectName, topicName, transcript, model = 'gemini-3.8-flash') {
  const systemPrompt = `You are a university examiner. Generate comprehensive, high-scoring academic exam notes in formal English with definitions, working principles, advantages/limitations, and exam tips in Markdown.`;
  return callLLM(systemPrompt, `Subject: ${subjectName}\nTopic: ${topicName}\n\nTranscript:\n"""\n${transcript.slice(0, 15000)}\n"""`, false, model);
}

async function generateImportantQuestions(subjectName, topicName, transcript, model = 'gemini-flash-lite-latest') {
  const systemPrompt = `You are a university paper-setter. Generate 2-Mark, 5-Mark, and 10-Mark exam questions with concise model answer outlines based on the transcript.`;
  return callLLM(systemPrompt, `Subject: ${subjectName}\nTopic: ${topicName}\n\nTranscript:\n"""\n${transcript.slice(0, 15000)}\n"""`, false, model);
}

async function generateQuickRevision(subjectName, topicName, transcript, model = 'gemini-3.5-flash-lite') {
  const systemPrompt = `Create a last-minute revision sheet: 60-Second Summary, Comparison Table, Essential Formulas/Complexities, and Memory Hooks in Markdown.`;
  return callLLM(systemPrompt, `Subject: ${subjectName}\nTopic: ${topicName}\n\nTranscript:\n"""\n${transcript.slice(0, 15000)}\n"""`, false, model);
}

async function generateCodeExamples(subjectName, topicName, transcript, model = 'gemini-3.8-flash') {
  const systemPrompt = `Provide clean, compilable code examples relevant to the topic with comments, step-by-step logic, dry run table, output, and complexity analysis in Markdown.`;
  return callLLM(systemPrompt, `Subject: ${subjectName}\nTopic: ${topicName}\n\nTranscript:\n"""\n${transcript.slice(0, 15000)}\n"""`, false, model);
}

async function generateFullStudyPack(subjectName, topicName, transcript, includeCode = true) {
  if (!isConfigured()) {
    throw new Error('API key not configured. Please set GEMINI_API_KEY in your environment.');
  }

  const results = {};
  const promises = [
    generateHinglish(subjectName, topicName, transcript, 'gemini-3.5-flash-lite')
      .then(res => { results.hinglish = res; })
      .catch(err => { results.hinglish = `*Error generating Hinglish notes: ${err.message}*`; }),

    generateExamNotes(subjectName, topicName, transcript, 'gemini-3.8-flash')
      .then(res => { results.examNotes = res; })
      .catch(err => { results.examNotes = `*Error generating Exam notes: ${err.message}*`; }),

    generateImportantQuestions(subjectName, topicName, transcript, 'gemini-flash-lite-latest')
      .then(res => { results.importantQuestions = res; })
      .catch(err => { results.importantQuestions = `*Error generating Questions: ${err.message}*`; }),

    generateQuickRevision(subjectName, topicName, transcript, 'gemini-3.5-flash-lite')
      .then(res => { results.quickRevision = res; })
      .catch(err => { results.quickRevision = `*Error generating Revision notes: ${err.message}*`; })
  ];

  if (includeCode) {
    promises.push(
      generateCodeExamples(subjectName, topicName, transcript, 'gemini-3.8-flash')
        .then(res => { results.codeExamples = res; })
        .catch(err => { results.codeExamples = `*Error generating Code examples: ${err.message}*`; })
    );
  } else {
    results.codeExamples = null;
  }

  await Promise.all(promises);
  return results;
}

async function generateTopicExplanation(subjectName, unitTitle, topicName, language = 'hinglish') {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured.');
  return callLLM(`Explain "${topicName}" (${subjectName} - ${unitTitle}) in ${language} in Markdown.`, `Provide a comprehensive conceptual explanation of "${topicName}".`);
}

async function generateTopicShortNotes(subjectName, unitTitle, topicName) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured.');
  return callLLM(`Generate concise university exam short notes in Markdown.`, `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}`);
}

async function generateTopicImportantQuestions(subjectName, unitTitle, topicName) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured.');
  return callLLM(`Generate 2-mark, 5-mark, and 10-mark university questions with model answers.`, `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}`);
}

async function generateTopicRevisionSummary(subjectName, unitTitle, topicName) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured.');
  return callLLM(`Generate a 60-second revision cheat sheet in Markdown.`, `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}`);
}

async function askTopicAssistant(subjectName, unitTitle, topicName, userQuestion) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured.');
  return callLLM(`You are a Computer Science Professor assisting with "${topicName}" (${subjectName} - ${unitTitle}).`, userQuestion);
}

async function extractQuestionsFromPYQ(subjectName, unitName, paperText) {
  if (!isConfigured()) throw new Error('API key not configured.');
  return callLLM(`Extract authentic questions for ${subjectName} (${unitName || 'All Units'}) from the paper text.`, paperText.slice(0, 15000));
}

async function ocrScannedPaper(pdfBuffer) {
  if (!isConfigured()) throw new Error('AI API Key is required for OCR.');
  return await callGeminiMultimodal('Extract all text and questions from this scanned exam paper.', 'OCR extract.', pdfBuffer.toString('base64'), 'application/pdf', false);
}

function heuristicQuestionParser(paperText = '') { return []; }

async function extractStructuredQuestions(subjectName, syllabusTopics = [], paperText = '') {
  if (!paperText || !paperText.trim()) return [];
  if (isConfigured()) {
    try {
      const raw = await callLLM(`Extract questions into JSON: {"questions": [{"qNum": "1", "question": "...", "marks": 5, "topic": "...", "unit": 1, "type": "Theory"}]}`, paperText.slice(0, 25000), true);
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      return Array.isArray(parsed.questions) ? parsed.questions : [];
    } catch {}
  }
  return heuristicQuestionParser(paperText, syllabusTopics);
}

async function explainCodeWithDryRun(subjectName, topicName, codeSnippet, language = 'java') {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured.');
  return callLLM(`Provide line-by-line explanation, dry run table, and complexity analysis for this ${language} code.`, codeSnippet);
}

async function answerFromPDF(pdfText, userQuestion, language = 'english') {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured.');
  return callLLM(`Answer strictly from the PDF content in ${language}.`, `PDF:\n${pdfText.slice(0, 30000)}\n\nQuestion: ${userQuestion}`);
}

async function generatePracticeQuestions(subjectName, unitTitle, topicName, count = 5) {
  if (isConfigured()) {
    try {
      const raw = await callLLM(`Generate ${count} MCQs for "${topicName}" in JSON: {"questions": [{"id": 1, "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "correctAnswer": "A", "explanation": "...", "difficultyLevel": "Medium", "relatedTopic": "${topicName}"}]}`, `Generate ${count} MCQs.`, true);
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) return parsed.questions;
    } catch {}
  }
  return [];
}

async function generateFlashcards(subjectName, unitTitle, topicName, count = 6) {
  if (isConfigured()) {
    try {
      const raw = await callLLM(`Generate ${count} flashcards for "${topicName}" in JSON: {"flashcards": [{"id": 1, "front": "...", "back": "...", "topic": "${topicName}", "difficultyLevel": "Easy", "hint": "..."}]}`, `Generate ${count} flashcards.`, true);
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      if (Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) return parsed.flashcards;
    } catch {}
  }
  return [];
}

async function transcribeMediaBuffer(mediaBuffer, mimeType = 'audio/mp3') {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is required for transcription.');
  const rawResult = await callGeminiMultimodal('Transcribe with [MM:SS] timestamps in JSON: {"timestampedText": "...", "fullText": "...", "wordCount": 100, "detectedLanguage": "en"}', 'Transcribe lecture.', mediaBuffer.toString('base64'), mimeType, true);
  try {
    const parsed = JSON.parse(rawResult);
    return { success: true, timestampedText: parsed.timestampedText || parsed.fullText, fullText: parsed.fullText || parsed.timestampedText, wordCount: parsed.wordCount || 0, detectedLanguage: parsed.detectedLanguage || 'en' };
  } catch {
    return { success: true, timestampedText: rawResult, fullText: rawResult, wordCount: rawResult.split(/\s+/).length, detectedLanguage: 'en' };
  }
}

async function generateComprehensiveLectureStudyPack(categoryName, topicTitle, transcriptText) {
  return normalizeStudyPackOutput({ lectureSummary: `Study pack for ${topicTitle} (${categoryName}).` }, categoryName, topicTitle, transcriptText);
}

async function regenerateSingleSection(sectionName, categoryName, topicTitle, transcriptText) {
  return null;
}

function normalizeStudyPackOutput(parsed = {}, categoryName = 'Computer Science', topicTitle = 'Lecture') {
  const summary = parsed.lectureSummary || parsed.shortSummary || `Study pack on ${topicTitle} (${categoryName}).`;
  return {
    lectureSummary: summary,
    shortSummary: summary,
    topicWiseNotes: parsed.topicWiseNotes || [],
    subtopicWiseNotes: parsed.subtopicWiseNotes || [],
    detailedExplanations: parsed.detailedExplanations || [],
    detailedNotes: parsed.detailedExplanations || [],
    importantDefinitions: parsed.importantDefinitions || [],
    keyDefinitions: parsed.importantDefinitions || [],
    keyConcepts: parsed.keyConcepts || [],
    importantConcepts: parsed.keyConcepts || [],
    importantPoints: parsed.importantPoints || [],
    keyTakeaways: parsed.importantPoints || [],
    realWorldExamples: parsed.realWorldExamples || [],
    solvedExamples: parsed.solvedExamples || [],
    examples: parsed.solvedExamples || [],
    importantFormulas: parsed.importantFormulas || [],
    formulas: parsed.importantFormulas || [],
    flashcards: parsed.flashcards || [],
    practiceMcqs: parsed.practiceMcqs || [],
    mcqs: parsed.practiceMcqs || [],
    mcqCorrectAnswers: parsed.mcqCorrectAnswers || [],
    mcqAnswers: parsed.mcqCorrectAnswers || [],
    mcqExplanations: parsed.mcqExplanations || [],
    shortAnswerQuestions: parsed.shortAnswerQuestions || [],
    longAnswerQuestions: parsed.longAnswerQuestions || [],
    importantQuestions: parsed.longAnswerQuestions || [],
    interviewQuestions: parsed.interviewQuestions || [],
    vivaQuestions: parsed.vivaQuestions || [],
    previousYearQuestions: parsed.previousYearQuestions || [],
    pyqMapping: parsed.previousYearQuestions || [],
    pyqTopicMapping: parsed.pyqTopicMapping || [],
    faqs: parsed.faqs || [],
    examOrientedNotes: parsed.examOrientedNotes || [],
    quickRevisionNotes: parsed.quickRevisionNotes || [],
    revisionNotes: parsed.quickRevisionNotes || [],
    practiceTests: parsed.practiceTests || []
  };
}

function generateFallbackLectureStudyPack(categoryName, topicTitle, transcriptText) {
  return normalizeStudyPackOutput({ lectureSummary: `Study pack for ${topicTitle}.` }, categoryName, topicTitle, transcriptText);
}

async function analyzeNoticeDocument({ text = '', buffer = null, mimeType = 'application/pdf', filename = '' }) {
  return { rawText: text, extracted: heuristicNoticeParser(text, filename) };
}

function heuristicNoticeParser(rawText = '', filename = '') {
  return {
    universityName: 'University',
    semester: 3,
    noticeType: 'General Notice',
    noticeDate: new Date().toISOString().slice(0, 10),
    title: filename || 'Academic Notice',
    examinationDates: { start: null, end: null },
    timetable: [],
    practicalDates: [],
    internalDates: [],
    assignmentDeadlines: [],
    holidays: [],
    registrationDeadlines: [],
    resultAnnouncements: [],
    academicDeadlines: []
  };
}

module.exports = {
  isConfigured,
  callLLM,
  callGeminiMultimodal,
  extractSyllabusFromText,
  extractSyllabusFromPDFBuffer,
  heuristicSyllabusParser,
  generateHinglish,
  generateExamNotes,
  generateImportantQuestions,
  generateQuickRevision,
  generateCodeExamples,
  generateFullStudyPack,
  generateTopicExplanation,
  generateTopicShortNotes,
  generateTopicImportantQuestions,
  generateTopicRevisionSummary,
  askTopicAssistant,
  extractQuestionsFromPYQ,
  ocrScannedPaper,
  heuristicQuestionParser,
  extractStructuredQuestions,
  explainCodeWithDryRun,
  answerFromPDF,
  generatePracticeQuestions,
  generateFlashcards,
  transcribeMediaBuffer,
  generateComprehensiveLectureStudyPack,
  regenerateSingleSection,
  analyzeNoticeDocument,
  heuristicNoticeParser
};
