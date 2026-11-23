require('dotenv').config();
const { formatMath, cleanLatexMathObject } = require('../utils/formatMath');

/**
 * Safely extracts and sanitizes the Gemini API Key from environment variables.
 * Checks GEMINI_API_KEY first, then falls back to GOOGLE_API_KEY.
 * Trims surrounding whitespace, newlines, carriage returns, and quotes.
 */
function getGeminiKey() {
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]/g, '');
  return clean.length > 0 ? clean : null;
}

/**
 * Checks whether an AI API key is configured
 */
function isConfigured() {
  return Boolean(getGeminiKey() || (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()));
}

/**
 * Robust Gemini REST API caller with automatic fallback across active models.
 * Google Gemini Developer API requires the API key to be passed via the
 * 'x-goog-api-key' header or '?key=' URL parameter.
 * It must NEVER be sent as 'Authorization: Bearer', which triggers a 401 UNAUTHENTICATED error.
 */
async function callGeminiAPI(geminiKey, payload, preferredModel) {
  const cleanKey = geminiKey ? geminiKey.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]/g, '') : getGeminiKey();
  if (!cleanKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const activeFallbackModels = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ];

  const isDeprecated = m => !m || m.includes('gemini-2.5-flash') || m.includes('gemini-2.0-flash');
  const candidate = (preferredModel && !isDeprecated(preferredModel)) ? preferredModel.trim() : null;
  const envModel = (process.env.GEMINI_MODEL && !isDeprecated(process.env.GEMINI_MODEL)) ? process.env.GEMINI_MODEL.trim() : null;

  const modelsToTry = [
    candidate,
    envModel,
    ...activeFallbackModels
  ]
    .filter(Boolean)
    .filter(m => !isDeprecated(m))
    .filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError = null;
  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const maxRetries = 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(55000) // 55s timeout per attempt to allow full single-call study pack generation
        });

        if (!res.ok) {
          const errBody = await res.text();
          let errorMsg = `Gemini API error (${res.status})`;
          let errorReason = '';
          try {
            const parsed = JSON.parse(errBody);
            if (parsed.error && parsed.error.message) {
              errorMsg = parsed.error.message;
            }
            if (parsed.error && parsed.error.details && parsed.error.details[0]) {
              errorReason = parsed.error.details[0].reason || '';
            }
          } catch (e) {
            errorMsg = errBody.slice(0, 150);
          }

          if (res.status === 401) {
            throw new Error(`Google API 401 UNAUTHENTICATED (${errorReason || 'INVALID_CREDENTIALS'}): ${errorMsg}. Verify that GEMINI_API_KEY is an active Google AI Studio key and is passed as an API key (not an OAuth Bearer token).`);
          }

          // Retry once on HTTP 503 (high demand) or 429 (rate limit / quota spike) before moving to next model
          const isTransientStatus = res.status === 503 || res.status === 429 || errorMsg.includes('high demand');
          if (isTransientStatus && attempt < maxRetries) {
            console.warn(`[AI Service] Model "${model}" returned HTTP ${res.status} (${errorMsg}). Retrying in 2 seconds...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
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
            console.warn(`[AI Service] Model "${model}" returned ${res.status} (${errorMsg}). Trying fallback model...`);
            break;
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
          throw err; // Fail fast on auth errors
        }

        const isTransientErr = err.message && (
          err.message.includes('503') ||
          err.message.includes('429') ||
          err.message.includes('high demand')
        );
        if (isTransientErr && attempt < maxRetries) {
          console.warn(`[AI Service] Model "${model}" encountered error (${err.message}). Retrying in 2 seconds...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        const isModelIssue = err.message && (
          err.message.includes('not found') ||
          err.message.includes('not supported') ||
          err.message.includes('no longer available') ||
          err.message.includes('high demand') ||
          err.message.includes('quota') ||
          err.message.includes('503') ||
          err.message.includes('429')
        );
        if (isModelIssue && model !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`[AI Service] Model "${model}" failed (${err.message}). Trying fallback model...`);
          break;
        }
        throw err;
      }
    }
  }
  throw lastError || new Error('All Gemini models failed.');
}

/**
 * Internal generic LLM caller supporting Gemini REST & OpenAI REST
 */
async function callLLM(systemInstruction, userPrompt, jsonMode = false) {
  const geminiKey = getGeminiKey();
  const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();

  if (geminiKey) {
    const model = (process.env.GEMINI_MODEL && !process.env.GEMINI_MODEL.includes('gemini-2.5-flash') && !process.env.GEMINI_MODEL.includes('gemini-2.0-flash'))
      ? process.env.GEMINI_MODEL
      : 'gemini-flash-lite-latest';
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

/**
 * Call Gemini with inline binary data (e.g. Scanned PDF base64)
 */
async function callGeminiMultimodal(systemInstruction, userPrompt, base64Data, mimeType = 'application/pdf', jsonMode = true) {
  const geminiKey = getGeminiKey();
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is required in .env for multimodal PDF analysis.');
  }

  const model = (process.env.GEMINI_MODEL && !process.env.GEMINI_MODEL.includes('gemini-2.5-flash') && !process.env.GEMINI_MODEL.includes('gemini-2.0-flash'))
    ? process.env.GEMINI_MODEL
    : 'gemini-flash-lite-latest';
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

/**
 * AI Syllabus Extractor: Text-based
 */
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

  // Truncate cleanly if oversized to fit LLM limits while retaining major sections
  const safeText = syllabusText.length > 50000 ? syllabusText.slice(0, 50000) : syllabusText;
  const userPrompt = `Here is the syllabus document content:\n\n"""\n${safeText}\n"""\n\nExtract and return all subjects and their units in the required JSON format.`;

  const rawJson = await callLLM(systemPrompt, userPrompt, true);
  return rawJson;
}

/**
 * AI Syllabus Extractor: Multimodal (for scanned / image PDFs)
 */
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
  const rawJson = await callGeminiMultimodal(systemPrompt, userPrompt, base64Data, 'application/pdf');
  return rawJson;
}

/**
 * Fallback Intelligent Regex Syllabus Parser (Offline / Local Fallback)
 * Works when no API key is configured or during network timeouts.
 */
