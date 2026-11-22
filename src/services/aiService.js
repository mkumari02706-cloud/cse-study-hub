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
        let errorReason = '';
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.error && parsed.error.message) errorMsg = parsed.error.message;
          if (parsed.error && parsed.error.details && parsed.error.details[0]) {
            errorReason = parsed.error.details[0].reason || '';
          }
        } catch (e) {
          errorMsg = errBody.slice(0, 150);
        }

        if (res.status === 401) {
          throw new Error(`Google API 401 UNAUTHENTICATED (${errorReason || 'INVALID_CREDENTIALS'}): ${errorMsg}.`);
        }

        const isModelIssue = res.status === 404 ||
          res.status === 429 ||
          res.status === 503 ||
          errorMsg.includes('not found') ||
          errorMsg.includes('not supported') ||
          errorMsg.includes('no longer available') ||
          errorMsg.includes('high demand') ||
          errorMsg.includes('quota');

        lastError = new Error(`Gemini API Error: ${errorMsg}`);
        if (isModelIssue && model !== modelsToTry[modelsToTry.length - 1]) {
          continue;
        }
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
      if (err.message && err.message.includes('401 UNAUTHENTICATED')) {
        throw err;
      }
      if (model !== modelsToTry[modelsToTry.length - 1]) {
        continue;
      }
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
    const generationConfig = {
      temperature: 0.2,
      maxOutputTokens: 8192
    };

    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    return await callGeminiAPI(geminiKey, {
      contents: [
        {
          parts: [
            { text: `${systemInstruction}\n\n${userPrompt}` }
          ]
        }
      ],
      generationConfig
    }, model);
  }

  if (openaiKey) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const url = 'https://api.openai.com/v1/chat/completions';

    const bodyPayload = {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    };

    if (jsonMode) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
  }

  throw new Error('No AI API key found. Please set GEMINI_API_KEY in your .env file to enable AI syllabus extraction.');
}

