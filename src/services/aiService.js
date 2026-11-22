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