function heuristicSyllabusParser(rawText, targetSemester = null) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let detectedSemester = parseInt(targetSemester, 10);
  if (isNaN(detectedSemester) || detectedSemester < 1 || detectedSemester > 8) {
    // Attempt to detect semester from text
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

  // Regex patterns
  const subjectCodePattern = /(?:course\s*code|subject\s*code|paper\s*code|code)\s*[:\-]?\s*([A-Z0-9\-]{4,10})/i;
  const unitHeaderPattern = /^(?:unit|module|chapter)\s*([0-9IVX]+)[\s:\-–—]+(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for subject title/code lines
    const codeMatch = line.match(subjectCodePattern);
    const courseTitleMatch = line.match(/(?:course\s*name|course\s*title|subject\s*name|subject)\s*[:\-]?\s*([A-Za-z0-9\s,&()/-]+)/i);

    if (courseTitleMatch || (codeMatch && line.length < 80)) {
      const sName = courseTitleMatch ? courseTitleMatch[1].trim() : line.replace(subjectCodePattern, '').trim();
      const sCode = codeMatch ? codeMatch[1].trim() : `CS-${detectedSemester}0${subjects.length + 1}`;

      // If currentSubject was just created and has NO units yet, merge into it
      if (currentSubject && currentSubject.units.length === 0) {
        if (courseTitleMatch) currentSubject.name = courseTitleMatch[1].trim();
        if (codeMatch) currentSubject.code = codeMatch[1].trim();
        continue;
      }

      if (sName.length > 3) {
        currentSubject = {
          name: sName,
          code: sCode,
          units: []
        };
        subjects.push(currentSubject);
        currentUnit = null;
        continue;
      }
    }

    // Check for unit headers
    const unitMatch = line.match(unitHeaderPattern);
    if (unitMatch) {
      if (!currentSubject) {
        currentSubject = {
          name: `Subject ${subjects.length + 1}`,
          code: `CS-${detectedSemester}0${subjects.length + 1}`,
          units: []
        };
        subjects.push(currentSubject);
      }

      const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
      const rawNum = unitMatch[1].toUpperCase();
      const unitNum = romanMap[rawNum] || parseInt(rawNum, 10) || (currentSubject.units.length + 1);
      const unitTitle = unitMatch[2].trim() || `Unit ${unitNum}`;

      currentUnit = {
        number: unitNum,
        title: unitTitle,
        topics: []
      };
      currentSubject.units.push(currentUnit);
      continue;
    }

    // Check for topics if inside a unit
    if (currentUnit) {
      // Ignore page numbers or header boilerplate
      if (line.match(/^page\s*\d+/i) || line.length > 300) continue;

      // Split topics by commas, semicolons, or bullet points if present
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

  // If no subject was structured, create a fallback subject from all detected units or text chunks
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

    subjects.push({
      name: 'Extracted Syllabus Subject',
      code: `CS-${detectedSemester}01`,
      units: defaultUnits
    });
  }

  const validSubjects = subjects.filter(s => s.units && s.units.length > 0);
  const finalSubjects = validSubjects.length > 0 ? validSubjects : subjects;

  return {
    semester: detectedSemester,
    subjects: finalSubjects
  };
}

/**
 * Section A: Hinglish Explanation (Lecture based)
 */
async function generateHinglish(subjectName, topicName, transcript) {
  const systemPrompt = `You are an expert Computer Science professor explaining concepts to Indian engineering students in clear, natural Hinglish (Hindi + English mix).
Rules:
1. Explain step-by-step using conversational Hindi grammar with standard English technical terms (e.g., "Jab hum ek object banate hain, to heap memory allocate hoti hai...").
2. Include relatable real-world analogies suitable for Indian college students.
3. Base explanations STRICTLY on the facts presented in the lecture transcript. Do NOT invent missing facts.
4. Keep technical terminology in English.
5. Format with Markdown headers, bullet points, and bold terms.
6. NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nPlease provide a thorough, engaging Hinglish explanation of this lecture.`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Section B: Exam Notes (University Standard English)
 */
async function generateExamNotes(subjectName, topicName, transcript) {
  const systemPrompt = `You are a university examiner and author of computer science textbooks.
Generate comprehensive, high-scoring academic exam notes in formal English.
Structure:
1. Formal Definitions & Theoretical Foundation.
2. Step-by-Step Mechanism / Working Principle.
3. Architectural Flow / Diagram Descriptions.
4. Key Advantages & Limitations.
5. Critical Exam Tips & Common Misconceptions.
Rules: Synthesize from provided transcript. Format in GitHub-flavored Markdown. NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nGenerate formal university-style exam notes for this topic.`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Section C: Important Questions
 */
async function generateImportantQuestions(subjectName, topicName, transcript) {
  const systemPrompt = `You are an experienced university paper-setter in Computer Science.
Generate important examination questions derived from the provided lecture transcript:
- 2-Mark Short Answer Questions (Definitions, Distinctions)
- 5-Mark Conceptual Questions (Mechanisms, Comparisons)
- 10-Mark Detailed / Analytical Questions (Architecture, Derivations, Problem Solving)
For each question, provide a concise Model Answer Outline based on the lecture.
Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nGenerate targeted exam questions based on this lecture.`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Section D: Quick Revision
 */
async function generateQuickRevision(subjectName, topicName, transcript) {
  const systemPrompt = `You are an expert tutor creating last-minute revision sheets for CSE students.
Create high-yield revision material:
1. 60-Second Core Concept Summary (3-5 punchy bullets).
2. Comparison Table (if contrasting concepts exist).
3. Essential Formulas & Complexities (Time, Space, Constraints).
4. Key Memory Hooks & Mnemonics to remember exam points.
Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nGenerate a concise last-minute revision summary.`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Section E: Code Examples
 */
async function generateCodeExamples(subjectName, topicName, transcript) {
  const systemPrompt = `You are a Senior Software Engineer and Computer Science Lab Instructor.
Provide clean, compilable, fully documented code examples relevant to the lecture topic:
1. Code Implementation with clear comments.
2. Step-by-Step Logic Breakdown.
3. Dry Run / Variable State Trace Table demonstrating sample inputs and execution.
4. Expected Output block.
5. Time and Space Complexity Analysis.
Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${transcript.slice(0, 15000)}\n"""\n\nProvide practical, compilable code examples with a step-by-step dry run.`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Generates all 5 study sections for a lecture in 1 single Gemini JSON API call.
 * Generates:
 * 1. hinglish: Conversational Hinglish conceptual guide for Indian CSE students.
 * 2. examNotes: Formal university standard academic exam notes.
 * 3. importantQuestions: 2-Mark, 5-Mark, and 10-Mark university exam questions with model answers.
 * 4. quickRevision: Last-minute revision sheet, formulas, and comparison table.
 * 5. codeExamples: Compilable code implementation, logic breakdown, dry-run state trace table, and complexities.
 *
 * Saves 4 API calls per lecture, preventing Free-Tier quota exhaustion (20/day limit) by increasing capacity 5x.
 */
/**
 * Robust JSON parser for single-call study pack responses.
 * Handles markdown code blocks, outermost object matching, truncated strings,
 * unclosed braces, and falls back to regex section extraction.
 */
function safeParseStudyPackJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Direct JSON parse
  try {
    return JSON.parse(rawText.trim());
  } catch (_) {}

  // 2. Strip markdown code fences (```json ... ``` or ``` ...)
  let cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // 3. Outermost JSON object boundary
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }

  // 4. Truncated JSON Repair Attempt (e.g. cut off inside string or unclosed braces)
  if (firstBrace !== -1) {
    let sub = cleaned.slice(firstBrace);
    let inString = false;
    let escaped = false;
    for (let i = 0; i < sub.length; i++) {
      const char = sub[i];
      if (char === '\\' && !escaped) {
        escaped = true;
      } else {
        if (char === '"' && !escaped) {
          inString = !inString;
        }
        escaped = false;
      }
    }
    let repaired = inString ? sub + '"' : sub;
    const stack = [];
    inString = false;
    escaped = false;
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      if (char === '\\' && !escaped) {
        escaped = true;
      } else {
        if (char === '"' && !escaped) {
          inString = !inString;
        } else if (!inString) {
          if (char === '{' || char === '[') stack.push(char);
          else if (char === '}' && stack[stack.length - 1] === '{') stack.pop();
          else if (char === ']' && stack[stack.length - 1] === '[') stack.pop();
        }
        escaped = false;
      }
    }
    while (stack.length > 0) {
      const open = stack.pop();
      repaired += open === '{' ? '}' : ']';
    }

    try {
      return JSON.parse(repaired);
    } catch (_) {}
  }

  // 5. Section-by-Section Regex Extractor Fallback
  const sections = ['hinglish', 'examNotes', 'importantQuestions', 'quickRevision', 'codeExamples'];
  const extracted = {};
  let anyFound = false;

  for (let i = 0; i < sections.length; i++) {
    const key = sections[i];
    const otherKeys = sections.filter(k => k !== key).join('|');
    const regex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?="${otherKeys}"\\s*:|"$|}\\s*$)`, 'i');
    const match = cleaned.match(regex);
    if (match && match[1]) {
      anyFound = true;
      let val = match[1].trim();
      val = val.replace(/",?\s*$/, '');
      val = val.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      extracted[key] = val;
    }
  }

  if (anyFound) {
    return extracted;
  }

  return null;
}

/**
 * Generates all 5 comprehensive study pack sections in 1 SINGLE Gemini JSON API call.
 * Saves 4 API calls per lecture, preventing Free-Tier quota exhaustion (20/day limit) by increasing capacity 5x.
 */
async function generateFullStudyPack(subjectName, topicName, transcript, includeCode = true) {
  if (!isConfigured()) {
    throw new Error('API key not configured. Please set GEMINI_API_KEY in your .env file.');
  }

  const systemPrompt = `You are a distinguished Professor of Computer Science & Engineering and curriculum expert.
Analyze the provided lecture transcript for "${topicName}" in "${subjectName}" and generate a comprehensive, high-quality, university-standard 5-part study pack for undergraduate CSE students.

You must return valid, strictly parseable JSON with the following structure:
{
  "hinglish": "Detailed Hinglish conceptual explanation in GitHub-flavored Markdown...",
  "examNotes": "Formal university exam notes in GitHub-flavored Markdown...",
  "importantQuestions": "Exam questions (2-mark, 5-mark, 10-mark) with model answer outlines in GitHub-flavored Markdown...",
  "quickRevision": "Last-minute revision bullet points, formulas, comparison table, and mnemonics in GitHub-flavored Markdown...",
  "codeExamples": ${includeCode ? '"Clean compilable code examples with line-by-line explanation, dry-run state trace table, expected output, and time/space complexity in GitHub-flavored Markdown..."' : 'null'}
}

SECTION SPECIFICATIONS:
1. "hinglish":
   - Conversational Hindi grammar written in Latin script with standard English technical terms (e.g. "Jab hum ek class define karte hain, to JVM memory allocate karta hai...").
   - Relatable real-world analogies suitable for Indian college engineering students.
   - Based STRICTLY on the facts presented in the lecture transcript.
   - Formatted with clear Markdown headings (###), bold key terms, and bullet points.

2. "examNotes":
   - Formal, precise academic English adhering to university exam marking criteria.
   - Formal definitions, theoretical foundation, step-by-step working principles, architecture/flow description, advantages, limitations, and pro exam tips.

3. "importantQuestions":
   - 2-Mark Short Answer Questions (Definitions, Distinctions).
   - 5-Mark Conceptual Questions (Mechanisms, Comparisons).
   - 10-Mark Detailed / Analytical Questions (Architecture, Problem Solving).
   - Concise Model Answer Outline for every question based on the lecture.

4. "quickRevision":
   - 60-Second Core Concept Summary (3-5 punchy bullets).
   - Markdown Comparison Table (contrasting key concepts or algorithms).
   - Essential Formulas, Complexities & Bounds (Time, Space, Constraints).
   - Key Memory Hooks & Mnemonics to recall points in exams.

5. "codeExamples":
   ${includeCode
     ? '- Clean, compilable code relevant to the lecture topic with clear comments.\n   - Step-by-step logic breakdown.\n   - Dry Run / Variable State Trace Table demonstrating sample inputs and execution.\n   - Expected Output block.\n   - Time and Space Complexity Analysis.'
     : '- Set to null (code is not required for this subject).'
   }

RULES:
- Return ONLY valid JSON matching this schema.
- Do NOT wrap JSON in explanatory text outside the JSON.
- NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const safeTranscript = (transcript || '').slice(0, 20000);
  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\n\nLecture Transcript:\n"""\n${safeTranscript}\n"""\n\nGenerate the complete 5-section study pack in the required JSON format.`;

  try {
    const rawJson = await callLLM(systemPrompt, userPrompt, true);
    const parsed = safeParseStudyPackJSON(rawJson);

    if (!parsed) {
      throw new Error('Failed to parse AI study pack JSON from LLM response.');
    }

    return cleanLatexMathObject({
      hinglish: parsed.hinglish || '*No Hinglish notes generated.*',
      examNotes: parsed.examNotes || '*No Exam notes generated.*',
      importantQuestions: parsed.importantQuestions || '*No Questions generated.*',
      quickRevision: parsed.quickRevision || '*No Revision summary generated.*',
      codeExamples: includeCode ? (parsed.codeExamples || '*No Code examples generated.*') : null
    });
  } catch (err) {
    console.warn(`[AI Service] Single-call study pack generation failed (${err.message}). Returning structured fallback pack.`);
    return {
      hinglish: `*Error generating Hinglish notes: ${err.message}*`,
      examNotes: `*Error generating Exam notes: ${err.message}*`,
      importantQuestions: `*Error generating Questions: ${err.message}*`,
      quickRevision: `*Error generating Revision notes: ${err.message}*`,
      codeExamples: includeCode ? `*Error generating Code examples: ${err.message}*` : null
    };
  }
}

/**
 * Topic AI Feature 1: Topic Concept Explanation (Direct from Syllabus)
 * Supports Hinglish, Hindi and English
 */
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
6. **Key Takeaway**: One summarizing sentence to remember for exams.
Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\nLanguage: ${language}\n\nProvide a comprehensive, high-scoring conceptual explanation of "${topicName}".`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Topic AI Feature 2: High-Yield Short Notes (Direct from Syllabus)
 */
async function generateTopicShortNotes(subjectName, unitTitle, topicName) {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured in .env.');
  }

  const systemPrompt = `You are a top-rank university examiner and author of computer science study guides.
Generate concise, high-yield examination short notes for this CSE syllabus topic.
Format strictly in Markdown:
1. 📌 **Quick Definition**: 2-3 precise lines preserving standard textbook terminology.
2. 🔑 **Key Principles / Salient Features**: 5-7 bullet points of must-remember facts.
3. 📊 **Key Formulas, Complexities & Bounds**: Time complexity, space complexity, mathematical constraints or state transitions.
4. ⚡ **Pros & Cons**: 3 key advantages and 3 key limitations.
5. 💡 **Pro-Exam Tip**: What examiners look for and common pitfalls students lose marks on.
Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\n\nGenerate structured exam short notes.`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Topic AI Feature 3: Important University Questions (Direct from Syllabus)
 */
async function generateTopicImportantQuestions(subjectName, unitTitle, topicName) {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured in .env.');
  }

  const systemPrompt = `You are a senior university question paper setter in Computer Science.
Generate exam-ready questions for this specific syllabus topic formatted by mark weightage:
1. **2-Mark Short Answer Questions (3 questions)**: Definitions, distinctions, single-line numericals.
2. **5-Mark Conceptual Questions (2 questions)**: Mechanisms, comparison tables, step-by-step procedures.
3. **10-Mark Detailed Questions (2 questions)**: In-depth design, derivations, architecture diagrams, scenario-based problems.

For EVERY question, provide a concise **Model Answer / Answer Key Outline** outlining the exact points required for full marks.
Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\n\nGenerate authentic university examination questions with model answer keys.`;
  const result = await callLLM(systemPrompt, userPrompt);
  return formatMath(result);
}

/**
 * Topic AI Feature 4: Revision Summary & Cheat Sheet (Direct from Syllabus)
 */
async function generateTopicRevisionSummary(subjectName, unitTitle, topicName) {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured in .env.');
  }

  const systemPrompt = `You are a competitive exam tutor creating an ultra-fast last-minute revision summary for a CSE student.
Format:
1. ⏱️ **60-Second Blitz Summary**: 3 ultra-dense, punchy bullets capturing the essence.
2. 🔄 **Comparison / Matrix Table**: A Markdown comparison table contrasting this concept with its primary alternative or counterpart.
3. 🧠 **Mnemonic / Memory Hook**: A clever acronym or mental hook to recall key terms during an exam.
4. ⚠️ **Common Trap to Avoid**: The #1 mistake students make in university viva or written tests.`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitTitle}\nTopic: ${topicName}\n\nGenerate a last-minute quick revision cheat sheet.`;
  return callLLM(systemPrompt, userPrompt);
}

/**
 * Topic AI Feature 5: Interactive Learning Assistance / Doubt Solver
 */
async function askTopicAssistant(subjectName, unitTitle, topicName, userQuestion) {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured in .env.');
  }

  const systemPrompt = `You are a supportive, knowledgeable 24/7 Computer Science Professor assisting a student studying "${topicName}" in "${subjectName}" (Unit: "${unitTitle}").
Answer the student's question clearly, thoroughly, and pedagogically.
Rules:
- Directly answer the question with technical precision.
- Provide simple examples, code snippets, or step-by-step walkthroughs where helpful.
- Keep the tone encouraging and academic.
- Keep technical terms in standard English.`;

  const userPrompt = `Context: ${subjectName} -> ${unitTitle} -> Topic: ${topicName}\n\nStudent Question: "${userQuestion}"\n\nPlease explain and solve this doubt clearly.`;
  return callLLM(systemPrompt, userPrompt);
}

/**
 * Extracts questions from uploaded PYQ text
 */
async function extractQuestionsFromPYQ(subjectName, unitName, paperText) {
  if (!isConfigured()) {
    throw new Error('API key not configured in .env. Please configure GEMINI_API_KEY or OPENAI_API_KEY.');
  }

  const systemPrompt = `You are a university examination parser.
Analyze the provided examination paper text and extract ONLY questions that genuinely appear in the text:
1. Do NOT invent, hallucinate or add questions not present in the text.
2. Filter questions related to ${subjectName} (${unitName || 'All Units'}).
3. Output each question with marks, question number, and topic classification.`;

  const userPrompt = `Subject: ${subjectName}\nUnit: ${unitName || 'General'}\n\nExam Paper Text:\n"""\n${paperText.slice(0, 15000)}\n"""\n\nExtract all authentic questions found in this paper.`;
  return callLLM(systemPrompt, userPrompt);
}

/**
 * OCR for scanned/image-based question papers or syllabi using Gemini Multimodal
 */
async function ocrScannedPaper(pdfBuffer) {
  if (!isConfigured()) {
    throw new Error('AI API Key is required for scanned PDF OCR.');
  }
  const base64Data = pdfBuffer.toString('base64');
  const systemPrompt = `You are an expert OCR and academic examination paper transcriber.
Extract ALL printable text, question numbers, sub-parts, and marks from this scanned question paper document.
Preserve exact question wording, headings, instructions, sections (Part A, Part B), and numerical data.
Do NOT invent or omit any questions.`;
  const userPrompt = 'Extract all text and questions from this exam paper image/PDF.';
  return await callGeminiMultimodal(systemPrompt, userPrompt, base64Data, 'application/pdf', false);
}

/**
 * Offline / Heuristic Question Parser
 * Extracts question items, marks, and maps to syllabus topics without requiring AI
 */
function heuristicQuestionParser(paperText, syllabusTopics = []) {
  if (!paperText || typeof paperText !== 'string') return [];

  const lines = paperText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const questions = [];
  let currentQ = null;

  // Regex patterns for question prefixes: Q1, Q.1, 1., 1(a), (a), etc.
  const qNumRegex = /^(?:Q(?:uestion)?\.?\s*(\d+[a-z]?|\([a-z0-9]+\)|[a-z]\))|(\d+[\.\)]\s*(?:\([a-z0-9]+\))?|\([a-z]\))\s+)/i;
  // Regex for marks: [5], (7 Marks), 10 marks, [2x5=10]
  const marksRegex = /(?:\[|\()?\b(\d+)\s*(?:marks?|mark|m)\b(?:\]|\))?|\[(\d+)\]/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip headers / boilerplate
    if (/^(reg\.?\s*no|time\s*:|max(?:imum)?\s*marks?|semester|b\.?tech|computer\s+science|instructions?)/i.test(line)) {
      continue;
    }

    const matchQ = line.match(qNumRegex);
    const hasQuestionVerb = /^(?:explain|define|differentiate|compare|what\s+is|discuss|prove|derive|write\s+a|implement|state|describe|show\s+that|calculate|find)\b/i.test(line);

    if (matchQ || (hasQuestionVerb && line.length > 20)) {
      if (currentQ && currentQ.question.length > 10) {
        questions.push(finalizeParsedQuestion(currentQ, syllabusTopics));
      }

      let qNum = matchQ ? (matchQ[1] || matchQ[2] || '').trim().replace(/[\.\)]$/, '') : `Q${questions.length + 1}`;
      let qText = line.replace(qNumRegex, '').trim();

      let marks = 5; // default
      const marksMatch = line.match(marksRegex);
      if (marksMatch) {
        marks = parseInt(marksMatch[1] || marksMatch[2], 10) || 5;
      }

      currentQ = {
        qNum: qNum || `Q${questions.length + 1}`,
        question: qText,
        marks,
        type: 'Theory'
      };
    } else if (currentQ) {
      // Check if this continuation line has marks indicator
      const marksMatch = line.match(marksRegex);
      if (marksMatch && currentQ.marks === 5) {
        currentQ.marks = parseInt(marksMatch[1] || marksMatch[2], 10) || 5;
      }
      currentQ.question += ' ' + line;
    }
  }

  if (currentQ && currentQ.question.length > 10) {
    questions.push(finalizeParsedQuestion(currentQ, syllabusTopics));
  }

  return questions;
}