async function callGeminiMultimodal(systemInstruction, userPrompt, base64Data, mimeType = 'application/pdf', jsonMode = true) {
  const geminiKey = getGeminiKey();
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is required in .env for multimodal PDF analysis.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 8192
  };
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  return await callGeminiAPI(geminiKey, {
    contents: [
      {
        parts: [
          { text: `${systemInstruction}\n\n${userPrompt}` },
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig
  }, model);
}

async function extractSyllabusFromText(syllabusText, targetSemester = null) {
  const systemPrompt = `You are an expert academic curriculum parser and syllabus data architect for Computer Science & Engineering.
Analyze the provided university/college syllabus text and extract ALL subjects, course codes, units, and topic outlines.

CRITICAL RULES:
1. Extract every subject found in the text.
2. For each subject:
  - Identify "name" (Full Course Title, e.g. "Database Management System").
  - Identify "code" (e.g. "CS-401", "PCC-CS401", or generate appropriate code if missing like "CS-401").
  - Extract ALL units (Unit 1, 2, 3...) or modules with their unit numbers and titles.
  - Extract ALL individual topics and subtopics for each unit into a clean string array.
3. Detect or assign "semester" (Integer between 1 and 8). If the syllabus specifies the semester (e.g. "Semester IV", "4th Semester", "3rd Year 5th Sem"), use that. ${targetSemester ? `Default to semester ${targetSemester} if unspecified.` : 'Default to 4 if unspecified.'}
4. Output MUST be ONLY valid, parseable JSON matching this EXACT structure:
{
  "semester": 4,
  "subjects": [
    {
      "name": "Database Management System",
      "code": "CS-401",
      "units": [
        {
          "number": 1,
          "title": "Introduction to DBMS",
          "topics": [
            "Database Concepts",
            "DBMS Architecture",
            "Data Models"
          ]
        }
      ]
    }
  ]
}
5. Do NOT output markdown code blocks, explanatory prose, or text outside the JSON.`;

  const safeText = syllabusText.length > 50000 ? syllabusText.slice(0, 50000) : syllabusText;
  const userPrompt = `Here is the syllabus document content:\n\n"""\n${safeText}\n"""\n\nExtract and return all subjects and their units in the required JSON format.`;

  return await callLLM(systemPrompt, userPrompt, true);
}

async function extractSyllabusFromPDFBuffer(pdfBuffer, targetSemester = null) {
  const base64Data = pdfBuffer.toString('base64');
  const systemPrompt = `You are an expert academic curriculum parser. Read this university syllabus document (including scanned pages) and extract ALL subjects, codes, semester, units, and topics.
Output ONLY strict JSON matching this structure:
{
  "semester": ${targetSemester || 4},
  "subjects": [
    {
      "name": "Subject Name",
      "code": "Subject Code",
      "units": [
        {
          "number": 1,
          "title": "Unit Title",
          "topics": ["Topic 1", "Topic 2"]
        }
      ]
    }
  ]
}`;

  const userPrompt = `Extract all subjects, units, and topics from this attached PDF syllabus document into JSON format.${targetSemester ? ` Target semester is ${targetSemester}.` : ''}`;
  return await callGeminiMultimodal(systemPrompt, userPrompt, base64Data, 'application/pdf');
}

function heuristicSyllabusParser(rawText, targetSemester = null) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let detectedSemester = parseInt(targetSemester, 10);
  if (isNaN(detectedSemester) || detectedSemester < 1 || detectedSemester > 8) {
    const semMatch = rawText.match(/semester\s*[:\-]?\s*([1-8IVX]+)/i) ||
                     rawText.match(/([1-8])(?:st|nd|rd|th)\s*sem(?:ester)?/i);
    if (semMatch) {
      const val = semMatch[1].toUpperCase();
      const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
      detectedSemester = romanMap[val] || parseInt(val, 10) || 4;
    } else {
      detectedSemester = 4;
    }
  }

  const subjects = [];
  let currentSubject = null;
  let currentUnit = null;

  const subjectCodePattern = /(?:course\s*code|subject\s*code|paper\s*code|code)\s*[:\-]?\s*([A-Z0-9\-]{4,10})/i;
  const unitHeaderPattern = /^(?:unit|module|chapter)\s*([0-9IVX]+)[\s:\-–—]+(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const codeMatch = line.match(subjectCodePattern);
    const courseTitleMatch = line.match(/(?:course\s*name|course\s*title|subject\s*name|subject)\s*[:\-]?\s*([A-Za-z0-9\s,&()/-]+)/i);

    if (courseTitleMatch || (codeMatch && line.length < 80)) {
      const sName = courseTitleMatch ? courseTitleMatch[1].trim() : line.replace(subjectCodePattern, '').trim();
      const sCode = codeMatch ? codeMatch[1].trim() : `CS-${detectedSemester}0${subjects.length + 1}`;

      if (currentSubject && currentSubject.units.length === 0) {
        if (courseTitleMatch) currentSubject.name = courseTitleMatch[1].trim();
        if (codeMatch) currentSubject.code = codeMatch[1].trim();
        continue;
      }

      if (sName.length > 3) {
        currentSubject = { name: sName, code: sCode, units: [] };
        subjects.push(currentSubject);
        currentUnit = null;
        continue;
      }
    }

    const unitMatch = line.match(unitHeaderPattern);
    if (unitMatch) {
      if (!currentSubject) {
        currentSubject = { name: `Subject ${subjects.length + 1}`, code: `CS-${detectedSemester}0${subjects.length + 1}`, units: [] };
        subjects.push(currentSubject);
      }

      const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
      const rawNum = unitMatch[1].toUpperCase();
      const unitNum = romanMap[rawNum] || parseInt(rawNum, 10) || (currentSubject.units.length + 1);
      const unitTitle = unitMatch[2].trim() || `Unit ${unitNum}`;

      currentUnit = { number: unitNum, title: unitTitle, topics: [] };
      currentSubject.units.push(currentUnit);
      continue;
    }

    if (currentUnit) {
      if (line.match(/^page\s*\d+/i) || line.length > 300) continue;
      const cleanLine = line.replace(/^[\s•\-\*\d+\.\)]+/, '').trim();
      if (cleanLine.length > 3) {
        if (cleanLine.includes(',') && cleanLine.length > 40) {
          const subTopics = cleanLine.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 2);
          currentUnit.topics.push(...subTopics);
        } else {
          currentUnit.topics.push(cleanLine);
        }
      }
    }
  }

  if (subjects.length === 0) {
    const defaultUnits = [];
    let fallbackUnit = { number: 1, title: 'Foundational Concepts', topics: [] };
    lines.slice(0, 30).forEach(l => {
      const clean = l.replace(/^[\s•\-\*\d+\.\)]+/, '').trim();
      if (clean.length > 4 && clean.length < 80) fallbackUnit.topics.push(clean);
    });
    if (fallbackUnit.topics.length === 0) {
      fallbackUnit.topics = ['Introduction and Overview', 'Core Architecture', 'Key Algorithms', 'Applications'];
    }
    defaultUnits.push(fallbackUnit);
    subjects.push({ name: 'Extracted Syllabus Subject', code: `CS-${detectedSemester}01`, units: defaultUnits });
  }

  const validSubjects = subjects.filter(s => s.units && s.units.length > 0);
  return { semester: detectedSemester, subjects: validSubjects.length > 0 ? validSubjects : subjects };
}

async function generateHinglish(subjectName, topicName, transcript, model = 'gemini-3.5-flash-lite') {
  const systemPrompt = `You are an expert Computer Science professor explaining concepts to Indian engineering students in clear, natural Hinglish (Hindi + English mix).
Rules:
1. Explain step-by-step using conversational Hindi grammar with standard English technical terms (e.g., "Jab hum ek object banate hain, to heap memory allocate hoti hai...").
2. Include relatable real-world analogies suitable for Indian college students.
3. Base explanations STRICTLY on the facts presented in the lecture transcript. Do NOT invent missing facts.
4. Keep technical terminology in English.
5. Format with Markdown headers, bullet points, and bold terms.`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nPlease provide a thorough, engaging Hinglish explanation of this lecture.`;
  return callLLM(systemPrompt, userPrompt, false, model);
}

async function generateExamNotes(subjectName, topicName, transcript, model = 'gemini-3.8-flash') {
  const systemPrompt = `You are a university examiner and author of computer science textbooks.
Generate comprehensive, high-scoring academic exam notes in formal English.
Structure:
1. Formal Definitions & Theoretical Foundation.
2. Step-by-Step Mechanism / Working Principle.
3. Architectural Flow / Diagram Descriptions.
4. Key Advantages & Limitations.
5. Critical Exam Tips & Common Misconceptions.
Rules: Synthesize from provided transcript. Format in GitHub-flavored Markdown.`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nGenerate formal university-style exam notes for this topic.`;
  return callLLM(systemPrompt, userPrompt, false, model);
}

async function generateImportantQuestions(subjectName, topicName, transcript, model = 'gemini-flash-lite-latest') {
  const systemPrompt = `You are an experienced university paper-setter in Computer Science.
Generate important examination questions derived from the provided lecture transcript:
- 2-Mark Short Answer Questions (Definitions, Distinctions)
- 5-Mark Conceptual Questions (Mechanisms, Comparisons)
- 10-Mark Detailed / Analytical Questions (Architecture, Derivations, Problem Solving)
For each question, provide a concise Model Answer Outline based on the lecture.`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nGenerate targeted exam questions based on this lecture.`;
  return callLLM(systemPrompt, userPrompt, false, model);
}

async function generateQuickRevision(subjectName, topicName, transcript, model = 'gemini-3.5-flash-lite') {
  const systemPrompt = `You are an expert tutor creating last-minute revision sheets for CSE students.
Create high-yield revision material:
1. 60-Second Core Concept Summary (3-5 punchy bullets).
2. Comparison Table (if contrasting concepts exist).
3. Essential Formulas & Complexities (Time, Space, Constraints).
4. Key Memory Hooks & Mnemonics to remember exam points.`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nGenerate a concise last-minute revision summary.`;
  return callLLM(systemPrompt, userPrompt, false, model);
}