function finalizeParsedQuestion(qObj, syllabusTopics = []) {
  const textLower = qObj.question.toLowerCase();

  // Classify type
  if (/program|code|implement|function|class\b|algorithm|pseudo/i.test(textLower)) {
    qObj.type = 'Code';
  } else if (/calculate|solve|find\s+the|numerical|schedule|compute/i.test(textLower)) {
    qObj.type = 'Numerical';
  } else if (/prove|derive|derivation|theorem/i.test(textLower)) {
    qObj.type = 'Derivation';
  } else if (qObj.marks <= 2 || textLower.length < 50) {
    qObj.type = 'Short';
  } else {
    qObj.type = 'Theory';
  }

  // Best match syllabus topic
  let bestTopic = null;
  let maxScore = 0;

  for (const topic of syllabusTopics) {
    const topicWords = topic.toLowerCase().split(/[\s,–—\-\(\)\/]+/).filter(w => w.length > 3);
    let matchCount = 0;
    for (const word of topicWords) {
      if (textLower.includes(word)) {
        matchCount++;
      }
    }
    const score = topicWords.length ? (matchCount / topicWords.length) : 0;
    if (score > maxScore && matchCount > 0) {
      maxScore = score;
      bestTopic = topic;
    }
  }

  qObj.topic = bestTopic || 'Core Concept';
  return qObj;
}

/**
 * Structured Question Extractor using AI with Heuristic Fallback
 */
async function extractStructuredQuestions(subjectName, syllabusTopics = [], paperText = '') {
  if (!paperText || !paperText.trim()) return [];

  if (isConfigured()) {
    try {
      const topicSample = syllabusTopics.slice(0, 40);
      const systemPrompt = `You are a university examination parser for Computer Science.
Analyze the provided exam paper text and extract ALL individual questions into a strict JSON array.
For each question:
- "qNum": Question number or subpart (e.g. "1(a)", "2", "3(b)")
- "question": Clean, complete question text
- "marks": Allocated marks as an integer (default 5 or 7 if unspecified)
- "topic": Best matching syllabus topic from this list: ${JSON.stringify(topicSample)} (or most accurate topic name)
- "unit": Estimated unit number (1 to 8, or null)
- "type": "Theory" | "Numerical" | "Code" | "Derivation" | "Short"

Return ONLY valid JSON matching:
{
  "questions": [
    {
      "qNum": "1(a)",
      "question": "Explain JVM Architecture with a neat diagram.",
      "marks": 7,
      "topic": "JVM, JRE, JDK Architecture",
      "unit": 1,
      "type": "Theory"
    }
  ]
}`;

      const userPrompt = `Subject: ${subjectName}\n\nExam Paper Text:\n"""\n${paperText.slice(0, 25000)}\n"""\n\nExtract all authentic questions into the JSON schema.`;
      const raw = await callLLM(systemPrompt, userPrompt, true);
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
    } catch (err) {
      console.warn('[AI Question Parsing Fallback to Heuristic]', err.message);
    }
  }

  return heuristicQuestionParser(paperText, syllabusTopics);
}

/**
 * Step-by-Step Code Explanation with Complexity Analysis and Execution Dry Run
 */
async function explainCodeWithDryRun(subjectName, topicName, codeSnippet, language = 'java') {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured in .env.');
  }

  const systemPrompt = `You are a principal software engineer and computer science tutor.
Provide an in-depth code explanation, algorithmic walkthrough, and line-by-line dry run for the provided code.

Structure your response:
1. **Overview & Purpose**: What this code accomplishes and the algorithmic pattern it implements.
2. **Line-by-Line Breakdown**: Explain each critical section, data structure initialization, and condition.
3. **Dry-Run Trace Table**: Provide an ASCII/Markdown table tracing variable values across sample inputs/iterations.
4. **Time & Space Complexity**:
   - Time Complexity: Best, Average, Worst case with mathematical justification.
   - Space Complexity: Auxiliary stack/heap memory explanation.
5. **Edge Cases & Potential Pitfalls**: Null inputs, overflow, off-by-one errors, thread-safety.
6. **Optimized / Alternative Approach**: How it can be improved for production.`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\nLanguage: ${language}\n\nSource Code:\n\`\`\`${language}\n${codeSnippet}\n\`\`\`\n\nPlease provide a comprehensive explanation and dry run.`;
  return callLLM(systemPrompt, userPrompt);
}

/**
 * PDF-Based Question Answering (Grounded exclusively on uploaded document)
 */
async function answerFromPDF(pdfText, userQuestion, language = 'english') {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured in .env.');
  }

  let langInstruction = 'Answer in formal English.';
  if (language === 'hinglish') {
    langInstruction = 'Answer in natural Hinglish (conversational Hindi grammar with English technical words).';
  } else if (language === 'hindi') {
    langInstruction = 'Answer in clear Hindi using Devanagari script for sentences, keeping technical terms in English.';
  }

  const systemPrompt = `You are an academic research assistant and AI tutor.
Answer the user's question STRICTLY based on the provided PDF document text.
${langInstruction}

Guidelines:
1. Ground your answer in the text. Cite specific sections, pages, or quotes where applicable.
2. If the answer cannot be found in the document, explicitly state: "This information is not covered in the provided PDF document." Do NOT hallucinate.
3. Present the answer clearly with bullet points, formulas, and structured formatting.`;

  const safeContext = pdfText.slice(0, 30000);
  const userPrompt = `PDF Document Content:\n"""\n${safeContext}\n"""\n\nStudent Question: "${userQuestion}"`;
  return callLLM(systemPrompt, userPrompt);
}

/**
 * Practice Center: Generate Multiple Choice Questions (MCQs)
 */
async function generatePracticeQuestions(subjectName, unitTitle, topicName, count = 5) {
  if (isConfigured()) {
    try {
      const systemPrompt = `You are a university examination quiz creator for Computer Science.
Generate ${count} high-quality, authentic university-level Multiple Choice Questions (MCQs) for the topic "${topicName}" (${subjectName} - ${unitTitle}).

Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).

Each question must test conceptual understanding, numerical calculation, or code analysis.
Output MUST be strict JSON matching this structure:
{
  "questions": [
    {
      "id": 1,
      "question": "What happens when ...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 1,
      "correctAnswer": "Option B",
      "explanation": "Detailed explanation of why Option B is correct and others are false.",
      "difficultyLevel": "Medium",
      "relatedTopic": "${topicName}"
    }
  ]
}`;

      const userPrompt = `Topic: ${topicName}\nSubject: ${subjectName}\nUnit: ${unitTitle}\n\nGenerate ${count} MCQs in JSON format with difficultyLevel ('Easy', 'Medium', 'Hard') and relatedTopic.`;
      const raw = await callLLM(systemPrompt, userPrompt, true);
      const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed.questions.map((q, idx) => ({
          id: q.id || idx + 1,
          question: q.question,
          options: Array.isArray(q.options) && q.options.length >= 4 ? q.options.slice(0, 4) : [
            q.options && q.options[0] ? q.options[0] : 'Option A',
            q.options && q.options[1] ? q.options[1] : 'Option B',
            q.options && q.options[2] ? q.options[2] : 'Option C',
            q.options && q.options[3] ? q.options[3] : 'Option D'
          ],
          correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
          correctAnswer: q.correctAnswer || (q.options ? q.options[q.correctIndex || 0] : 'Option A'),
          explanation: q.explanation || 'Option A is correct based on core principles.',
          difficultyLevel: q.difficultyLevel || (idx % 3 === 0 ? 'Easy' : (idx % 3 === 1 ? 'Medium' : 'Hard')),
          relatedTopic: q.relatedTopic || topicName
        }));
      }
    } catch (err) {
      console.warn('[AI MCQ Generator Fallback]', err.message);
    }
  }

  // Fallback curated questions
  return [
    {
      id: 1,
      question: `What is the primary conceptual principle behind ${topicName}?`,
      options: [
        `Provides abstraction and structured execution for ${topicName}`,
        `Forces sequential non-reentrant processing only`,
        `Eliminates dynamic memory management entirely`,
        `Requires assembly language translation`
      ],
      correctIndex: 0,
      correctAnswer: `Provides abstraction and structured execution for ${topicName}`,
      explanation: `${topicName} provides core architectural abstraction and standardized processing in modern Computer Science.`,
      difficultyLevel: 'Easy',
      relatedTopic: topicName
    },
    {
      id: 2,
      question: `Which of the following is an essential requirement or characteristic of ${topicName}?`,
      options: [
        `Deterministic behavior under state transitions`,
        `Requires unbounded recursion in all cases`,
        `Disables compiler optimization flags`,
        `Only works in single-core processors`
      ],
      correctIndex: 0,
      correctAnswer: `Deterministic behavior under state transitions`,
      explanation: `Deterministic state transitions and systematic invariant preservation are fundamental to ${topicName}.`,
      difficultyLevel: 'Medium',
      relatedTopic: topicName
    },
    {
      id: 3,
      question: `In university examinations, what is the most frequent edge-case or failure mode analyzed in ${topicName}?`,
      options: [
        `Memory overhead, race condition, or boundary condition failure`,
        `Immediate hardware bus failure`,
        `Incompatibility with ASCII characters`,
        `Excessive variable naming length`
      ],
      correctIndex: 0,
      correctAnswer: `Memory overhead, race condition, or boundary condition failure`,
      explanation: `University questions heavily emphasize boundary conditions, resource constraints, and concurrency hazards.`,
      difficultyLevel: 'Hard',
      relatedTopic: topicName
    }
  ];
}

/**
 * Practice Center: Generate Interactive Flashcards
 */
async function generateFlashcards(subjectName, unitTitle, topicName, count = 6) {
  if (isConfigured()) {
    try {
      const systemPrompt = `You are a memory retention and active-recall expert for Computer Science students.
Generate ${count} digital flashcards for the topic "${topicName}" (${subjectName} - ${unitTitle}).

Rule: NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).

Each card MUST have:
- "id": unique number
- "front": A sharp question, definition prompt, formula identifier, or diagram query.
- "back": A concise, high-impact answer with 2-3 key bullet points or formula.
- "topic": "${topicName}"
- "difficultyLevel": "Easy", "Medium", or "Hard"
- "hint": A short clue

Return ONLY strict JSON matching:
{
  "flashcards": [
    {
      "id": 1,
      "front": "What are the core invariants of ${topicName}?",
      "back": "1. Modular isolation\n2. Deterministic state transitions\n3. Bounded memory consumption",
      "topic": "${topicName}",
      "difficultyLevel": "Easy",
      "hint": "Safety and determinism guarantees"
    }
  ]
}`;

      const userPrompt = `Topic: ${topicName}\nSubject: ${subjectName}\nUnit: ${unitTitle}\n\nGenerate ${count} flashcards in JSON format with topic, difficultyLevel ('Easy', 'Medium', 'Hard'), and hint.`;
      const raw = await callLLM(systemPrompt, userPrompt, true);
      const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
        return parsed.flashcards.map((f, idx) => ({
          id: f.id || idx + 1,
          front: f.front || f.question || `What is the primary function of ${topicName}?`,
          back: f.back || f.answer || `Core computing architecture principle in ${subjectName}.`,
          topic: f.topic || topicName,
          difficultyLevel: f.difficultyLevel || f.difficulty || (idx % 3 === 0 ? 'Easy' : (idx % 3 === 1 ? 'Medium' : 'Hard')),
          hint: f.hint || 'Fundamental principle',
          completed: false
        }));
      }
    } catch (err) {
      console.warn('[AI Flashcard Generator Fallback]', err.message);
    }
  }

  // Fallback curated flashcards
  return [
    {
      id: 1,
      front: `Key Definition: What is ${topicName}?`,
      back: `Core architectural component in ${subjectName} designed to solve fundamental computational requirements with structured efficiency.`,
      topic: topicName,
      difficultyLevel: 'Easy',
      hint: 'Primary definition',
      completed: false
    },
    {
      id: 2,
      front: `What is the primary advantage and trade-off of ${topicName}?`,
      back: `Advantage: High modularity, safety, and predictable behavior.\nTrade-off: Runtime overhead or memory management considerations.`,
      topic: topicName,
      difficultyLevel: 'Medium',
      hint: 'Trade-off analysis',
      completed: false
    },
    {
      id: 3,
      front: `Exam Tip: What diagram or formula must you draw for ${topicName}?`,
      back: `Always draw the state transition / architecture diagram and clearly define input, process, and output invariants.`,
      topic: topicName,
      difficultyLevel: 'Hard',
      hint: 'Exam diagram',
      completed: false
    }
  ];
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

/**
 * Transcribes audio or video media buffer using Gemini Multimodal
 */