async function generateCodeExamples(subjectName, topicName, transcript, model = 'gemini-3.8-flash') {
  const systemPrompt = `You are a Senior Software Engineer and Computer Science Lab Instructor.
Provide clean, compilable, fully documented code examples relevant to the lecture topic:
1. Code Implementation with clear comments.
2. Step-by-Step Logic Breakdown.
3. Dry Run / Variable State Trace Table demonstrating sample inputs and execution.
4. Expected Output block.
5. Time and Space Complexity Analysis.`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nProvide practical, compilable code examples with a step-by-step dry run.`;
  return callLLM(systemPrompt, userPrompt, false, model);
}

async function generateFullStudyPack(subjectName, topicName, transcript, includeCode = true) {
  if (!isConfigured()) {
    throw new Error('API key not configured. Please set GEMINI_API_KEY in your .env file.');
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
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured in .env. Please configure your API key to generate AI topic explanations.');
  }

  let languageInstruction = 'Explain in formal, precise academic English.';
  if (language === 'hinglish') {
    languageInstruction = 'Explain in fluent, natural Hinglish (conversational Hindi grammar written in Latin script with standard English technical terms).';
  } else if (language === 'hindi') {
    languageInstruction = 'Explain in clear, authentic Hindi using Devanagari script for sentences, keeping core CSE technical keywords (like Process, Thread, Mutex, Deadlock, JVM, Polymorphism, etc.) in English or transliterated for clarity.';
  }

  const systemPrompt = `You are a distinguished Professor of Computer Science & Engineering.
Your goal is to provide a master-level, university-standard explanation of a specific syllabus topic for an undergraduate CSE student.
${languageInstruction}

Structure your response:
1. **Core Concept & Intuitive Meaning**: What is it, why was it invented, and what fundamental problem does it solve? Include a memorable real-world analogy.
2. **Formal Definition & Principles**: Theoretical rigor and foundational math/logic where applicable.
3. **Step-by-Step Architecture / Working Mechanism**: Detail how it operates under the hood. Include an ASCII or Markdown flow diagram where relevant.
4. **Key Variations & Types**: Sub-categories or algorithms associated with this topic.
5. **Practical Real-World Industry Application**: Where is this used in modern engineering (e.g., Linux kernel, distributed databases, cloud systems, compilers)?
6. **Key Takeaway**: One summarizing sentence to remember for exams.`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\nLanguage: ${language}\n\nProvide a comprehensive, high-scoring conceptual explanation of "${topicName}".`;
  return callLLM(systemPrompt, userPrompt);
}

async function generateTopicShortNotes(subjectName, unitTitle, topicName) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured in .env.');
  const systemPrompt = `You are a top-rank university examiner and author of computer science study guides.
Generate concise, high-yield examination short notes for this CSE syllabus topic.
Format strictly in Markdown:
1. 📌 **Quick Definition**: 2-3 precise lines preserving standard textbook terminology.
2. 🔑 **Key Principles / Salient Features**: 5-7 bullet points of must-remember facts.
3. 📊 **Key Formulas, Complexities & Bounds**: Time complexity, space complexity, mathematical constraints or state transitions.
4. ⚡ **Pros & Cons**: 3 key advantages and 3 key limitations.
5. 💡 **Pro-Exam Tip**: What examiners look for and common pitfalls students lose marks on.`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\n\nGenerate structured exam short notes.`;
  return callLLM(systemPrompt, userPrompt);
}

async function generateTopicImportantQuestions(subjectName, unitTitle, topicName) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured in .env.');
  const systemPrompt = `You are a senior university question paper setter in Computer Science.
Generate exam-ready questions for this specific syllabus topic formatted by mark weightage:
1. **2-Mark Short Answer Questions (3 questions)**: Definitions, distinctions, single-line numericals.
2. **5-Mark Conceptual Questions (2 questions)**: Mechanisms, comparison tables, step-by-step procedures.
3. **10-Mark Detailed Questions (2 questions)**: In-depth design, derivations, architecture diagrams, scenario-based problems.

For EVERY question, provide a concise **Model Answer / Answer Key Outline** outlining the exact points required for full marks.`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\n\nGenerate authentic university examination questions with model answer keys.`;
  return callLLM(systemPrompt, userPrompt);
}

async function generateTopicRevisionSummary(subjectName, unitTitle, topicName) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured in .env.');
  const systemPrompt = `You are a competitive exam tutor creating an ultra-fast last-minute revision summary for a CSE student.
Format:
1. ⏱️ **60-Second Blitz Summary**: 3 ultra-dense, punchy bullets capturing the essence.
2. 🔄 **Comparison / Matrix Table**: A Markdown comparison table contrasting this concept with its primary alternative or counterpart.
3. 🧠 **Mnemonic / Memory Hook**: A clever acronym or mental hook to recall key terms during an exam.
4. ⚠️ **Common Trap to Avoid**: The #1 mistake students make in university viva or written tests.`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\n\nGenerate a last-minute quick revision cheat sheet.`;
  return callLLM(systemPrompt, userPrompt);
}

async function askTopicAssistant(subjectName, unitTitle, topicName, userQuestion) {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured in .env.');
  const systemPrompt = `You are a supportive, knowledgeable 24/7 Computer Science Professor assisting a student studying "${topicName}" in "${subjectName}" (Unit: "${unitTitle}").
Answer the student's question clearly, thoroughly, and pedagogically.`;

  const userPrompt = `Context: ${subjectName} -> ${unitTitle} -> Topic: ${topicName}\n\nStudent Question: "${userQuestion}"\n\nPlease explain and solve this doubt clearly.`;
  return callLLM(systemPrompt, userPrompt);
}

async function extractQuestionsFromPYQ(subjectName, unitName, paperText) {
  if (!isConfigured()) throw new Error('API key not configured in .env.');
  const systemPrompt = `You are a university examination parser. Analyze the provided examination paper text and extract ONLY questions that genuinely appear in the text related to ${subjectName} (${unitName || 'All Units'}).`;
  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitName || 'General'}\n\nExam Paper Text:\n"""\n${paperText.slice(0, 15000)}\n"""`;
  return callLLM(systemPrompt, userPrompt);
}

async function ocrScannedPaper(pdfBuffer) {
  if (!isConfigured()) throw new Error('AI API Key is required for scanned PDF OCR.');
  const base64Data = pdfBuffer.toString('base64');
  const systemPrompt = `You are an expert OCR and academic examination paper transcriber. Extract ALL printable text, question numbers, sub-parts, and marks from this scanned question paper document.`;
  return await callGeminiMultimodal(systemPrompt, 'Extract all text and questions from this exam paper image/PDF.', base64Data, 'application/pdf', false);
}

function heuristicQuestionParser(paperText, syllabusTopics = []) {
  if (!paperText || typeof paperText !== 'string') return [];
  const lines = paperText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const questions = [];
  let currentQ = null;
  const qNumRegex = /^(?:Q(?:uestion)?\.?\s*(\d+[a-z]?|\([a-z0-9]+\)|[a-z]\))|(\d+[\.\)]\s*(?:\([a-z0-9]+\))?|\([a-z]\))\s+)/i;
  const marksRegex = /(?:\[|\()?\b(\d+)\s*(?:marks?\vert{}mark\vert{}m)\b(?:\]\vert{}\))?|\[(\d+)\]/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(reg\.?\s*no|time\s*:|max(?:imum)?\s*marks?|semester|b\.?tech|computer\s+science|instructions?)/i.test(line)) continue;
    const matchQ = line.match(qNumRegex);
    const hasQuestionVerb = /^(?:explain|define|differentiate|compare|what\s+is|discuss|prove|derive|write\s+a|implement|state|describe|show\s+that|calculate|find)\b/i.test(line);

    if (matchQ || (hasQuestionVerb && line.length > 20)) {
      if (currentQ && currentQ.question.length > 10) questions.push(finalizeParsedQuestion(currentQ, syllabusTopics));
      let qNum = matchQ ? (matchQ[1] || matchQ[2] || '').trim().replace(/[\.\)]$/, '') : `Q${questions.length + 1}`;
      let qText = line.replace(qNumRegex, '').trim();
      let marks = 5;
      const marksMatch = line.match(marksRegex);
      if (marksMatch) marks = parseInt(marksMatch[1] || marksMatch[2], 10) || 5;
      currentQ = { qNum: qNum || `Q${questions.length + 1}`, question: qText, marks, type: 'Theory' };
    } else if (currentQ) {
      const marksMatch = line.match(marksRegex);
      if (marksMatch && currentQ.marks === 5) currentQ.marks = parseInt(marksMatch[1] || marksMatch[2], 10) || 5;
      currentQ.question += ' ' + line;
    }
  }
  if (currentQ && currentQ.question.length > 10) questions.push(finalizeParsedQuestion(currentQ, syllabusTopics));
  return questions;
}

function finalizeParsedQuestion(qObj, syllabusTopics = []) {
  const textLower = qObj.question.toLowerCase();
  if (/program|code|implement|function|class\b|algorithm|pseudo/i.test(textLower)) qObj.type = 'Code';
  else if (/calculate|solve|find\s+the|numerical|schedule|compute/i.test(textLower)) qObj.type = 'Numerical';
  else if (/prove|derive|derivation|theorem/i.test(textLower)) qObj.type = 'Derivation';
  else if (qObj.marks <= 2 || textLower.length < 50) qObj.type = 'Short';
  else qObj.type = 'Theory';

  let bestTopic = null;
  let maxScore = 0;
  for (const topic of syllabusTopics) {
    const topicWords = topic.toLowerCase().split(/[\s,–—\-\(\)\/]+/).filter(w => w.length > 3);
    let matchCount = 0;
    for (const word of topicWords) if (textLower.includes(word)) matchCount++;
    const score = topicWords.length ? (matchCount / topicWords.length) : 0;
    if (score > maxScore && matchCount > 0) { maxScore = score; bestTopic = topic; }
  }
  qObj.topic = bestTopic || 'Core Concept';
  return qObj;
}

async function extractStructuredQuestions(subjectName, syllabusTopics = [], paperText = '') {
  if (!paperText || !paperText.trim()) return [];
  if (isConfigured()) {
    try {
      const topicSample = syllabusTopics.slice(0, 40);
      const systemPrompt = `You are a university examination parser for Computer Science. Extract ALL individual questions into JSON: {"questions": [{"qNum": "1(a)", "question": "...", "marks": 7, "topic": "...", "unit": 1, "type": "Theory"}]}. Matching topics: ${JSON.stringify(topicSample)}`;
      const raw = await callLLM(systemPrompt, `Subject: ${subjectName}\n\nExam Paper Text:\n"""\n${paperText.slice(0, 25000)}\n"""`, true);
      const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      const questionsList = Array.isArray(parsed.questions) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
      if (questionsList.length > 0) {
        return questionsList.map(q => ({
          qNum: String(q.qNum || 'Q'),
          question: String(q.question || '').trim(),
          marks: parseInt(q.marks, 10) || 5,
          topic: String(q.topic || 'General Topic').trim(),
          unit: q.unit ? parseInt(q.unit, 10) : null,
          type: q.type || 'Theory'
        }));
      }
    } catch {}
  }
  return heuristicQuestionParser(paperText, syllabusTopics);
}

async function explainCodeWithDryRun(subjectName, topicName, codeSnippet, language = 'java') {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured in .env.');
  const systemPrompt = `You are a principal software engineer and computer science tutor. Provide an overview, line-by-line breakdown, dry-run trace table, time & space complexity, edge cases, and optimized approach.`;
  return callLLM(systemPrompt, `Subject: ${subjectName}\nTopic: ${topicName}\nLanguage: ${language}\n\n\`\`\`${language}\n${codeSnippet}\n\`\`\``);
}