async function transcribeMediaBuffer(mediaBuffer, mimeType = 'audio/mp3') {
  if (!isConfigured()) {
    throw new Error('GEMINI_API_KEY is required in .env for audio/video transcription.');
  }

  const base64Data = mediaBuffer.toString('base64');
  const systemPrompt = `You are a professional academic lecture speech-to-text transcriber.
Transcribe the speech in this audio/video verbatim into accurate, coherent text with timestamps.
RULES:
1. Provide accurate timestamps in [MM:SS] format at the start of each natural paragraph or concept transition.
2. Maintain high technical precision for computer science terms, programming keywords, formulas, and acronyms.
3. If the audio is silent or unintelligible, clearly report that no audible speech was detected.
4. Do NOT fabricate or invent speech.

Return JSON in this exact structure:
{
  "timestampedText": "[00:00] First segment...\\n[00:45] Next concept...",
  "fullText": "Full continuous transcript without timestamps...",
  "wordCount": 150,
  "detectedLanguage": "en"
}`;

  const userPrompt = 'Transcribe this lecture recording with accurate timestamps and technical terminology.';

  try {
    const rawResult = await callGeminiMultimodal(systemPrompt, userPrompt, base64Data, mimeType, true);
    let parsed;
    try {
      parsed = JSON.parse(rawResult);
    } catch (e) {
      const match = rawResult.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (parsed && (parsed.fullText || parsed.timestampedText)) {
      return {
        success: true,
        timestampedText: parsed.timestampedText || parsed.fullText,
        fullText: parsed.fullText || parsed.timestampedText,
        wordCount: parsed.wordCount || (parsed.fullText ? parsed.fullText.split(/\s+/).filter(Boolean).length : 0),
        detectedLanguage: parsed.detectedLanguage || 'en'
      };
    }
    // Fallback if returned plain text
    return {
      success: true,
      timestampedText: rawResult,
      fullText: rawResult.replace(/\[\d{1,2}:\d{2}\]/g, '').trim(),
      wordCount: rawResult.split(/\s+/).filter(Boolean).length,
      detectedLanguage: 'en'
    };
  } catch (err) {
    throw new Error(`Media transcription failed: ${err.message}`);
  }
}

/**
 * Generates comprehensive lecture study materials across all 24 required academic dimensions:
 * 1. Complete Lecture Summary
 * 2. Topic-wise Notes
 * 3. Subtopic-wise Notes
 * 4. Detailed Topic Explanations
 * 5. Important Definitions
 * 6. Key Concepts
 * 7. Important Points
 * 8. Real-world Examples
 * 9. Solved Examples
 * 10. Important Formulas
 * 11. Flashcards (with front, back, topic, difficulty level)
 * 12. MCQs with four options (with question, 4 options, correct answer, explanation, difficulty, related topic)
 * 13. MCQ Correct Answers
 * 14. MCQ Explanations
 * 15. Short Answer Questions (2-3 Marks)
 * 16. Long Answer Questions (7-10 Marks)
 * 17. Interview Questions
 * 18. Viva Questions
 * 19. Previous Year Questions
 * 20. PYQ Topic Mapping
 * 21. Frequently Asked Questions
 * 22. Exam-Oriented Notes
 * 23. Quick Revision Notes
 * 24. Practice Tests
 */
async function generateComprehensiveLectureStudyPack(categoryName, topicTitle, transcriptText) {
  let effectiveTranscript = (transcriptText || '').trim();

  // Intelligent sliding-window chunking for long transcripts (> 15,000 characters)
  if (effectiveTranscript.length > 15000) {
    const CHUNK_SIZE = 10000;
    const OVERLAP = 1000;
    const chunks = [];
    for (let i = 0; i < effectiveTranscript.length; i += (CHUNK_SIZE - OVERLAP)) {
      chunks.push(effectiveTranscript.slice(i, i + CHUNK_SIZE));
      if (i + CHUNK_SIZE >= effectiveTranscript.length) break;
    }

    // Sample key lines and timestamped lines across all chronological chunks
    const chunkSummaries = chunks.map((c, idx) => {
      const tsLines = c.split('\n').filter(l => /\[\d{1,2}:\d{2}\]/.test(l)).slice(0, 8).join('\n');
      return `--- CHRONOLOGICAL SEGMENT ${idx + 1} of ${chunks.length} ---\n${tsLines || c.slice(0, 1500)}`;
    }).join('\n\n');

    const opening = effectiveTranscript.slice(0, 6000);
    const ending = effectiveTranscript.slice(-4000);
    effectiveTranscript = `${opening}\n\n=== MULTI-SEGMENT TRANSCRIPT OVERVIEW ===\n${chunkSummaries}\n\n=== CONCLUDING LECTURE DISCUSSION ===\n${ending}`;
  } else {
    effectiveTranscript = effectiveTranscript.slice(0, 20000);
  }

  const truncatedTranscript = effectiveTranscript;

  if (isConfigured()) {
    const systemPrompt = `You are a distinguished Computer Science & Engineering Professor, Technical Author, and University Curriculum Architect.
Analyze the provided lecture transcript for the course/category "${categoryName}" on topic "${topicTitle}".
Generate an exhaustive, highly structured, 24-dimension Complete Academic Study Pack directly grounded in the lecture transcript.

OUTPUT STRICTLY IN JSON FORMAT matching this schema:
{
  "lectureSummary": "Concise, high-yield structured executive summary of the lecture, core objectives, prerequisites, and learning outcomes.",
  "shortSummary": "Concise 3-4 sentence high-yield summary of what this lecture teaches.",
  "topicWiseNotes": [
    {
      "id": "topic_1",
      "title": "Clear Topic Name identified from transcript",
      "timestamp": "[00:00]",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "introduction": "Introductory motivation for this specific topic.",
      "definition": "Clear concise definition of the topic.",
      "detailedExplanation": "Thorough student-friendly conceptual explanation.",
      "importantPoints": ["Key takeaway point 1", "Key takeaway point 2"],
      "examples": [{ "title": "Practical Example", "explanation": "Step-by-step application walkthrough." }],
      "relatedQuestions": ["What is ...?", "How does ... operate?"],
      "simpleExplanation": "Student-friendly overview."
    }
  ],
  "subtopicWiseNotes": [
    {
      "id": "subtopic_1",
      "subtopicTitle": "Subtopic Name",
      "parentTopic": "Parent Topic Name",
      "timestamp": "[01:30]",
      "summary": "Specific subtopic explanation.",
      "keyTakeaways": ["Subtopic takeaway 1", "Subtopic takeaway 2"]
    }
  ],
  "detailedExplanations": [
    {
      "heading": "Section Heading",
      "content": "In-depth academic explanation with technical depth, mechanisms, and architectural considerations.",
      "timestampRef": "[02:15]",
      "takeaway": "Essential academic takeaway"
    }
  ],
  "importantDefinitions": [
    {
      "term": "Technical Term",
      "definition": "Formal rigorous academic definition.",
      "timestampRef": "[01:10]",
      "context": "Context or usage in university curriculum"
    }
  ],
  "keyConcepts": [
    {
      "concept": "Core Concept Name",
      "explanation": "Detailed explanation with theoretical and engineering implications",
      "importance": "High / Critical"
    }
  ],
  "importantPoints": [
    "High-yield point 1 students must remember for exams",
    "High-yield point 2..."
  ],
  "realWorldExamples": [
    {
      "title": "Industrial Case Study",
      "scenario": "Concrete production scenario",
      "industryApplication": "Where top tech companies use this",
      "explanation": "Detailed breakdown of the real-world workflow."
    }
  ],
  "solvedExamples": [
    {
      "title": "Solved Problem / Code Walkthrough",
      "problem": "Problem statement or examination scenario",
      "stepByStepSolution": ["Step 1...", "Step 2...", "Step 3..."],
      "codeOrProof": "Code snippet or mathematical proof",
      "keyTakeaway": "What this problem teaches"
    }
  ],
  "importantFormulas": [
    {
      "name": "Formula or Mathematical Model / Invariant",
      "formula": "e.g., T(n) = 2T(n/2) + O(n) or State Invariant",
      "explanation": "Why this formula applies and what variables represent.",
      "variables": "Description of parameters"
    }
  ],
  "flashcards": [
    {
      "id": 1,
      "front": "Clear question on the front",
      "back": "Accurate, concise answer on the back",
      "topic": "Topic Name",
      "difficultyLevel": "Easy / Medium / Hard",
      "hint": "Conceptual clue"
    }
  ],
  "practiceMcqs": [
    {
      "id": 1,
      "question": "Conceptual multiple-choice question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOption": 0,
      "explanation": "Detailed explanation of why Option A is correct and why other choices fail.",
      "difficultyLevel": "Easy / Medium / Hard",
      "relatedTopic": "Topic Name",
      "hint": "Consider the state invariant or boundary condition"
    }
  ],
  "mcqCorrectAnswers": [
    {
      "questionNumber": 1,
      "question": "Question text",
      "correctOptionLetter": "A",
      "correctOptionText": "Option A text",
      "keyRationale": "Primary reason this answer is correct."
    }
  ],
  "mcqExplanations": [
    {
      "questionNumber": 1,
      "question": "Question text",
      "correctExplanation": "Why the correct option holds.",
      "distractorAnalysis": "Why incorrect options are false."
    }
  ],
  "shortAnswerQuestions": [
    {
      "question": "2-3 mark short answer question",
      "marks": 2,
      "answer": "Concise, precise model answer.",
      "keyPoints": ["Key point 1", "Key point 2"]
    }
  ],
  "longAnswerQuestions": [
    {
      "question": "7-10 mark university descriptive question",
      "marks": 7,
      "answer": "Full structured answer model.",
      "structuralOutline": ["1. Definition", "2. Architecture Diagram", "3. Working Principle", "4. Advantages & Trade-offs"]
    }
  ],
  "interviewQuestions": [
    {
      "question": "FAANG / Startup technical interview question",
      "companyContext": "System Design / Core CS interview",
      "technicalAnswer": "Deep technical answer explaining edge cases.",
      "followUpTip": "Follow-up question or optimization to mention"
    }
  ],
  "vivaQuestions": [
    {
      "question": "Oral lab / viva exam question",
      "quickAnswer": "Direct 1-2 sentence spoken answer.",
      "examinerExpectedKeyword": "Keyword examiner is listening for"
    }
  ],
  "previousYearQuestions": [
    {
      "year": "2023 University End-Sem",
      "examName": "University Examination",
      "question": "Past examination question",
      "marks": 7,
      "solution": "Solution guideline for maximum marks",
      "frequency": "Repeated 3 times in last 5 years"
    }
  ],
  "pyqTopicMapping": [
    {
      "topicName": "Topic Name",
      "appearancesCount": 3,
      "examWeightage": "High (14 Marks Average)",
      "trendAnalysis": "Frequently asked in Section B"
    }
  ],
  "faqs": [
    {
      "question": "Frequently asked student question or doubt about this lecture",
      "answer": "Clear, direct academic response resolving the doubt.",
      "practicalScenario": "Practical context where this confusion arises"
    }
  ],
  "examOrientedNotes": [
    {
      "category": "Marking Scheme / High Scoring Strategy",
      "tip": "Specific advice on how examiners award marks and key points to highlight.",
      "commonMistakesToAvoid": "Common student pitfalls where marks are lost.",
      "highScoringStrategy": "Structure with diagrams and bullet points"
    }
  ],
  "quickRevisionNotes": [
    "High-yield bullet point for 5-minute pre-exam revision",
    "Important edge case or pitfall to avoid",
    "Key memory aid or mnemonic"
  ],
  "practiceTests": [
    {
      "testTitle": "Self-Assessment Practice Test",
      "instructions": "Answer all questions within the allocated time.",
      "durationMinutes": 30,
      "totalMarks": 20,
      "questions": [
        { "qNum": 1, "question": "Question text...", "marks": 5, "type": "Theory" }
      ]
    }
  ]
}

RULES:
1. Ground all content in the lecture transcript. Do not fabricate unrelated facts outside the curriculum.
2. Link definitions, topics, and notes to timestamps like [mm:ss] found in the transcript.
3. Automatically identify distinct topics and subtopics from the transcript.
4. Ensure ALL 24 sections are populated with meaningful, high quality content.
5. Provide at least 4 flashcards, 4 practice MCQs, 3 short answer questions, 2 long answer questions, 2 interview questions, 2 viva questions, and 3 FAQs.
6. NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬).`;

    const userPrompt = `Course/Category: ${categoryName}\nTopic: ${topicTitle}\n\nTranscript Content:\n"""\n${truncatedTranscript}\n"""\n\nGenerate the complete 24-dimension Complete Academic Study Pack JSON.`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, true);
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }
      if (parsed && (parsed.lectureSummary || parsed.shortSummary)) {
        return normalizeStudyPackOutput(parsed, categoryName, topicTitle, transcriptText);
      }
    } catch (err) {
      console.warn('[AI Service] Comprehensive lecture generation fallback:', err.message);
    }
  }

  // Heuristic / Offline fallback generator
  return generateFallbackLectureStudyPack(categoryName, topicTitle, transcriptText);
}

/**
 * Allows targeted on-demand regeneration of an individual academic section using AI
 */