async function answerFromPDF(pdfText, userQuestion, language = 'english') {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is not configured in .env.');
  const systemPrompt = `Answer strictly based on the provided PDF document text in ${language}. If not found, state "This information is not covered in the provided PDF document."`;
  return callLLM(systemPrompt, `PDF Content:\n"""\n${pdfText.slice(0, 30000)}\n"""\n\nQuestion: "${userQuestion}"`);
}

async function generatePracticeQuestions(subjectName, unitTitle, topicName, count = 5) {
  if (isConfigured()) {
    try {
      const systemPrompt = `Generate ${count} university-level MCQs for "${topicName}" (${subjectName} - ${unitTitle}) in JSON: {"questions": [{"id": 1, "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "correctAnswer": "A", "explanation": "...", "difficultyLevel": "Medium", "relatedTopic": "${topicName}"}]}`;
      const raw = await callLLM(systemPrompt, `Generate ${count} MCQs.`, true);
      const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) return parsed.questions;
    } catch {}
  }
  return [
    {
      id: 1,
      question: `What is the primary conceptual principle behind ${topicName}?`,
      options: [`Provides abstraction and structured execution for ${topicName}`, 'Forces sequential processing only', 'Eliminates dynamic memory', 'Requires assembly translation'],
      correctIndex: 0,
      correctAnswer: `Provides abstraction and structured execution for ${topicName}`,
      explanation: `${topicName} provides core architectural abstraction in Computer Science.`,
      difficultyLevel: 'Easy',
      relatedTopic: topicName
    }
  ];
}

async function generateFlashcards(subjectName, unitTitle, topicName, count = 6) {
  if (isConfigured()) {
    try {
      const systemPrompt = `Generate ${count} digital flashcards for "${topicName}" (${subjectName} - ${unitTitle}) in JSON: {"flashcards": [{"id": 1, "front": "...", "back": "...", "topic": "${topicName}", "difficultyLevel": "Easy", "hint": "..."}]}`;
      const raw = await callLLM(systemPrompt, `Generate ${count} flashcards.`, true);
      const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) return parsed.flashcards;
    } catch {}
  }
  return [
    { id: 1, front: `Key Definition: What is ${topicName}?`, back: `Core architectural component in ${subjectName}.`, topic: topicName, difficultyLevel: 'Easy', hint: 'Primary definition', completed: false }
  ];
}

async function transcribeMediaBuffer(mediaBuffer, mimeType = 'audio/mp3') {
  if (!isConfigured()) throw new Error('GEMINI_API_KEY is required in .env for audio/video transcription.');
  const base64Data = mediaBuffer.toString('base64');
  const systemPrompt = `Transcribe the speech in this audio/video with [MM:SS] timestamps in JSON: {"timestampedText": "...", "fullText": "...", "wordCount": 100, "detectedLanguage": "en"}`;
  const rawResult = await callGeminiMultimodal(systemPrompt, 'Transcribe this lecture recording.', base64Data, mimeType, true);
  try {
    const parsed = JSON.parse(rawResult);
    return {
      success: true,
      timestampedText: parsed.timestampedText || parsed.fullText,
      fullText: parsed.fullText || parsed.timestampedText,
      wordCount: parsed.wordCount || 0,
      detectedLanguage: parsed.detectedLanguage || 'en'
    };
  } catch {
    return { success: true, timestampedText: rawResult, fullText: rawResult, wordCount: rawResult.split(/\s+/).length, detectedLanguage: 'en' };
  }
}

async function generateComprehensiveLectureStudyPack(categoryName, topicTitle, transcriptText) {
  const truncatedTranscript = (transcriptText || '').trim().slice(0, 20000);
  if (isConfigured()) {
    try {
      const systemPrompt = `Generate a comprehensive JSON study pack for "${topicTitle}" (${categoryName}) with lectureSummary, topicWiseNotes, subtopicWiseNotes, detailedExplanations, importantDefinitions, keyConcepts, importantPoints, realWorldExamples, solvedExamples, importantFormulas, flashcards, practiceMcqs, mcqCorrectAnswers, mcqExplanations, shortAnswerQuestions, longAnswerQuestions, interviewQuestions, vivaQuestions, previousYearQuestions, pyqTopicMapping, faqs, examOrientedNotes, quickRevisionNotes, and practiceTests.`;
      const raw = await callLLM(systemPrompt, `Course: ${categoryName}\nTopic: ${topicTitle}\n\nTranscript:\n"""\n${truncatedTranscript}\n"""`, true);
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      if (parsed && (parsed.lectureSummary || parsed.shortSummary)) {
        return normalizeStudyPackOutput(parsed, categoryName, topicTitle, transcriptText);
      }
    } catch {}
  }
  return generateFallbackLectureStudyPack(categoryName, topicTitle, transcriptText);
}

async function regenerateSingleSection(sectionName, categoryName, topicTitle, transcriptText) {
  const safeTranscript = (transcriptText || '').slice(0, 15000);
  if (isConfigured()) {
    try {
      const raw = await callLLM(`Generate JSON containing "${sectionName}" for "${topicTitle}" (${categoryName}).`, `Transcript:\n"""\n${safeTranscript}\n"""`, true);
      const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      return parsed[sectionName] || parsed;
    } catch {}
  }
  const fallback = generateFallbackLectureStudyPack(categoryName, topicTitle, safeTranscript);
  return fallback[sectionName] || null;
}