async function regenerateSingleSection(sectionName, categoryName, topicTitle, transcriptText) {
  const safeTranscript = (transcriptText || '').slice(0, 15000);

  if (isConfigured()) {
    try {
      let promptInstruction = '';
      switch (sectionName) {
        case 'flashcards':
          promptInstruction = `Generate 6-8 comprehensive digital flashcards for "${topicTitle}" (${categoryName}) directly grounded in the transcript.
Output JSON schema:
{
  "flashcards": [
    {
      "id": 1,
      "front": "Question / Prompt on the front",
      "back": "Clear concise answer on the back",
      "topic": "${topicTitle}",
      "difficultyLevel": "Easy / Medium / Hard",
      "hint": "Conceptual clue"
    }
  ]
}`;
          break;
        case 'practiceMcqs':
        case 'mcqs':
          promptInstruction = `Generate 5 high-quality conceptual MCQs for "${topicTitle}" (${categoryName}) grounded in the transcript.
Output JSON schema:
{
  "practiceMcqs": [
    {
      "id": 1,
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOption": 0,
      "correctAnswer": "Option A",
      "explanation": "Detailed explanation of why Option A is correct",
      "difficultyLevel": "Easy / Medium / Hard",
      "relatedTopic": "${topicTitle}"
    }
  ]
}`;
          break;
        case 'topicWiseNotes':
          promptInstruction = `Identify and generate comprehensive topic-wise notes for "${topicTitle}" (${categoryName}) grounded in the transcript.
Output JSON schema:
{
  "topicWiseNotes": [
    {
      "id": "topic_1",
      "title": "Topic Title",
      "timestamp": "[00:00]",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "introduction": "Detailed introduction",
      "definition": "Formal rigorous definition",
      "detailedExplanation": "Thorough conceptual explanation",
      "importantPoints": ["Point 1", "Point 2"],
      "examples": [{ "title": "Example", "explanation": "Detailed walkthrough" }],
      "relatedQuestions": ["Q1", "Q2"],
      "simpleExplanation": "Student-friendly overview"
    }
  ]
}`;
          break;
        case 'importantDefinitions':
        case 'definitions':
          promptInstruction = `Extract 4-6 crucial academic definitions for "${topicTitle}" (${categoryName}) grounded in the transcript.
Output JSON schema:
{
  "importantDefinitions": [
    {
      "term": "Term",
      "definition": "Formal definition",
      "timestampRef": "[01:00]",
      "context": "Curriculum Context"
    }
  ]
}`;
          break;
        case 'solvedExamples':
        case 'examples':
          promptInstruction = `Generate 2-3 solved examples and problem walkthroughs for "${topicTitle}" (${categoryName}) grounded in the transcript.
Output JSON schema:
{
  "solvedExamples": [
    {
      "problemTitle": "Problem Title",
      "problemStatement": "Statement",
      "stepByStepSolution": ["Step 1", "Step 2"],
      "finalAnswerOrCode": "Code or final answer",
      "complexityAnalysis": "Time: O(N) | Space: O(1)"
    }
  ]
}`;
          break;
        default:
          promptInstruction = `Regenerate section "${sectionName}" for "${topicTitle}" (${categoryName}) grounded in the transcript. Output strictly in JSON format containing "${sectionName}".`;
      }

      const systemPrompt = `You are a distinguished Computer Science Professor. Generate strictly valid JSON. NEVER use \`$\` or \`$$\` LaTeX syntax. Write all mathematical expressions using clean Unicode symbols and HTML-friendly notation (e.g., Kₙ, K₃, n(n-1)/2, (n-1), ∈, ∀, ∃, ≤, ≥, →, ∧, ∨, ¬). ${promptInstruction}`;
      const userPrompt = `Course: ${categoryName}\nTopic: ${topicTitle}\n\nTranscript Content:\n"""\n${safeTranscript}\n"""\n\nGenerate section "${sectionName}" JSON now.`;

      const raw = await callLLM(systemPrompt, userPrompt, true);
      const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      return cleanLatexMathObject(parsed[sectionName] || parsed);
    } catch (err) {
      console.warn(`[AI Service] Regeneration of section "${sectionName}" fallback:`, err.message);
    }
  }

  // Fallback generation for single section
  const fullFallback = generateFallbackLectureStudyPack(categoryName, topicTitle, safeTranscript);
  const normalizedFallback = normalizeStudyPackOutput(fullFallback, categoryName, topicTitle, safeTranscript);
  return normalizedFallback[sectionName] || null;
}

/**
 * Ensures all 24 dimensions are populated, valid arrays/objects, with cross-field syncing
 */