function normalizeStudyPackOutput(parsed = {}, categoryName = 'Computer Science', topicTitle = 'Lecture', transcriptText = '') {
  const summary = parsed.lectureSummary || parsed.shortSummary || `Study pack on ${topicTitle} (${categoryName}).`;
  parsed.lectureSummary = summary;
  parsed.shortSummary = summary;
  parsed.topicWiseNotes = Array.isArray(parsed.topicWiseNotes) ? parsed.topicWiseNotes : [];
  parsed.subtopicWiseNotes = Array.isArray(parsed.subtopicWiseNotes) ? parsed.subtopicWiseNotes : [];
  parsed.detailedExplanations = Array.isArray(parsed.detailedExplanations) ? parsed.detailedExplanations : [];
  parsed.detailedNotes = parsed.detailedExplanations;
  parsed.importantDefinitions = Array.isArray(parsed.importantDefinitions) ? parsed.importantDefinitions : [];
  parsed.keyDefinitions = parsed.importantDefinitions;
  parsed.keyConcepts = Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [];
  parsed.importantConcepts = parsed.keyConcepts;
  parsed.importantPoints = Array.isArray(parsed.importantPoints) ? parsed.importantPoints : [];
  parsed.keyTakeaways = parsed.importantPoints;
  parsed.realWorldExamples = Array.isArray(parsed.realWorldExamples) ? parsed.realWorldExamples : [];
  parsed.solvedExamples = Array.isArray(parsed.solvedExamples) ? parsed.solvedExamples : [];
  parsed.examples = parsed.solvedExamples;
  parsed.importantFormulas = Array.isArray(parsed.importantFormulas) ? parsed.importantFormulas : [];
  parsed.formulas = parsed.importantFormulas;
  parsed.flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
  parsed.practiceMcqs = Array.isArray(parsed.practiceMcqs) ? parsed.practiceMcqs : [];
  parsed.mcqs = parsed.practiceMcqs;
  parsed.mcqCorrectAnswers = Array.isArray(parsed.mcqCorrectAnswers) ? parsed.mcqCorrectAnswers : [];
  parsed.mcqAnswers = parsed.mcqCorrectAnswers;
  parsed.mcqExplanations = Array.isArray(parsed.mcqExplanations) ? parsed.mcqExplanations : [];
  parsed.shortAnswerQuestions = Array.isArray(parsed.shortAnswerQuestions) ? parsed.shortAnswerQuestions : [];
  parsed.longAnswerQuestions = Array.isArray(parsed.longAnswerQuestions) ? parsed.longAnswerQuestions : [];
  parsed.importantQuestions = parsed.longAnswerQuestions;
  parsed.interviewQuestions = Array.isArray(parsed.interviewQuestions) ? parsed.interviewQuestions : [];
  parsed.vivaQuestions = Array.isArray(parsed.vivaQuestions) ? parsed.vivaQuestions : [];
  parsed.previousYearQuestions = Array.isArray(parsed.previousYearQuestions) ? parsed.previousYearQuestions : [];
  parsed.pyqMapping = parsed.previousYearQuestions;
  parsed.pyqTopicMapping = Array.isArray(parsed.pyqTopicMapping) ? parsed.pyqTopicMapping : [];
  parsed.faqs = Array.isArray(parsed.faqs) ? parsed.faqs : [];
  parsed.examOrientedNotes = Array.isArray(parsed.examOrientedNotes) ? parsed.examOrientedNotes : [];
  parsed.quickRevisionNotes = Array.isArray(parsed.quickRevisionNotes) ? parsed.quickRevisionNotes : [];
  parsed.revisionNotes = parsed.quickRevisionNotes;
  parsed.practiceTests = Array.isArray(parsed.practiceTests) ? parsed.practiceTests : [];
  return parsed;
}

function generateFallbackLectureStudyPack(categoryName, topicTitle, transcriptText) {
  return normalizeStudyPackOutput({
    lectureSummary: `Study pack for ${topicTitle} (${categoryName}).`,
    importantPoints: [`Core principles of ${topicTitle}.`]
  }, categoryName, topicTitle, transcriptText);
}

async function analyzeNoticeDocument({ text = '', buffer = null, mimeType = 'application/pdf', filename = '' }) {
  let rawText = text || '';
  if (buffer && !rawText.trim() && mimeType === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      rawText = parsed.text || '';
    } catch {}
  }
  if (isConfigured()) {
    try {
      const rawJson = await callLLM('Extract university notice details into JSON with universityName, semester, noticeType, noticeDate, title, examinationDates, timetable.', `Filename: ${filename}\n\n${rawText.slice(0, 16000)}`, true);
      const parsed = JSON.parse(rawJson.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
      if (parsed) return { rawText, extracted: parsed };
    } catch {}
  }
  return { rawText, extracted: heuristicNoticeParser(rawText, filename) };
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