function normalizeStudyPackOutput(parsed = {}, categoryName = 'Computer Science', topicTitle = 'Lecture', transcriptText = '') {
  const summary = parsed.lectureSummary || parsed.shortSummary || `Comprehensive academic study pack on ${topicTitle} (${categoryName}).`;
  parsed.lectureSummary = summary;
  parsed.shortSummary = summary;

  // 1. Topic-wise notes (Requirement 4)
  if (!Array.isArray(parsed.topicWiseNotes) || parsed.topicWiseNotes.length === 0) {
    const detailed = parsed.detailedExplanations || parsed.detailedNotes || [];
    if (detailed.length > 0) {
      parsed.topicWiseNotes = detailed.map((n, i) => ({
        id: `topic_${i + 1}`,
        title: n.heading || `Topic ${i + 1}: ${topicTitle}`,
        timestamp: n.timestampRef || `[0${i * 2}:00]`,
        subtopics: [topicTitle, n.heading || 'Core Principles'],
        introduction: `Introduction and conceptual context for ${n.heading || topicTitle}.`,
        definition: (n.content || '').slice(0, 160) || `Foundational definition of ${n.heading || topicTitle}.`,
        detailedExplanation: n.content || `Overview of ${n.heading || topicTitle} in student-friendly terms.`,
        importantPoints: [
          `Master the runtime execution and invariant properties of ${n.heading || topicTitle}.`,
          'Examiners look for clear diagrams and formal terminology.'
        ],
        examples: [
          { title: `Practical Application of ${n.heading || topicTitle}`, explanation: 'Demonstrates baseline usage and execution.' }
        ],
        relatedQuestions: [
          `Explain the core mechanism of ${n.heading || topicTitle}.`,
          `What are the advantages and edge cases of ${n.heading || topicTitle}?`
        ],
        simpleExplanation: n.content || `Overview of ${n.heading || topicTitle}.`,
        definitions: [
          { term: n.heading || topicTitle, definition: (n.content || '').slice(0, 160) }
        ],
        keyConcepts: [
          `Core mechanism of ${n.heading || topicTitle}`,
          'Runtime and efficiency implications'
        ]
      }));
    } else {
      parsed.topicWiseNotes = [
        {
          id: 'topic_1',
          title: `1. Foundational Architecture of ${topicTitle}`,
          timestamp: '[00:00]',
          subtopics: [`Introduction to ${topicTitle}`, 'Prerequisites and Motivation', 'Core Terminology'],
          introduction: `This topic introduces ${topicTitle} within ${categoryName}, establishing core motivations and prerequisites.`,
          definition: `${topicTitle} is a foundational computer science mechanism designed to solve key architectural and computational challenges.`,
          detailedExplanation: `In simple student-friendly terms, ${topicTitle} provides the foundational building blocks for solving computational problems in ${categoryName}. It separates state from execution to achieve determinism.`,
          importantPoints: [
            `Motivation behind ${topicTitle} in modern software systems.`,
            'Baseline environment and configuration requirements.'
          ],
          examples: [
            { title: 'Baseline Setup', explanation: `Initializing ${topicTitle} with standard parameters.` }
          ],
          relatedQuestions: [
            `What fundamental problem does ${topicTitle} solve?`,
            `How does ${topicTitle} maintain deterministic state transitions?`
          ],
          simpleExplanation: `Overview of foundational principles governing ${topicTitle}.`,
          definitions: [
            { term: topicTitle, definition: 'The primary framework and mechanism discussed in this lecture.' }
          ],
          keyConcepts: [`Motivation behind ${topicTitle}`, 'Environment configuration']
        },
        {
          id: 'topic_2',
          title: `2. Working Principle & Execution Lifecycle`,
          timestamp: '[02:15]',
          subtopics: ['Component Structure', 'Execution Lifecycle', 'Data Flow'],
          introduction: `Analyzes how requests and state flow through ${topicTitle} step by step.`,
          definition: 'The execution lifecycle defines the sequential stages an instruction traverses from initialization to termination.',
          detailedExplanation: 'This topic explains how requests and state flow through the system step by step, ensuring reproducible operations and boundary safety.',
          importantPoints: [
            'State transitions must preserve defensive invariants.',
            'Inter-component communication relies on decoupled interfaces.'
          ],
          examples: [
            { title: 'Workflow Execution', explanation: 'Step-by-step trace of state transitions.' }
          ],
          relatedQuestions: [
            'Trace the execution lifecycle step-by-step.',
            'What safety invariants are verified at each boundary?'
          ],
          simpleExplanation: 'Explains execution mechanics and operational phases.',
          definitions: [
            { term: 'Execution Lifecycle', definition: 'The sequential stages an instruction traverses from initialization to termination.' }
          ],
          keyConcepts: ['State transitions and determinism', 'Inter-component communication']
        },
        {
          id: 'topic_3',
          title: `3. Optimization, Scaling & Error Recovery`,
          timestamp: '[05:30]',
          subtopics: ['Resource Optimization', 'Edge Cases', 'Security'],
          introduction: `Focuses on optimizing throughput, minimizing footprint, and hardening security.`,
          definition: 'Optimization in this context denotes algorithmic pruning, caching, and minimizing attack surfaces.',
          detailedExplanation: 'How to make the system faster, lighter, and more secure under production and examination scenarios. Discusses defensive error recovery.',
          importantPoints: [
            'Footprint minimization reduces latency and cloud expenditure.',
            'Enforce the principle of least privilege during execution.'
          ],
          examples: [
            { title: 'Optimized Implementation', explanation: 'Applying minimal base layers and caching to achieve peak efficiency.' }
          ],
          relatedQuestions: [
            `How does ${topicTitle} optimize memory and runtime performance?`,
            'What common pitfalls occur during error recovery?'
          ],
          simpleExplanation: 'Techniques to scale efficiently and handle edge cases gracefully.',
          definitions: [
            { term: 'Defensive Invariant', definition: 'A safety condition verified before and after each state change.' }
          ],
          keyConcepts: ['Footprint minimization', 'Least privilege execution']
        }
      ];
    }
  }

  // Ensure topicWiseNotes entries have all required sub-fields
  parsed.topicWiseNotes = parsed.topicWiseNotes.map((tp, idx) => ({
    id: tp.id || `topic_${idx + 1}`,
    title: tp.title || `Topic ${idx + 1}: ${topicTitle}`,
    timestamp: tp.timestamp || `[0${idx * 2}:00]`,
    subtopics: Array.isArray(tp.subtopics) && tp.subtopics.length > 0 ? tp.subtopics : [topicTitle, 'Key Mechanism'],
    introduction: tp.introduction || `Introductory overview for ${tp.title || topicTitle}.`,
    definition: tp.definition || (tp.definitions && tp.definitions[0] ? tp.definitions[0].definition : `Core definition of ${tp.title || topicTitle}.`),
    detailedExplanation: tp.detailedExplanation || tp.simpleExplanation || `Comprehensive explanation of ${tp.title || topicTitle}.`,
    importantPoints: Array.isArray(tp.importantPoints) && tp.importantPoints.length > 0 ? tp.importantPoints : [
      `Understand the core runtime mechanics of ${tp.title || topicTitle}.`,
      'State time and space complexities during examinations.'
    ],
    examples: Array.isArray(tp.examples) && tp.examples.length > 0 ? tp.examples : [
      { title: `Practical Application of ${tp.title || topicTitle}`, explanation: 'Demonstrates baseline usage and execution.' }
    ],
    relatedQuestions: Array.isArray(tp.relatedQuestions) && tp.relatedQuestions.length > 0 ? tp.relatedQuestions : [
      `Explain the working principle of ${tp.title || topicTitle}.`,
      `What are the critical advantages and trade-offs of ${tp.title || topicTitle}?`
    ],
    simpleExplanation: tp.simpleExplanation || tp.detailedExplanation || `Overview of ${tp.title || topicTitle}.`,
    definitions: Array.isArray(tp.definitions) && tp.definitions.length > 0 ? tp.definitions : [
      { term: tp.title || topicTitle, definition: `The primary mechanism discussed in this section.` }
    ],
    keyConcepts: Array.isArray(tp.keyConcepts) && tp.keyConcepts.length > 0 ? tp.keyConcepts : [
      `Foundational principles of ${tp.title || topicTitle}`,
      'Efficiency and correctness guarantees'
    ]
  }));

  // 2. Subtopic-wise Notes
  if (!Array.isArray(parsed.subtopicWiseNotes) || parsed.subtopicWiseNotes.length === 0) {
    parsed.subtopicWiseNotes = [];
    parsed.topicWiseNotes.forEach((tp, tIdx) => {
      (tp.subtopics || []).forEach((st, sIdx) => {
        parsed.subtopicWiseNotes.push({
          id: `subtopic_${tIdx + 1}_${sIdx + 1}`,
          subtopicTitle: st,
          parentTopic: tp.title,
          timestamp: tp.timestamp || `[0${tIdx * 2}:00]`,
          summary: `In-depth focus on ${st} within ${tp.title}. Analyzes runtime invariants and practical engineering considerations.`,
          keyTakeaways: [
            `Key architectural principle for ${st}.`,
            `Essential takeaway to remember for university and viva exams.`
          ]
        });
      });
    });
  }

  // 3. Detailed Explanations
  if (!Array.isArray(parsed.detailedExplanations) || parsed.detailedExplanations.length === 0) {
    if (Array.isArray(parsed.detailedNotes) && parsed.detailedNotes.length > 0) {
      parsed.detailedExplanations = parsed.detailedNotes.map(n => ({
        heading: n.heading,
        content: n.content,
        timestampRef: n.timestampRef || '[00:00]',
        takeaway: `Master the fundamental mechanism of ${n.heading}.`
      }));
    } else {
      parsed.detailedExplanations = parsed.topicWiseNotes.map(tp => ({
        heading: tp.title,
        content: tp.detailedExplanation,
        timestampRef: tp.timestamp,
        takeaway: `Key takeaway: understand ${tp.title} thoroughly.`
      }));
    }
  }
  parsed.detailedNotes = parsed.detailedExplanations;

  // 4. Important Definitions
  if (!Array.isArray(parsed.importantDefinitions) || parsed.importantDefinitions.length === 0) {
    if (Array.isArray(parsed.keyDefinitions) && parsed.keyDefinitions.length > 0) {
      parsed.importantDefinitions = parsed.keyDefinitions.map(d => ({
        term: d.term,
        definition: d.definition,
        timestampRef: d.timestampRef || '[01:00]',
        context: `${categoryName} syllabus core term`
      }));
    } else {
      parsed.importantDefinitions = [
        {
          term: topicTitle,
          definition: `A core computational concept in ${categoryName} designed to provide structured problem-solving mechanisms.`,
          timestampRef: '[01:10]',
          context: 'Core Curriculum Definition'
        },
        {
          term: 'Decoupled Execution',
          definition: 'The design practice of isolating distinct software lifecycle stages to eliminate unnecessary dependencies and reduce failure blast radius.',
          timestampRef: '[02:30]',
          context: 'System Architecture & Engineering'
        },
        {
          term: 'Defensive Invariant',
          definition: 'A state condition or mathematical property guaranteed to remain true across all valid execution cycles and transformations.',
          timestampRef: '[04:15]',
          context: 'Correctness & Reliability Engineering'
        }
      ];
    }
  }
  parsed.keyDefinitions = parsed.importantDefinitions;

  // 5. Key Concepts
  if (!Array.isArray(parsed.keyConcepts) || parsed.keyConcepts.length === 0) {
    if (Array.isArray(parsed.importantConcepts) && parsed.importantConcepts.length > 0) {
      parsed.keyConcepts = parsed.importantConcepts.map(c => ({
        concept: typeof c === 'string' ? c : c.concept || topicTitle,
        explanation: typeof c === 'string' ? c : c.explanation || c.concept,
        importance: 'High'
      }));
    } else {
      parsed.keyConcepts = [
        { concept: `Modularity and decoupled architecture in ${topicTitle}`, explanation: 'Separates state and execution for scalability and fault isolation.', importance: 'Critical' },
        { concept: 'Resource optimization and runtime invariants', explanation: 'Maintains system consistency under variable loads while minimizing memory and CPU footprints.', importance: 'High' },
        { concept: 'Defensive error mitigation and least privilege', explanation: 'Restricts permissions to minimize security vulnerabilities and system-level compromises.', importance: 'Critical' }
      ];
    }
  }
  parsed.importantConcepts = parsed.keyConcepts.map(c => typeof c === 'string' ? c : `${c.concept}: ${c.explanation}`);

  // 6. Important Points
  if (!Array.isArray(parsed.importantPoints) || parsed.importantPoints.length === 0) {
    parsed.importantPoints = Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ?
      parsed.keyTakeaways :
      [
        `Essential mastery of ${topicTitle} requires understanding runtime behavior, state transitions, and edge cases.`,
        'Examiners prioritize structured diagrams, precise definitions, and time/space complexity bounds.',
        'Always verify boundary conditions, resource teardown, and error recovery procedures.',
        'In production implementations, adhere to the principle of least privilege to prevent security hazards.'
      ];
  }
  parsed.keyTakeaways = parsed.importantPoints;

  // 7. Real-world Examples
  if (!Array.isArray(parsed.realWorldExamples) || parsed.realWorldExamples.length === 0) {
    parsed.realWorldExamples = [
      {
        title: `Production Deployment: ${topicTitle}`,
        scenario: `High-throughput enterprise environment implementing ${topicTitle} in ${categoryName}.`,
        industryApplication: 'Adopted across cloud infrastructure, distributed microservices, and high-frequency backend systems.',
        explanation: `By leveraging ${topicTitle}, production engineers reduce operational latency, isolate failures to localized boundaries, and scale infrastructure seamlessly.`
      },
      {
        title: 'Security Hardening & Privilege Isolation',
        scenario: 'Mitigating container breakout and privilege escalation attacks in cloud clusters.',
        industryApplication: 'Standard operating procedure in FinTech and healthcare enterprise infrastructure.',
        explanation: 'Enforces non-root execution and validates defensive invariants before servicing public client traffic.'
      }
    ];
  }

  // 8. Solved Examples
  if (!Array.isArray(parsed.solvedExamples) || parsed.solvedExamples.length === 0) {
    parsed.solvedExamples = [
      {
        title: `Sample Problem: Implementing ${topicTitle}`,
        problem: `Demonstrate the end-to-end execution of ${topicTitle} for a sample input, verifying all defensive invariants.`,
        stepByStepSolution: [
          'Step 1: Initialize the configuration parameters and validate input bounds.',
          'Step 2: Allocate required resources and establish execution context.',
          'Step 3: Execute the core transformation pipeline and check invariants.',
          'Step 4: Emit the final result and gracefully release transient resources.'
        ],
        codeOrProof: `// Reference pattern for ${topicTitle}\ninitializeParameters();\nprocessTransformation();\nassertInvariantState();\nreleaseResources();`,
        keyTakeaway: 'Always verify state consistency before and after state transitions.'
      }
    ];
  }

  // Legacy examples alias
  if (!Array.isArray(parsed.examples) || parsed.examples.length === 0) {
    parsed.examples = parsed.solvedExamples.map(s => ({
      title: s.title,
      scenario: s.problem,
      codeOrIllustration: s.codeOrProof,
      example: s.codeOrProof,
      explanation: s.keyTakeaway
    }));
  }

  // 9. Important Formulas
  if (!Array.isArray(parsed.importantFormulas) || parsed.importantFormulas.length === 0) {
    if (Array.isArray(parsed.formulas) && parsed.formulas.length > 0) {
      parsed.importantFormulas = parsed.formulas;
    } else {
      parsed.importantFormulas = [
        {
          name: 'Asymptotic Runtime & Resource Scaling',
          formula: 'T(n) = O(f(n)) and S(n) = O(g(n))',
          explanation: 'Measures resource allocation scaling and execution efficiency under variable problem size n.',
          variables: 'n = input magnitude, f(n) = operation count, g(n) = memory footprint'
        },
        {
          name: 'Optimization Ratio & Efficiency Gain',
          formula: 'Gain% = ((BaselineMetric - OptimizedMetric) / BaselineMetric) * 100',
          explanation: 'Calculates the performance speedup or footprint reduction achieved through algorithmic optimization.',
          variables: 'BaselineMetric = initial footprint/time, OptimizedMetric = post-optimization footprint/time'
        }
      ];
    }
  }
  parsed.formulas = parsed.importantFormulas;

  // 10. Flashcards (Full functionality: Question on front, Answer on back, Topic name, Difficulty level)
  const defaultFlashcards = [
    {
      id: 1,
      front: `What is the primary definition and architectural purpose of ${topicTitle}?`,
      back: (parsed.importantDefinitions && parsed.importantDefinitions[0]) ?
        parsed.importantDefinitions[0].definition :
        `A foundational computational mechanism in ${categoryName} designed to structure and optimize execution.`,
      topic: topicTitle,
      difficultyLevel: 'Easy',
      hint: 'Think of its primary role and objective.'
    },
    {
      id: 2,
      front: `What is the core trade-off when implementing ${topicTitle}?`,
      back: 'Balancing execution speed, architectural complexity, and auxiliary memory overhead.',
      topic: 'Trade-offs',
      difficultyLevel: 'Medium',
      hint: 'Time vs Space vs Complexity'
    },
    {
      id: 3,
      front: `Which invariant must hold true during execution of ${topicTitle}?`,
      back: 'System state must remain deterministic and transition safely across module boundaries.',
      topic: 'Correctness',
      difficultyLevel: 'Hard',
      hint: 'State consistency condition'
    },
    {
      id: 4,
      front: `What is the Principle of Least Privilege in system engineering?`,
      back: 'A security guideline stating that any process or user should only possess the minimum permissions required to perform its function.',
      topic: 'Security',
      difficultyLevel: 'Medium',
      hint: 'Non-root execution'
    },
    {
      id: 5,
      front: `What diagram or model is essential when presenting ${topicTitle} in university examinations?`,
      back: 'The state transition or architectural block diagram with clearly labeled inputs, processes, and outputs.',
      topic: 'Exam Strategy',
      difficultyLevel: 'Easy',
      hint: 'Evaluators award significant marks for diagrams.'
    }
  ];

  if (!Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
    parsed.flashcards = defaultFlashcards;
  } else {
    parsed.flashcards = parsed.flashcards.map((f, i) => ({
      id: f.id || i + 1,
      front: f.front || `Question on ${topicTitle}`,
      back: f.back || `Answer explaining ${topicTitle}`,
      topic: f.topic || topicTitle,
      difficultyLevel: f.difficultyLevel || (i % 3 === 0 ? 'Easy' : (i % 3 === 1 ? 'Medium' : 'Hard')),
      hint: f.hint || 'Core concept clue'
    }));
    if (parsed.flashcards.length < 4) {
      defaultFlashcards.slice(parsed.flashcards.length).forEach(df => parsed.flashcards.push(df));
    }
  }

  // 11. Practice MCQs (Question, 4 answer options, correct answer, explanation, difficulty, related topic)
  const defaultMcqs = [
    {
      id: 1,
      question: `What is the primary objective of studying ${topicTitle} in ${categoryName}?`,
      options: [
        `To build optimized, reliable, and scalable computational systems`,
        'To bypass mandatory compiler safety validations',
        'To eliminate dynamic memory allocation entirely',
        'To force single-threaded execution only'
      ],
      correctOption: 0,
      explanation: `${topicTitle} provides structured paradigms for engineering correct and scalable systems.`,
      difficultyLevel: 'Easy',
      relatedTopic: topicTitle,
      hint: 'Think about software reliability and engineering best practices.'
    },
    {
      id: 2,
      question: `Which metric is most critical when evaluating ${topicTitle}?`,
      options: [
        'Runtime complexity, correctness, and resource efficiency',
        'Color scheme of the terminal window',
        'Length of variable names only',
        'Physical size of the monitor screen'
      ],
      correctOption: 0,
      explanation: 'Computational correctness and runtime complexity govern algorithmic and systems evaluation.',
      difficultyLevel: 'Medium',
      relatedTopic: 'Performance',
      hint: 'Asymptotic performance bounds'
    },
    {
      id: 3,
      question: `Which security practice is fundamental when executing ${topicTitle} in production?`,
      options: [
        'Executing processes under a non-root dedicated user account',
        'Granting unrestricted administrative privileges to all background tasks',
        'Disabling error logging and audit trails to save disk space',
        'Hardcoding sensitive credentials in source code'
      ],
      correctOption: 0,
      explanation: 'The principle of least privilege ensures non-root execution, preventing host escape and unauthorized privilege escalation.',
      difficultyLevel: 'Medium',
      relatedTopic: 'Security',
      hint: 'Principle of least privilege'
    },
    {
      id: 4,
      question: `In university examinations, what is the most common reason students lose marks in ${topicTitle}?`,
      options: [
        'Writing continuous unbroken prose without block diagrams or complexity bounds',
        'Writing code in uppercase letters',
        'Using black ink instead of blue ink',
        'Submitting answers before the exam ends'
      ],
      correctOption: 0,
      explanation: 'University evaluators look for structured answers featuring clear diagrams, formal technical terminology, and asymptotic bounds.',
      difficultyLevel: 'Hard',
      relatedTopic: 'Exam Strategy',
      hint: 'Presentation and formatting standards'
    }
  ];

  if (!Array.isArray(parsed.practiceMcqs) || parsed.practiceMcqs.length === 0) {
    if (Array.isArray(parsed.mcqs) && parsed.mcqs.length > 0) {
      parsed.practiceMcqs = parsed.mcqs.map((m, i) => ({
        id: i + 1,
        question: m.question,
        options: Array.isArray(m.options) && m.options.length >= 4 ? m.options.slice(0, 4) : [
          'Correct architectural implementation',
          'Uncontrolled global mutation',
          'Unbounded recursive allocation',
          'Immediate bus failure'
        ],
        correctOption: typeof m.correctOption === 'number' ? m.correctOption : 0,
        explanation: m.explanation || 'Option A is the correct answer based on syllabus principles.',
        difficultyLevel: m.difficultyLevel || 'Medium',
        relatedTopic: m.relatedTopic || topicTitle,
        hint: `Focus on the core principle of ${topicTitle}.`
      }));
    } else {
      parsed.practiceMcqs = defaultMcqs;
    }
  } else {
    parsed.practiceMcqs = parsed.practiceMcqs.map((m, i) => {
      const opts = Array.isArray(m.options) && m.options.length >= 4 ? m.options.slice(0, 4) : [
        m.options && m.options[0] ? m.options[0] : 'Correct answer choice',
        m.options && m.options[1] ? m.options[1] : 'Distractor choice B',
        m.options && m.options[2] ? m.options[2] : 'Distractor choice C',
        m.options && m.options[3] ? m.options[3] : 'Distractor choice D'
      ];
      return {
        id: m.id || i + 1,
        question: m.question || `Question ${i + 1} regarding ${topicTitle}`,
        options: opts,
        correctOption: typeof m.correctOption === 'number' && m.correctOption >= 0 && m.correctOption < 4 ? m.correctOption : 0,
        explanation: m.explanation || `Option ${String.fromCharCode(65 + (m.correctOption || 0))} is correct based on lecture principles.`,
        difficultyLevel: m.difficultyLevel || (i % 3 === 0 ? 'Easy' : (i % 3 === 1 ? 'Medium' : 'Hard')),
        relatedTopic: m.relatedTopic || topicTitle,
        hint: m.hint || `Consider the core mechanism of ${topicTitle}.`
      };
    });
  }

  // Ensure minimum 4 high-quality MCQs
  if (parsed.practiceMcqs.length < 4) {
    defaultMcqs.slice(parsed.practiceMcqs.length).forEach(dm => parsed.practiceMcqs.push(dm));
  }
  parsed.mcqs = parsed.practiceMcqs;

  // 12. MCQ Correct Answers
  if (!Array.isArray(parsed.mcqCorrectAnswers) || parsed.mcqCorrectAnswers.length === 0) {
    parsed.mcqCorrectAnswers = parsed.practiceMcqs.map((m, i) => ({
      questionNumber: i + 1,
      question: m.question,
      correctOptionLetter: String.fromCharCode(65 + m.correctOption),
      correctOptionText: m.options[m.correctOption] || 'Correct Option',
      keyRationale: m.explanation
    }));
  }
  parsed.mcqAnswers = parsed.mcqCorrectAnswers;

  // 13. MCQ Explanations
  if (!Array.isArray(parsed.mcqExplanations) || parsed.mcqExplanations.length === 0) {
    parsed.mcqExplanations = parsed.practiceMcqs.map((m, i) => ({
      questionNumber: i + 1,
      question: m.question,
      correctExplanation: m.explanation,
      distractorAnalysis: `Other choices are invalid because they contradict core invariant rules in ${m.relatedTopic || topicTitle}.`
    }));
  }

  // 14. Short Answer Questions (2-3 Marks)
  if (!Array.isArray(parsed.shortAnswerQuestions) || parsed.shortAnswerQuestions.length === 0) {
    parsed.shortAnswerQuestions = [
      {
        question: `Define ${topicTitle} and state its primary motivation in 2-3 sentences.`,
        marks: 2,
        answer: (parsed.importantDefinitions && parsed.importantDefinitions[0]) ?
          parsed.importantDefinitions[0].definition :
          `${topicTitle} is an architectural paradigm designed to optimize system reliability and modularity in ${categoryName}.`,
        keyPoints: [
          'Formal textbook definition',
          'Primary motivation and problem solved'
        ]
      },
      {
        question: `What is the primary trade-off between speed and memory in ${topicTitle}?`,
        marks: 3,
        answer: 'Speed optimizations frequently necessitate caching and intermediate state buffers, which increases auxiliary memory footprint. Conversely, strict footprint minimization requires dynamic recalculation.',
        keyPoints: [
          'Time vs Space trade-off',
          'Auxiliary buffer implications'
        ]
      }
    ];
  }

  // 15. Long Answer Questions (7-10 Marks)
  if (!Array.isArray(parsed.longAnswerQuestions) || parsed.longAnswerQuestions.length === 0) {
    if (Array.isArray(parsed.importantQuestions) && parsed.importantQuestions.length > 0) {
      parsed.longAnswerQuestions = parsed.importantQuestions.map(q => ({
        question: q.question,
        marks: q.marks || 7,
        answer: q.answer,
        structuralOutline: Array.isArray(q.modelAnswerOutline) ? q.modelAnswerOutline : [
          '1. Formal Definition & Motivation',
          '2. Architectural Block Diagram',
          '3. Step-by-Step Working Mechanism',
          '4. Key Advantages & Limitations',
          '5. Time & Space Complexity'
        ]
      }));
    } else {
      parsed.longAnswerQuestions = [
        {
          question: `Explain the architecture, working principles, and lifecycle of ${topicTitle} with an illustrative diagram.`,
          marks: 7,
          answer: `Structure your response into 5 distinct subheadings: 1. Introduction & Formal Definition, 2. System Block Diagram, 3. Step-by-step Working Mechanism, 4. Advantages & Industrial Applications, and 5. Time & Space Complexity Analysis.`,
          structuralOutline: [
            '1. Introduction & Formal Definition',
            '2. System Block Diagram',
            '3. Step-by-step Working Mechanism',
            '4. Advantages & Industrial Applications',
            '5. Time & Space Complexity Analysis'
          ]
        },
        {
          question: `Discuss edge cases, failure modes, and security hardening techniques in ${topicTitle}.`,
          marks: 7,
          answer: 'Analyze boundary conditions, null parameter handling, race conditions, and privilege escalation vulnerabilities. Contrast single-stage vs multi-stage isolation paradigms.',
          structuralOutline: [
            '1. Failure Mode Taxonomy',
            '2. Boundary Conditions & Null Checks',
            '3. Privilege Separation & Non-root Execution',
            '4. Comparative Trade-off Matrix'
          ]
        }
      ];
    }
  }
  parsed.importantQuestions = parsed.longAnswerQuestions.map(l => ({
    question: l.question,
    marks: l.marks,
    answer: l.answer,
    modelAnswerOutline: l.structuralOutline
  }));

  // 16. Interview Questions
  if (!Array.isArray(parsed.interviewQuestions) || parsed.interviewQuestions.length === 0) {
    parsed.interviewQuestions = [
      {
        question: `How would you architect and optimize ${topicTitle} for a production system processing millions of requests daily?`,
        companyContext: 'Google / Amazon Systems & Architecture Interview',
        technicalAnswer: `I would decouple compilation and transient tooling from runtime assets, enforce stateless idempotent transformations, and utilize non-root execution environments with automated invariant checking.`,
        followUpTip: 'Mention horizontal scaling, circuit breakers, and latency profiling with Prometheus/Grafana.'
      },
      {
        question: `What happens under the hood when a failure occurs during execution of ${topicTitle}?`,
        companyContext: 'Uber / Meta Backend Engineering Screening',
        technicalAnswer: 'The process catches the unhandled invariant violation, terminates cleanly without leaking zombie processes, and triggers automated rollbacks or retry policies.',
        followUpTip: 'Discuss transactional rollbacks, idempotency keys, and graceful shutdown signal handling (SIGTERM).'
      }
    ];
  }

  // 17. Viva Questions
  if (!Array.isArray(parsed.vivaQuestions) || parsed.vivaQuestions.length === 0) {
    parsed.vivaQuestions = [
      {
        question: `What is the single most important definition of ${topicTitle}?`,
        quickAnswer: `${topicTitle} is a structured computing mechanism that separates state from execution to achieve determinism and efficiency.`,
        examinerExpectedKeyword: 'Modularity, Determinism, Isolation'
      },
      {
        question: 'Why should you never run production processes as root?',
        quickAnswer: 'Running as root magnifies security vulnerabilities by allowing an attacker to breach host isolation and compromise administrative controls.',
        examinerExpectedKeyword: 'Least privilege, Host escape prevention'
      },
      {
        question: 'What is the time complexity of the core algorithm?',
        quickAnswer: 'Under standard conditions, it operates in O(N) linear time or O(log N) logarithmic height bounded by defensive invariants.',
        examinerExpectedKeyword: 'Asymptotic complexity bound'
      }
    ];
  }

  // 18. Previous Year Questions
  if (!Array.isArray(parsed.previousYearQuestions) || parsed.previousYearQuestions.length === 0) {
    if (Array.isArray(parsed.pyqMapping) && parsed.pyqMapping.length > 0) {
      parsed.previousYearQuestions = parsed.pyqMapping.map(p => ({
        year: p.year || '2023 University Exam',
        examName: 'University Examination',
        question: p.question,
        marks: p.marks || 7,
        solution: p.examTips || 'Draw the block diagram and provide formal step-by-step points.',
        frequency: p.frequency || 'Repeated Frequently'
      }));
    } else {
      parsed.previousYearQuestions = [
        {
          year: '2023 End-Semester Examination',
          examName: 'University B.Tech Examination',
          question: `Discuss the design principles of ${topicTitle}. How does it improve performance and reliability?`,
          marks: 7,
          solution: 'Draw the execution architecture diagram, explain modular stage separation, and contrast with naive single-stage alternatives.',
          frequency: 'Repeated 3 times in last 5 years (High Probability)'
        },
        {
          year: '2022 Mid-Semester Test',
          examName: 'Mid-Term Test',
          question: `Write short notes on ${topicTitle} with a practical example.`,
          marks: 4,
          solution: 'Provide a 3-line definition, 3 salient features, and a 4-line code or configuration snippet.',
          frequency: 'Frequently Asked in Section B'
        }
      ];
    }
  }
  parsed.pyqMapping = parsed.previousYearQuestions.map(p => ({
    year: p.year,
    question: p.question,
    marks: p.marks,
    frequency: p.frequency,
    topicArea: topicTitle,
    examTips: p.solution
  }));

  // 19. PYQ Topic Mapping
  if (!Array.isArray(parsed.pyqTopicMapping) || parsed.pyqTopicMapping.length === 0) {
    parsed.pyqTopicMapping = [
      {
        topicName: topicTitle,
        appearancesCount: 3,
        examWeightage: 'High (14 Marks Average)',
        trendAnalysis: 'Frequently featured as the primary 7-mark question in Unit 1/Unit 2 examinations.'
      },
      {
        topicName: `Optimizations & Safety Invariants in ${topicTitle}`,
        appearancesCount: 2,
        examWeightage: 'Medium (7 Marks Average)',
        trendAnalysis: 'Appears as part (b) in descriptive university papers.'
      }
    ];
  }

  // 20. FAQs
  if (!Array.isArray(parsed.faqs) || parsed.faqs.length === 0) {
    parsed.faqs = [
      {
        question: `How does ${topicTitle} differ from basic monolithic implementations?`,
        answer: `${topicTitle} provides structured abstraction, modular decoupling, and explicit invariant handling rather than fragile monolithic scripts.`,
        practicalScenario: 'Scaling from a quick prototype to a production-grade codebase.'
      },
      {
        question: `What should I focus on for university examinations regarding ${topicTitle}?`,
        answer: 'Prioritize drawing clean block diagrams, writing clear step-by-step algorithms or configurations, and stating time/space complexities.',
        practicalScenario: '7-mark and 10-mark descriptive exam questions.'
      },
      {
        question: `Where does ${topicTitle} fit in modern industry career tracks?`,
        answer: `It is an indispensable skill in ${categoryName}, routinely evaluated in technical rounds, coding screens, and system design interviews.`,
        practicalScenario: 'Technical interviews and production deployment design.'
      }
    ];
  }

  // 21. Exam-Oriented Notes
  if (!Array.isArray(parsed.examOrientedNotes) || parsed.examOrientedNotes.length === 0) {
    parsed.examOrientedNotes = [
      {
        category: 'High-Scoring Presentation',
        tip: 'Always partition long answers into numbered subheadings: Definition, Diagram, Working Principle, Applications, and Limitations.',
        commonMistakesToAvoid: 'Writing continuous unformatted paragraphs without diagrams or bullet points.',
        highScoringStrategy: 'Use boxed formulas and bold technical terminology.'
      },
      {
        category: 'Evaluation Criteria',
        tip: 'Examiners look for exact technical keywords (e.g. Invariant, Decoupled, Deterministic) and proper mathematical/asymptotic notation.',
        commonMistakesToAvoid: 'Vague colloquial descriptions instead of formal textbook terminology.',
        highScoringStrategy: 'State time complexity O(N) and space bounds explicitly.'
      }
    ];
  }

  // 22. Quick Revision Notes
  if (!Array.isArray(parsed.quickRevisionNotes) || parsed.quickRevisionNotes.length === 0) {
    parsed.quickRevisionNotes = Array.isArray(parsed.revisionNotes) && parsed.revisionNotes.length > 0 ?
      parsed.revisionNotes :
      [
        `Core Principle: ${topicTitle} modularizes computational state for high efficiency and reliability.`,
        'Exam Must-Draw: Block diagram showing inputs, processing stages, and output validation.',
        'Edge Cases: Check empty parameters, memory limits, and process privilege levels.',
        'Key Metric: Calculate footprint reduction and runtime asymptotic bounds.'
      ];
  }
  parsed.revisionNotes = parsed.quickRevisionNotes;

  // 23. Practice Tests
  if (!Array.isArray(parsed.practiceTests) || parsed.practiceTests.length === 0) {
    parsed.practiceTests = [
      {
        testTitle: `Practice Assessment Test: ${topicTitle}`,
        instructions: 'Attempt all questions. Total allocated time is 30 minutes.',
        durationMinutes: 30,
        totalMarks: 20,
        questions: [
          { qNum: 1, question: `Define ${topicTitle} and explain its core motivation.`, marks: 3, type: 'Short Answer' },
          { qNum: 2, question: `Draw and explain the execution architecture of ${topicTitle}.`, marks: 7, type: 'Descriptive' },
          { qNum: 3, question: `Discuss common edge cases, failure modes, and mitigation techniques in ${topicTitle}.`, marks: 5, type: 'Analytical' },
          { qNum: 4, question: `Analyze the asymptotic time and space complexities of ${topicTitle}.`, marks: 5, type: 'Theory / Proof' }
        ]
      }
    ];
  }

  return cleanLatexMathObject(parsed);
}

function generateFallbackLectureStudyPack(categoryName, topicTitle, transcriptText) {
  const lines = (transcriptText || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 5);

  const timestampMatches = [];
  lines.forEach(line => {
    const m = line.match(/\[(\d{1,2}:\d{2})\]\s*(.*)/);
    if (m) {
      timestampMatches.push({ ts: `[${m[1]}]`, text: m[2] });
    }
  });

  const t0 = timestampMatches[0] ? timestampMatches[0].ts : '[00:00]';
  const t1 = timestampMatches[1] ? timestampMatches[1].ts : '[02:15]';
  const t2 = timestampMatches[2] ? timestampMatches[2].ts : '[04:30]';
  const t3 = timestampMatches[3] ? timestampMatches[3].ts : '[06:45]';

  const line0 = timestampMatches[0] ? timestampMatches[0].text : (lines[0] || `Introduction to ${topicTitle}`);
  const line1 = timestampMatches[1] ? timestampMatches[1].text : (lines[1] || `Core mechanism and execution flow`);
  const line2 = timestampMatches[2] ? timestampMatches[2].text : (lines[2] || `Optimization and architecture design`);
  const line3 = timestampMatches[3] ? timestampMatches[3].text : (lines[3] || `Security, edge cases, and best practices`);

  const summary = `This comprehensive lecture covers "${topicTitle}" within the ${categoryName} domain. It explains foundational principles, architectural patterns, operational trade-offs, and exam-critical mechanisms based directly on the lecture discussion: "${line0}".`;

  const fallback = {
    lectureSummary: summary,
    shortSummary: summary,
    topicWiseNotes: [
      {
        id: 'topic_1',
        title: `1. Foundational Architecture of ${topicTitle}`,
        timestamp: t0,
        subtopics: [`Introduction to ${topicTitle}`, 'Prerequisites and Motivation', 'Core Terminology'],
        introduction: `The lecture begins by introducing ${topicTitle}: "${line0}". It explains why this architectural pattern is essential in modern computing.`,
        definition: `${topicTitle} is a foundational computing mechanism in ${categoryName} designed to structure, optimize, and safely execute workflows.`,
        detailedExplanation: `In simple student-friendly terms, ${topicTitle} provides the foundational building blocks for solving computational problems in ${categoryName}. As discussed: "${line0}". It establishes the baseline configuration so systems run smoothly.`,
        importantPoints: [
          `Motivation behind ${topicTitle} in software engineering.`,
          'Prerequisite configurations and environment initialization.'
        ],
        examples: [
          { title: 'Baseline Setup', explanation: `Initializing ${topicTitle} with standard parameters and default configurations.` }
        ],
        relatedQuestions: [
          `What is the primary motivation for ${topicTitle}?`,
          `How does ${topicTitle} structure system state?`
        ]
      },
      {
        id: 'topic_2',
        title: `2. Working Principle & Execution Lifecycle`,
        timestamp: t1,
        subtopics: ['Component Structure', 'Execution Lifecycle', 'Data Flow'],
        introduction: `Diving into execution mechanics: "${line1}". How requests and state flow through the system step by step.`,
        definition: 'The execution lifecycle encompasses all state transitions an instruction undergoes from parsing to final output emission.',
        detailedExplanation: `This topic explains how the different pieces fit together: "${line1}". During each phase, inputs are validated, processed, and passed along with guaranteed invariants.`,
        importantPoints: [
          'State transitions must preserve determinism.',
          'Inter-component communication relies on decoupled interfaces.'
        ],
        examples: [
          { title: 'Workflow Execution', explanation: 'Step-by-step trace of state transitions under normal input conditions.' }
        ],
        relatedQuestions: [
          'Trace the execution lifecycle step-by-step.',
          'What state invariants are verified during execution?'
        ]
      },
      {
        id: 'topic_3',
        title: `3. Optimization, Scaling & Error Recovery`,
        timestamp: t2,
        subtopics: ['Resource Optimization', 'Performance Bottlenecks', 'Defensive Engineering'],
        introduction: `Focuses on performance tuning and attack surface reduction: "${line2}".`,
        definition: 'Optimization denotes algorithmic pruning, caching, and minimizing attack surfaces and memory footprint.',
        detailedExplanation: `Here we learn how to make the system faster, lighter, and more secure: "${line2}". By separating build-time tooling from runtime artifacts, footprints shrink drastically.`,
        importantPoints: [
          'Footprint minimization drastically reduces latency.',
          'Enforce non-root execution and verify error boundaries.'
        ],
        examples: [
          { title: 'Optimized Implementation', explanation: 'Applying minimal base layers and caching to achieve peak efficiency.' }
        ],
        relatedQuestions: [
          `How does ${topicTitle} achieve optimal runtime performance?`,
          'How are failures handled without system crashes?'
        ]
      }
    ],
    detailedExplanations: [
      {
        heading: `1. Foundational Architecture of ${topicTitle}`,
        content: `The lecture introduces ${topicTitle} as an architectural paradigm within ${categoryName}: "${line0}". Key considerations include structural decoupling, baseline configuration, and environmental prerequisites.`,
        timestampRef: t0,
        takeaway: 'Establish prerequisites before implementing advanced features.'
      },
      {
        heading: `2. Working Principle and Lifecycle`,
        content: `Diving into execution mechanics: "${line1}". The system coordinates state transitions, isolates sub-processes, and ensures reproducible builds. During each phase, inputs are parsed, validated, and transferred.`,
        timestampRef: t1,
        takeaway: 'Trace state transitions systematically in university answers.'
      },
      {
        heading: `3. Optimization Strategies and Production Safety`,
        content: `Focuses on performance tuning and attack surface reduction: "${line2}". By separating build-time tooling from runtime artifacts, artifact sizes shrink drastically: "${line3}".`,
        timestampRef: t2,
        takeaway: 'Drop unneeded build dependencies in production outputs.'
      }
    ],
    importantDefinitions: [
      {
        term: topicTitle,
        definition: `A core computer science mechanism in ${categoryName} designed to structure and optimize computational execution.`,
        timestampRef: t0,
        context: `${categoryName} Curriculum Standard Term`
      },
      {
        term: 'Decoupled Architecture',
        definition: 'The architectural pattern of separating compilation, test execution, and final production packaging into distinct phases.',
        timestampRef: t1,
        context: 'System Architecture & Engineering'
      },
      {
        term: 'Principle of Least Privilege',
        definition: 'Ensuring execution processes operate strictly with the minimum privileges required to perform their authorized tasks.',
        timestampRef: t3,
        context: 'System Security & Reliability'
      }
    ],
    keyConcepts: [
      { concept: `Modularity and Separation of Concerns in ${topicTitle}`, explanation: 'Isolates distinct responsibilities to ensure maintainability and testability.', importance: 'Critical' },
      { concept: 'Resource Footprint Optimization', explanation: 'Dramatically reduces deployment latency and storage overhead.', importance: 'High' },
      { concept: 'Security Hardening & Invariant Checking', explanation: 'Mitigates common host breakout and privilege escalation vulnerabilities.', importance: 'Critical' }
    ],
    importantPoints: [
      `Master the core architectural components of ${topicTitle} before attempting numericals or code.`,
      'Always state time complexity, space overhead, and security implications in university examinations.',
      'Verify boundary scenarios, null inputs, and resource teardown procedures.',
      'In production environments, always drop root privileges and execute under dedicated service accounts.'
    ]
  };

  return normalizeStudyPackOutput(fallback, categoryName, topicTitle, transcriptText);
}

/**
 * AI Notice Analyzer: Document and text extraction for University Notices
 */
async function analyzeNoticeDocument({ text = '', buffer = null, mimeType = 'application/pdf', filename = '' }) {
  let rawText = text || '';

  // Extract text from PDF buffer if provided and text is empty
  if (buffer && (!rawText || rawText.trim().length === 0)) {
    if (mimeType === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(buffer);
        rawText = parsed.text || '';
      } catch (err) {
        console.warn('[Notice AI] pdf-parse error, will try multimodal if available:', err.message);
      }
    }
  }

  // If AI configured, call Gemini multimodal or LLM
  if (isConfigured()) {
    const systemPrompt = `You are an expert university examination registrar and academic notice document parser.
Analyze this university notice (which may be an examination timetable, assignment deadline, practical schedule, holiday circular, or result announcement).

EXTRACT AND RECOGNIZE:
1. University Name
2. Semester (e.g. 1 to 8, or null if all-university)
3. Notice Type: Choose one from ["Exam Timetable", "Assignment Deadline", "Holiday", "Practical Exam", "Internal Exam", "Registration", "Result", "Academic Deadline", "General Notice"]
4. Notice Date: Date of circular issuance (YYYY-MM-DD or null)
5. Examination Dates: Start date and End date of examinations (YYYY-MM-DD or null)
6. Examination Timetable: Array of individual paper schedules:
   - subjectName (Full subject title e.g. "Object Oriented Programming with Java")
   - subjectCode (e.g. "CS-301", "PCC-CS301")
   - date (YYYY-MM-DD)
   - time (e.g. "10:00 AM - 01:00 PM")
   - room (or session e.g. "Morning Shift" or null)
7. Practical Examination Dates: [{ subjectName, date, time }]
8. Internal Examination Dates: [{ subjectName, date }]
9. Assignment Submission Deadlines: [{ title, subjectName, deadline }]
10. Holiday Announcements: [{ name, date }]
11. Registration Deadlines: [{ title, deadline }]
12. Result Announcements: [{ title, expectedDate }]
13. Other Academic Deadlines: [{ title, date }]

CRITICAL INSTRUCTIONS:
- Do NOT invent missing dates or subjects. If not present in the document, return empty arrays or null.
- Normalize dates to YYYY-MM-DD format whenever possible (e.g. "15 Dec 2026" -> "2026-12-15").

OUTPUT FORMAT: Strict JSON matching this schema:
{
  "universityName": "University Name or null",
  "semester": 3,
  "noticeType": "Exam Timetable",
  "noticeDate": "2026-11-20",
  "title": "Clear descriptive title for the notice",
  "examinationDates": {
    "start": "2026-12-15",
    "end": "2026-12-30"
  },
  "timetable": [
    {
      "subjectName": "OOPS with Java",
      "subjectCode": "CS-301",
      "date": "2026-12-15",
      "time": "10:00 AM - 01:00 PM",
      "room": "Block A"
    }
  ],
  "practicalDates": [],
  "internalDates": [],
  "assignmentDeadlines": [],
  "holidays": [],
  "registrationDeadlines": [],
  "resultAnnouncements": [],
  "academicDeadlines": []
}`;

    try {
      let rawJson = '';
      if (buffer && mimeType && (mimeType.startsWith('image/') || (mimeType === 'application/pdf' && (!rawText || rawText.length < 50)))) {
        // Multimodal image/PDF extraction
        const base64Data = buffer.toString('base64');
        rawJson = await callGeminiMultimodal(systemPrompt, 'Extract all university notice information and timetable strictly into JSON format.', base64Data, mimeType, true);
      } else {
        const userPrompt = `Filename: ${filename}\n\nNotice Content:\n"""\n${(rawText || '').slice(0, 16000)}\n"""\n\nExtract all notice information into the structured JSON schema.`;
        rawJson = await callLLM(systemPrompt, userPrompt, true);
      }

      let parsed;
      try {
        parsed = JSON.parse(rawJson);
      } catch (e) {
        const match = rawJson.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      if (parsed && (parsed.universityName || parsed.timetable || parsed.examinationDates || parsed.title)) {
        return {
          rawText,
          extracted: parsed
        };
      }
    } catch (err) {
      console.warn('[Notice AI] AI extraction failed, using heuristic parser:', err.message);
    }
  }

  // Fallback to intelligent heuristic parser
  const heuristicResult = heuristicNoticeParser(rawText, filename);
  return {
    rawText,
    extracted: heuristicResult
  };
}

/**
 * Deterministic heuristic notice parser that extracts universities, dates, semesters and timetable entries
 */
function heuristicNoticeParser(rawText = '', filename = '') {
  const text = rawText || '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Detect University Name
  let universityName = 'State Technical University';
  const uniMatch = text.match(/([A-Z][A-Za-z\s]+(University|Institute of Technology|Vishwavidyalaya|College of Engineering))/i);
  if (uniMatch) {
    universityName = uniMatch[1].trim();
  }

  // 2. Detect Semester
  let semester = 3; // default
  const semMatch = text.match(/(?:Semester|Sem|SEM)[\s:-]*([1-8])\b/i) || text.match(/\b([1-8])(?:st|nd|rd|th)\s+Semester/i);
  if (semMatch) {
    semester = parseInt(semMatch[1], 10);
  }

  // 3. Detect Notice Type
  let noticeType = 'General Notice';
  if (/exam|timetable|date\s*sheet|end\s*sem|schedule/i.test(text)) {
    noticeType = 'Exam Timetable';
  } else if (/practical|viva|lab/i.test(text)) {
    noticeType = 'Practical Exam';
  } else if (/assignment|submission/i.test(text)) {
    noticeType = 'Assignment Deadline';
  } else if (/internal|mid\s*sem|sessional/i.test(text)) {
    noticeType = 'Internal Exam';
  } else if (/holiday|vacation/i.test(text)) {
    noticeType = 'Holiday';
  } else if (/registration|enrollment|fee/i.test(text)) {
    noticeType = 'Registration';
  } else if (/result|grade|marksheet/i.test(text)) {
    noticeType = 'Result';
  }

  // 4. Parse Dates and Timetable
  const timetable = [];
  const assignmentDeadlines = [];
  const holidays = [];
  const practicalDates = [];
  let examStart = null;
  let examEnd = null;

  // Regex patterns for dates: e.g. 15-12-2026, 2026-12-15, 15/12/2026, 15 Dec 2026, Dec 15, 2026
  const dateRegex = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4})\b/gi;
  const allFoundDates = text.match(dateRegex) || [];

  // Parse lines for timetable rows
  for (const line of lines) {
    // Subject code match like CS-301, CS301, IT-302, PCC-CS301
    const codeMatch = line.match(/\b([A-Z]{2,4}[-\s]?\d{3}[A-Z]?)\b/i);
    const lineDateMatch = line.match(dateRegex);

    if (codeMatch && lineDateMatch) {
      const code = codeMatch[1].replace(/\s+/, '-');
      const dateStr = normalizeDateString(lineDateMatch[0]);
      
      // Clean up subject name
      let subjectName = line
        .replace(codeMatch[0], '')
        .replace(lineDateMatch[0], '')
        .replace(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?)\b/gi, '')
        .replace(/[|:;,\-\[\]\(\)]/g, ' ')
        .trim();

      if (!subjectName || subjectName.length < 3) {
        subjectName = `Subject (${code})`;
      }

      const timeMatch = line.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?)\b/i);
      const timeStr = timeMatch ? timeMatch[1] : '10:00 AM - 01:00 PM';

      timetable.push({
        subjectName,
        subjectCode: code,
        date: dateStr,
        time: timeStr,
        room: 'Exam Hall'
      });
    } else if (/holiday|vacation/i.test(line) && lineDateMatch) {
      holidays.push({
        name: line.replace(lineDateMatch[0], '').replace(/[|:\-]/g, '').trim(),
        date: normalizeDateString(lineDateMatch[0])
      });
    } else if (/assignment|submit|deadline/i.test(line) && lineDateMatch) {
      assignmentDeadlines.push({
        title: line.replace(lineDateMatch[0], '').replace(/[|:\-]/g, '').trim(),
        subjectName: 'Core Subject',
        deadline: normalizeDateString(lineDateMatch[0])
      });
    }
  }

  // Calculate examinationDates start and end
  if (timetable.length > 0) {
    const sortedDates = timetable.map(t => t.date).filter(Boolean).sort();
    examStart = sortedDates[0];
    examEnd = sortedDates[sortedDates.length - 1];
  } else if (allFoundDates.length > 0) {
    const normalized = allFoundDates.map(normalizeDateString).filter(Boolean).sort();
    if (normalized.length > 0) {
      examStart = normalized[0];
      examEnd = normalized[normalized.length - 1];
    }
  }

  // Title
  let title = `${universityName} - Semester ${semester} ${noticeType}`;
  if (filename) {
    const cleanFn = filename.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
    if (cleanFn.length > 5) title = cleanFn;
  }

  return {
    universityName,
    semester,
    noticeType,
    noticeDate: new Date().toISOString().slice(0, 10),
    title,
    examinationDates: {
      start: examStart,
      end: examEnd
    },
    timetable,
    practicalDates,
    internalDates: [],
    assignmentDeadlines,
    holidays,
    registrationDeadlines: [],
    resultAnnouncements: [],
    academicDeadlines: []
  };
}

function normalizeDateString(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  // If DD-MM-YYYY
  const parts = dateStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (parts) {
    const day = parts[1].padStart(2, '0');
    const month = parts[2].padStart(2, '0');
    const year = parts[3];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

