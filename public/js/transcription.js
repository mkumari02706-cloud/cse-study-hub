// Lecture Transcription & Complete Academic Pack Workspace

(function() {
  // Preselected configuration from server or URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const PRESELECTED_CAT = window.PRESELECTED_CAT || urlParams.get('category') || '';
  const PRESELECTED_TOPIC = window.PRESELECTED_TOPIC || urlParams.get('topic') || '';
  const PRESELECTED_TOPIC_ID = window.PRESELECTED_TOPIC_ID || urlParams.get('topicId') || '';
  let PRESELECTED_TYPE = window.PRESELECTED_TYPE || urlParams.get('type') || '';

  const getExploreTracks = () => window.EXPLORE_TRACKS || [];
  const getCurriculumSubjects = () => window.CURRICULUM_SUBJECTS || [];

  if (!PRESELECTED_TYPE) {
    const subjects = getCurriculumSubjects();
    if (PRESELECTED_CAT && subjects.some(s => s.id === PRESELECTED_CAT)) {
      PRESELECTED_TYPE = 'curriculum';
    } else {
      PRESELECTED_TYPE = 'explore';
    }
  }

  let currentSourceType = 'youtube';
  let currentTranscriptData = null;
  let currentStudyPack = null;

  // Flashcards state
  let currentCardIndex = 0;
  let currentFlashcards = [];
  let isCardFlipped = false;
  let completedFlashcardIndices = new Set();

  // MCQs state
  let currentMcqs = [];
  let currentMcqAnswers = {};
  let currentSelectedOption = null;
  let currentMcqIndex = 0;

  // Lightweight Math Formatter for study pack content
  function wrapIfNeeded(expr) {
    const trimmed = (expr || '').trim();
    if (!trimmed) return '';
    let depth = 0;
    let hasTopLevelPlusMinus = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (depth === 0 && (ch === '+' || ch === '-')) {
        hasTopLevelPlusMinus = true;
        break;
      }
    }
    return hasTopLevelPlusMinus ? `(${trimmed})` : trimmed;
  }

  function cleanMathSnippet(math) {
    if (!math || typeof math !== 'string') return '';
    let m = math;

    while (/\\frac\{([^{}]+)\}\{([^{}]+)\}/.test(m)) {
      m = m.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, num, den) => {
        const cleanNum = wrapIfNeeded(num);
        const cleanDen = wrapIfNeeded(den);
        return `${cleanNum}/${cleanDen}`;
      });
    }

    const symbolMap = [
      [/\\leq?\b/g, '≤'],
      [/\\geq?\b/g, '≥'],
      [/\\neq?\b/g, '≠'],
      [/\\in\b/g, '∈'],
      [/\\notin\b/g, '∉'],
      [/\\subset\b/g, '⊂'],
      [/\\subseteq\b/g, '⊆'],
      [/\\forall\b/g, '∀'],
      [/\\exists\b/g, '∃'],
      [/\\rightarrow\b|\\to\b/g, '→'],
      [/\\leftarrow\b/g, '←'],
      [/\\leftrightarrow\b/g, '↔'],
      [/\\Rightarrow\b|\\implies\b/g, '⇒'],
      [/\\Leftarrow\b/g, '⇐'],
      [/\\Leftrightarrow\b|\\iff\b/g, '⇔'],
      [/\\land\b|\\wedge\b/g, '∧'],
      [/\\lor\b|\\vee\b/g, '∨'],
      [/\\neg\b|\\sim\b/g, '¬'],
      [/\\times\b/g, '×'],
      [/\\div\b/g, '÷'],
      [/\\pm\b/g, '±'],
      [/\\cdot\b/g, '·'],
      [/\\cap\b/g, '∩'],
      [/\\cup\b/g, '∪'],
      [/\\emptyset\b|\\varnothing\b/g, '∅'],
      [/\\infty\b/g, '∞'],
      [/\\sum\b/g, '∑'],
      [/\\prod\b/g, '∏'],
      [/\\sqrt\{([^{}]+)\}/g, '√($1)'],
      [/\\sqrt\b/g, '√'],
      [/\\alpha\b/g, 'α'],
      [/\\beta\b/g, 'β'],
      [/\\gamma\b/g, 'γ'],
      [/\\delta\b/g, 'δ'],
      [/\\theta\b/g, 'θ'],
      [/\\lambda\b/g, 'λ'],
      [/\\pi\b/g, 'π'],
      [/\\sigma\b/g, 'σ'],
      [/\\omega\b/g, 'ω'],
      [/\\Delta\b/g, 'Δ'],
      [/\\Sigma\b/g, 'Σ'],
      [/\\Omega\b/g, 'Ω'],
      [/\\mathbb\{R\}/g, 'ℝ'],
      [/\\mathbb\{Z\}/g, 'ℤ'],
      [/\\mathbb\{N\}/g, 'ℕ'],
      [/\\mathbb\{Q\}/g, 'ℚ'],
      [/\\text\{([^{}]+)\}/g, '$1'],
      [/\\mathrm\{([^{}]+)\}/g, '$1'],
      [/\\mathbf\{([^{}]+)\}/g, '<b>$1</b>'],
      [/\\left\(/g, '('],
      [/\\right\)/g, ')'],
      [/\\left\[/g, '['],
      [/\\right\]/g, ']'],
      [/\\left\\{/g, '{'],
      [/\\right\\}/g, '}'],
      [/\\\{/g, '{'],
      [/\\\}/g, '}']
    ];

    for (const [re, sym] of symbolMap) {
      m = m.replace(re, sym);
    }

    m = m.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
    m = m.replace(/_([a-zA-Z0-9\u0370-\u03ff])/g, '<sub>$1</sub>');
    m = m.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
    m = m.replace(/\^([a-zA-Z0-9+-])/g, '<sup>$1</sup>');

    return m.trim();
  }

  function formatMath(text) {
    if (!text || typeof text !== 'string') return text || '';
    if (typeof window.formatMath === 'function') {
      return window.formatMath(text);
    }
    let out = text;
    out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => cleanMathSnippet(math));
    out = out.replace(/\$([^\$\n\r]+?)\$/g, (_match, math) => cleanMathSnippet(math));
    if (/\\(frac|in|subset|subseteq|forall|exists|le|ge|ne|to|land|lor|neg|sqrt|times)/.test(out)) {
      out = cleanMathSnippet(out);
    }
    out = out.replace(/\$([^$\n\r]+?)\$/g, '$1');
    return out;
  }

  // --- Category & Topic Dropdown Management ---
  function initCategoryDropdowns() {
    const typeSelect = document.getElementById('categoryTypeSelect');
    if (typeSelect && PRESELECTED_TYPE) {
      typeSelect.value = PRESELECTED_TYPE;
    }
    handleCategoryTypeChange();
  }

  function handleCategoryTypeChange() {
    const typeSelect = document.getElementById('categoryTypeSelect');
    const type = typeSelect ? typeSelect.value : (PRESELECTED_TYPE || 'explore');
    const catSelect = document.getElementById('categorySelect');
    if (!catSelect) return;
    catSelect.innerHTML = '';

    const preCat = PRESELECTED_CAT || '';

    if (type === 'explore') {
      const tracks = getExploreTracks();
      tracks.forEach(track => {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = `${track.icon || '🚀'} ${track.title}`;
        if (preCat && preCat === track.id) opt.selected = true;
        catSelect.appendChild(opt);
      });
    } else {
      const subjects = getCurriculumSubjects();
      subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.id;
        opt.textContent = `📚 ${sub.name} (Sem ${sub.semester || 3})`;
        if (preCat && preCat === sub.id) opt.selected = true;
        catSelect.appendChild(opt);
      });
    }

    // Default select first if none selected
    if (!catSelect.value && catSelect.options.length > 0) {
      catSelect.selectedIndex = 0;
    }

    handleCategoryChange();
  }

  function handleCategoryChange() {
    const typeSelect = document.getElementById('categoryTypeSelect');
    const type = typeSelect ? typeSelect.value : (PRESELECTED_TYPE || 'explore');
    const catSelect = document.getElementById('categorySelect');
    const catId = catSelect ? catSelect.value : '';
    const topicSelect = document.getElementById('topicSelect');
    const customInput = document.getElementById('customTopicInput');
    if (!topicSelect) return;

    topicSelect.innerHTML = '<option value="">-- Select Predefined Topic / Milestone --</option>';

    const preTopic = (PRESELECTED_TOPIC || '').trim();
    const preTopicId = (PRESELECTED_TOPIC_ID || '').trim();
    let matchedTopic = false;

    if (type === 'explore') {
      const tracks = getExploreTracks();
      const track = tracks.find(t => t.id === catId);
      if (track && track.stages) {
        track.stages.forEach(st => {
          (st.topics || []).forEach(tp => {
            const opt = document.createElement('option');
            opt.value = tp.id;
            opt.setAttribute('data-title', tp.name);
            if (!opt.dataset) opt.dataset = {};
            opt.dataset.title = tp.name;
            opt.textContent = `Stage ${st.stageNumber}: ${tp.name}`;
            if (
              (preTopicId && preTopicId === tp.id) ||
              (preTopic && (preTopic === tp.id || preTopic.toLowerCase() === tp.name.toLowerCase() || tp.name.toLowerCase().includes(preTopic.toLowerCase())))
            ) {
              opt.selected = true;
              matchedTopic = true;
            }
            topicSelect.appendChild(opt);
          });
        });
      }
    } else {
      const subjects = getCurriculumSubjects();
      const sub = subjects.find(s => s.id === catId);
      if (sub && sub.units) {
        sub.units.forEach(u => {
          (u.topics || []).forEach(tp => {
            const opt = document.createElement('option');
            opt.value = tp;
            opt.setAttribute('data-title', tp);
            if (!opt.dataset) opt.dataset = {};
            opt.dataset.title = tp;
            opt.textContent = `Unit ${u.number}: ${tp}`;
            if (
              preTopic &&
              (preTopic === tp ||
               preTopic.toLowerCase() === tp.toLowerCase() ||
               tp.toLowerCase().includes(preTopic.toLowerCase()) ||
               preTopic.toLowerCase().includes(tp.toLowerCase()))
            ) {
              opt.selected = true;
              matchedTopic = true;
            }
            topicSelect.appendChild(opt);
          });
        });
      }
    }

    if (matchedTopic) {
      handleTopicSelectChange();
    } else if (preTopic) {
      if (customInput) customInput.value = preTopic;
    }
  }

  function handleTopicSelectChange() {
    const topicSelect = document.getElementById('topicSelect');
    const customInput = document.getElementById('customTopicInput');
    if (!topicSelect || !customInput) return;
    const selectedOpt = topicSelect.options[topicSelect.selectedIndex];
    const optTitle = selectedOpt ? (
      (selectedOpt.getAttribute && selectedOpt.getAttribute('data-title')) ||
      (selectedOpt.dataset && selectedOpt.dataset.title) ||
      selectedOpt.value
    ) : '';
    if (optTitle) {
      customInput.value = optTitle;
    } else if (PRESELECTED_TOPIC) {
      customInput.value = PRESELECTED_TOPIC;
    }
  }

  // --- Source Media Tab Switching ---
  function switchSourceTab(tab) {
    currentSourceType = tab;
    const tabYt = document.getElementById('sourceYoutubeTab');
    const tabAud = document.getElementById('sourceAudioTab');
    const tabVid = document.getElementById('sourceVideoTab');
    const tabMan = document.getElementById('sourceManualTab');

    if (tabYt) tabYt.classList.toggle('hidden', tab !== 'youtube');
    if (tabAud) tabAud.classList.toggle('hidden', tab !== 'audio');
    if (tabVid) tabVid.classList.toggle('hidden', tab !== 'video');
    if (tabMan) tabMan.classList.toggle('hidden', tab !== 'manual');

    const btnYt = document.getElementById('tabSourceYoutubeBtn');
    const btnAud = document.getElementById('tabSourceAudioBtn');
    const btnVid = document.getElementById('tabSourceVideoBtn');
    const btnMan = document.getElementById('tabSourceManualBtn');

    if (btnYt) btnYt.classList.toggle('active', tab === 'youtube');
    if (btnAud) btnAud.classList.toggle('active', tab === 'audio');
    if (btnVid) btnVid.classList.toggle('active', tab === 'video');
    if (btnMan) btnMan.classList.toggle('active', tab === 'manual');
  }

  function showStatus(msg, type = 'info') {
    const box = document.getElementById('transcribeStatusBox');
    if (!box) return;
    box.className = `alert alert-${type}`;
    box.innerHTML = msg;
    box.classList.remove('hidden');
  }

  // --- Client-Side Caption Fallback Helpers ---
  function extractVideoId(urlOrId) {
    if (!urlOrId || typeof urlOrId !== 'string') return null;
    const trimmed = urlOrId.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/i,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i,
      /(?:https?:\/\/)?m\.youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i
    ];
    for (const regex of patterns) {
      const match = trimmed.match(regex);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  function decodeHtml(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  function parseBrowserSubtitleTrack(rawContent, _lang = 'en') {
    if (!rawContent || typeof rawContent !== 'string') return null;
    const content = rawContent.replace(/^\uFEFF/, '').trim();
    if (!content) return null;

    const lines = content.split(/\r?\n/);
    const items = [];

    // JSON3 / JSON format
    if (content.startsWith('{') || content.startsWith('[')) {
      try {
        const jsonData = JSON.parse(content);
        if (Array.isArray(jsonData.events)) {
          for (const ev of jsonData.events) {
            if (!ev.segs || !Array.isArray(ev.segs)) continue;
            const text = ev.segs.map(s => s.utf8 || '').join('').replace(/[\r\n]+/g, ' ').trim();
            if (!text || text === '\n') continue;
            const startSec = Math.floor((ev.tStartMs || 0) / 1000);
            const mins = Math.floor(startSec / 60).toString().padStart(2, '0');
            const secs = (startSec % 60).toString().padStart(2, '0');
            items.push({
              timestamp: `[${mins}:${secs}]`,
              offsetSec: startSec,
              text: decodeHtml(text)
            });
          }
        }
      } catch (_) {}
    }

    // VTT / SRT format
    const timecodeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.]\d{3}\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.]\d{3}/;
    const isVttOrSrt = content.includes('WEBVTT') || lines.some(l => timecodeRegex.test(l));

    if (items.length === 0 && isVttOrSrt) {
      let currentTimestamp = '[00:00]';
      let currentOffsetSec = 0;
      let textBuffer = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line === 'WEBVTT' || /^\d+$/.test(line) || /^NOTE\b/.test(line)) continue;

        const tcMatch = line.match(timecodeRegex);
        if (tcMatch) {
          if (textBuffer.length > 0) {
            const joinedText = decodeHtml(textBuffer.join(' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
            if (joinedText) {
              items.push({
                timestamp: currentTimestamp,
                offsetSec: currentOffsetSec,
                text: joinedText
              });
            }
            textBuffer = [];
          }
          const hours = parseInt(tcMatch[1] || '0', 10);
          const mins = parseInt(tcMatch[2], 10) + (hours * 60);
          const secs = parseInt(tcMatch[3], 10);
          currentOffsetSec = mins * 60 + secs;
          currentTimestamp = `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
        } else {
          const clean = line.replace(/<[^>]+>/g, '').trim();
          if (clean) textBuffer.push(clean);
        }
      }

      if (textBuffer.length > 0) {
        const joinedText = decodeHtml(textBuffer.join(' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
        if (joinedText) {
          items.push({
            timestamp: currentTimestamp,
            offsetSec: currentOffsetSec,
            text: joinedText
          });
        }
      }
    }

    // XML TimedText format
    if (items.length === 0 && (content.includes('<transcript') || content.includes('<timedtext') || content.includes('<p ') || content.includes('<text '))) {
      const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
      let match;
      while ((match = pRegex.exec(content)) !== null) {
        const startMs = parseInt(match[1], 10);
        let t = match[3].replace(/<[^>]+>/g, '');
        t = decodeHtml(t).replace(/\s+/g, ' ').trim();
        if (t) {
          const totalSecs = Math.floor(startMs / 1000);
          const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
          const secs = (totalSecs % 60).toString().padStart(2, '0');
          items.push({
            timestamp: `[${mins}:${secs}]`,
            offsetSec: totalSecs,
            text: t
          });
        }
      }

      if (items.length === 0) {
        const textRegex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
        let tMatch;
        while ((tMatch = textRegex.exec(content)) !== null) {
          const startSec = parseFloat(tMatch[1]) || 0;
          let t = tMatch[3].replace(/<[^>]+>/g, '');
          t = decodeHtml(t).replace(/\s+/g, ' ').trim();
          if (t) {
            const totalSecs = Math.floor(startSec);
            const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
            const secs = (totalSecs % 60).toString().padStart(2, '0');
            items.push({
              timestamp: `[${mins}:${secs}]`,
              offsetSec: totalSecs,
              text: t
            });
          }
        }
      }
    }

    if (items.length === 0) {
      const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0 && !/^\d+$/.test(l));
      if (cleanLines.length > 0) {
        cleanLines.forEach((cl, idx) => {
          items.push({
            timestamp: `[${Math.floor(idx / 2).toString().padStart(2, '0')}:00]`,
            offsetSec: idx * 30,
            text: decodeHtml(cl)
          });
        });
      }
    }

    if (items.length === 0) return null;

    // Deduplicate consecutive lines
    const dedupedItems = [];
    for (let i = 0; i < items.length; i++) {
      if (dedupedItems.length === 0 || dedupedItems[dedupedItems.length - 1].text !== items[i].text) {
        dedupedItems.push(items[i]);
      }
    }

    const timestampedText = dedupedItems.map(it => `${it.timestamp} ${it.text}`).join('\n');
    const fullText = dedupedItems.map(it => it.text).join(' ');
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    return {
      rawItems: dedupedItems,
      timestampedText,
      fullText,
      wordCount
    };
  }

  async function fetchTranscriptFromBrowser(videoId, requestedLang = 'en') {
    if (!videoId) return { success: false, error: 'No video ID provided' };

    const corsProxies = [
      url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    async function fetchWithProxies(targetUrl, timeoutMs = 4500) {
      for (const proxyFn of corsProxies) {
        try {
          const pUrl = proxyFn(targetUrl);
          const res = await fetch(pUrl, { signal: AbortSignal.timeout(timeoutMs) });
          if (!res.ok) continue;
          const text = await res.text();
          if (!text || text.includes('A valid API key is required') || text.includes('Error:')) continue;
          if (text.startsWith('{"contents":')) {
            try {
              const parsed = JSON.parse(text);
              if (parsed.contents) return parsed.contents;
            } catch (_) {}
          }
          return text;
        } catch (_) {}
      }
      return null;
    }

    // Method 1: TimedText direct track queries
    try {
      const candidateLangs = [requestedLang, 'en', 'hi'].filter((v, i, a) => v && a.indexOf(v) === i);
      for (const lang of candidateLangs) {
        for (const fmt of ['vtt', 'srv3']) {
          const directUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=${fmt}`;
          const subContent = await fetchWithProxies(directUrl, 3500);
          if (subContent) {
            const parsed = parseBrowserSubtitleTrack(subContent, lang);
            if (parsed && parsed.wordCount > 10) {
              return {
                success: true,
                ...parsed,
                language: lang,
                source: 'YouTube Direct Captions'
              };
            }
          }
        }
      }
    } catch (_) {}

    // Method 2: Public Piped & Invidious APIs
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.adminforge.de',
      'https://api.piped.private.coffee'
    ];
    for (const base of pipedInstances) {
      try {
        const streamRes = await fetch(`${base}/streams/${videoId}`, { signal: AbortSignal.timeout(4000) });
        if (!streamRes.ok) continue;
        const data = await streamRes.json();
        const subtitles = data.subtitles || [];
        if (!Array.isArray(subtitles) || subtitles.length === 0) continue;

        const chosen = subtitles.find(s => s.code === requestedLang) ||
                       subtitles.find(s => s.code && s.code.startsWith(requestedLang)) ||
                       subtitles.find(s => s.code === 'en' || s.code?.startsWith('en')) ||
                       subtitles[0];

        if (chosen && chosen.url) {
          let raw = null;
          try {
            const subRes = await fetch(chosen.url, { signal: AbortSignal.timeout(4000) });
            if (subRes.ok) raw = await subRes.text();
          } catch (_) {
            raw = await fetchWithProxies(chosen.url, 4000);
          }
          if (raw) {
            const parsed = parseBrowserSubtitleTrack(raw, chosen.code || requestedLang);
            if (parsed && parsed.wordCount > 10) {
              return {
                success: true,
                ...parsed,
                title: data.title || null,
                language: chosen.code || requestedLang,
                source: `Piped API (${new URL(base).hostname})`
              };
            }
          }
        }
      } catch (_) {}
    }

    // Method 3: Scrape captionTracks from YouTube watch page
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const html = await fetchWithProxies(watchUrl, 5000);
      if (html && html.includes('captionTracks')) {
        let title = null;
        const titleMatch = html.match(/<title>(.*?)(?: - YouTube)?<\/title>/i) ||
                           html.match(/"videoDetails":\{.*?"title":"([^"]+)"/);
        if (titleMatch) {
          title = decodeHtml(titleMatch[1]).replace(/\s*-\s*YouTube$/i, '').trim();
        }

        const tracksMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
        if (tracksMatch) {
          let tracks = [];
          try { tracks = JSON.parse(tracksMatch[1]); } catch (_) {}
          if (Array.isArray(tracks) && tracks.length > 0) {
            const chosen = tracks.find(t => t.languageCode === requestedLang) ||
                           tracks.find(t => t.languageCode && t.languageCode.startsWith(requestedLang)) ||
                           tracks.find(t => t.languageCode === 'en' || t.languageCode?.startsWith('en')) ||
                           tracks[0];
            if (chosen && chosen.baseUrl) {
              const subContent = await fetchWithProxies(`${chosen.baseUrl}&fmt=vtt`, 4500) ||
                                 await fetchWithProxies(chosen.baseUrl, 4500);
              if (subContent) {
                const parsed = parseBrowserSubtitleTrack(subContent, chosen.languageCode || requestedLang);
                if (parsed && parsed.wordCount > 10) {
                  return {
                    success: true,
                    ...parsed,
                    title,
                    language: chosen.languageCode || requestedLang,
                    source: 'YouTube Watch Page'
                  };
                }
              }
            }
          }
        }
      }
    } catch (_) {}

    return {
      success: false,
      error: 'Could not fetch captions from YouTube timedtext, mirrors, or watch page proxy.'
    };
  }

  // --- 1. YouTube Transcription ---
  async function fetchYouTubeTranscript() {
    const urlInput = document.getElementById('youtubeUrlInput');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) return showStatus('Please paste a YouTube URL or Video ID.', 'warning');

    const langSelect = document.getElementById('youtubeLangSelect');
    const lang = langSelect ? langSelect.value : 'en';
    const btn = document.getElementById('fetchYoutubeBtn');
    if (btn) btn.disabled = true;

    showStatus('⏳ Extracting YouTube subtitles and timestamps...', 'info');

    try {
      // Step A: Attempt server-side transcription
      const res = await fetch('/transcription/api/fetch-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url, language: lang })
      });
      const data = await res.json();

      if (data && data.success) {
        currentTranscriptData = data;
        const transcriptText = data.fullText || data.timestampedText;
        displayTranscript(transcriptText, data.wordCount);
        showStatus(`✅ Transcript retrieved automatically (${data.wordCount} words${data.isAutoGenerated ? ' [Auto-Generated Captions]' : ''})! Generating Complete Academic Study Pack with AI...`, 'info');
        await generateCompleteStudyPack(transcriptText);
        return;
      }

      // Step B: Client-side browser caption fallback if backend is rate-limited or blocked
      const videoId = extractVideoId(url);
      if (videoId) {
        showStatus('⏳ Server caption extraction restricted. Attempting client-side browser caption retrieval...', 'info');
        const browserResult = await fetchTranscriptFromBrowser(videoId, lang);

        if (browserResult && browserResult.success) {
          currentTranscriptData = {
            ...browserResult,
            sourceType: 'youtube',
            videoId,
            sourceUrl: url
          };
          const transcriptText = browserResult.fullText || browserResult.timestampedText;
          displayTranscript(transcriptText, browserResult.wordCount);
          showStatus(`✅ Transcript retrieved automatically via browser ${browserResult.source} (${browserResult.wordCount} words)! Generating Complete Academic Study Pack...`, 'info');
          await generateCompleteStudyPack(transcriptText);
          return;
        }
      }

      // Step C: Fallback guidance
      const fallbackBox = document.getElementById('ytUploadFallbackCard');
      if (fallbackBox) fallbackBox.classList.remove('hidden');

      if (data && (data.errorCode === 'RATE_LIMITED' || data.isRateLimited)) {
        let remaining = data.cooldownRemainingSec || 60;
        showStatus(`⏳ <strong>YouTube Cooldown Active:</strong> Caption requests are resting for <strong id="cooldownTimer">${remaining}s</strong>. You can switch to the <strong>Text / Notes</strong> tab or upload a subtitle file (.txt, .srt) below to continue immediately.`, 'warning');
        if (window._cooldownInterval) clearInterval(window._cooldownInterval);
        window._cooldownInterval = setInterval(() => {
          remaining--;
          const timerEl = document.getElementById('cooldownTimer');
          if (timerEl) timerEl.textContent = `${remaining}s`;
          if (remaining <= 0) {
            clearInterval(window._cooldownInterval);
            showStatus('✅ Cooldown expired. You may now retry fetching transcripts.', 'info');
          }
        }, 1000);
      } else {
        showStatus(`⚠️ Captions unavailable automatically for this video. You can upload a transcript file (.txt, .srt) or paste lecture notes in the <strong>Text / Notes</strong> tab to generate your study pack!`, 'warning');
      }
    } catch (e) {
      showStatus(`⚠️ Error: ${e.message}. Switch to the <strong>Text / Notes</strong> tab to paste lecture notes or upload a subtitle file.`, 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // --- 2. File Upload for Subtitle / Transcript (.txt, .srt, .vtt) ---
  async function handleManualFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    showStatus(`⏳ Reading transcript file "${file.name}"...`, 'info');

    const formData = new FormData();
    formData.append('transcriptFile', file);

    try {
      const res = await fetch('/transcription/api/upload-text-file', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        showStatus(`⚠️ Failed to parse file: ${data.error}`, 'warning');
        return;
      }

      const manualInput = document.getElementById('manualTranscriptInput');
      if (manualInput) manualInput.value = data.timestampedText || data.fullText;

      currentTranscriptData = {
        sourceType: 'manual',
        fileName: file.name,
        timestampedText: data.timestampedText,
        fullText: data.fullText,
        wordCount: data.wordCount,
        timestampedTranscript: data.timestampedTranscript || []
      };
      displayTranscript(data.timestampedText || data.fullText, data.wordCount);
      showStatus(`✅ Uploaded "${file.name}" (${data.wordCount} words)! Automatically generating Complete Academic Pack...`, 'success');
      await generateCompleteStudyPack();
    } catch (err) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const manualInput = document.getElementById('manualTranscriptInput');
        if (manualInput) manualInput.value = text;
        await useManualTranscript();
      };
      reader.onerror = () => showStatus('Could not read file locally.', 'danger');
      reader.readAsText(file);
    }
  }

  // --- 3. Audio & Video Media Upload Speech-to-Text ---
  async function uploadAndTranscribeMedia(inputId) {
    const fileInput = document.getElementById(inputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      return showStatus('Please select a media file to upload.', 'warning');
    }

    const file = fileInput.files[0];
    if (file.size > 50 * 1024 * 1024) {
      return showStatus('File size exceeds 50MB limit.', 'warning');
    }

    const formData = new FormData();
    formData.append('mediaFile', file);
    showStatus(`⏳ Uploading & transcribing media (${(file.size / 1024 / 1024).toFixed(1)} MB)... This may take 30-60 seconds.`, 'info');

    try {
      const res = await fetch('/transcription/api/upload-media', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        showStatus(`⚠️ ${data.error}`, 'warning');
        return;
      }

      currentTranscriptData = data;
      displayTranscript(data.timestampedText, data.wordCount);
      showStatus(`✅ Media successfully transcribed (${data.wordCount} words)! Automatically generating Complete Academic Pack...`, 'success');
      await generateCompleteStudyPack();
    } catch (e) {
      showStatus(`⚠️ Transcription error: ${e.message}`, 'danger');
    }
  }

  // --- 4. Manual Text Paste ---
  async function useManualTranscript() {
    const input = document.getElementById('manualTranscriptInput');
    const text = input ? input.value.trim() : '';
    if (!text) return showStatus('Please paste transcript or lecture notes text.', 'warning');

    const words = text.split(/\s+/).filter(Boolean).length;
    currentTranscriptData = {
      sourceType: 'manual',
      timestampedText: text,
      fullText: text,
      wordCount: words,
      timestampedTranscript: []
    };
    displayTranscript(text, words);
    showStatus(`✅ Accepted manual transcript (${words} words)! Automatically generating Complete Academic Pack...`, 'success');
    await generateCompleteStudyPack();
  }

  function displayTranscript(text, wordCount) {
    const area = document.getElementById('transcriptTextarea');
    if (area) area.value = text;
    const countEl = document.getElementById('transcriptWordCount');
    if (countEl) countEl.textContent = `${wordCount} words`;
    const viewCard = document.getElementById('transcriptViewCard');
    if (viewCard) viewCard.classList.remove('hidden');
  }

  // --- 5. Generate Complete 15-Dimension Study Pack ---
  async function generateCompleteStudyPack(directText) {
    const txtArea = document.getElementById('transcriptTextarea');
    const transcriptText = (directText || (txtArea && txtArea.value) || (currentTranscriptData && (currentTranscriptData.fullText || currentTranscriptData.timestampedText)) || '').trim();
    if (!transcriptText) return alert('No transcript available.');

    const topicInput = document.getElementById('customTopicInput');
    const topicTitle = (topicInput && topicInput.value.trim()) || 'General Topic';
    const catSelect = document.getElementById('categorySelect');
    const categoryName = (catSelect && catSelect.options[catSelect.selectedIndex]) ?
      catSelect.options[catSelect.selectedIndex].text : 'Computer Science';

    const btn = document.getElementById('generateStudyPackBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Generating 15 Academic Sections...';
    }
    showStatus('🧠 Generating Complete Academic Pack across all 15 dimensions...', 'info');

    try {
      const res = await fetch('/transcription/api/generate-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName, topicTitle, transcriptText })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      currentStudyPack = data.studyMaterials;
      renderStudyPack(data.studyMaterials, topicTitle, categoryName);

      const studyCard = document.getElementById('studyPackCard');
      if (studyCard) {
        studyCard.classList.remove('hidden');
        studyCard.scrollIntoView({ behavior: 'smooth' });
      }

      showStatus('✅ Complete Academic Study Pack generated! All sections are ready below.', 'success');
    } catch (e) {
      showStatus(`⚠️ Study Pack Error: ${e.message}`, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '✨ Re-generate 15-Section Academic Pack';
      }
    }
  }

  // --- 6. Render Study Pack Panes & Formatting ---
  function renderStudyPack(m, topicTitle, _categoryName) {
    const badge = document.getElementById('packTopicBadge');
    if (badge) badge.textContent = topicTitle || 'Study Pack';

    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count !== undefined ? count : 0;
    };
    setBadge('badgeTopicNotes', (m.topicWiseNotes || []).length);
    setBadge('badgeSubtopics', (m.subtopicWiseNotes || []).length);
    setBadge('badgeDetailedNotes', (m.detailedExplanations || []).length);
    setBadge('badgeDefinitions', (m.importantDefinitions || []).length);
    setBadge('badgeConcepts', (m.keyConcepts || []).length);
    setBadge('badgeRealWorld', (m.realWorldExamples || []).length);
    setBadge('badgeSolvedExamples', (m.solvedExamples || m.examples || []).length);
    setBadge('badgeFlashcards', (m.flashcards || []).length);
    setBadge('badgeMcqs', (m.practiceMcqs || []).length);
    setBadge('badgeShortAnswers', (m.shortAnswerQuestions || []).length);
    setBadge('badgeLongAnswers', (m.longAnswerQuestions || []).length);
    setBadge('badgeInterviews', (m.interviewQuestions || []).length);
    setBadge('badgeViva', (m.vivaQuestions || []).length);
    setBadge('badgePyqs', (m.previousYearQuestions || []).length);
    setBadge('badgeFaqs', (m.faqs || []).length);
    setBadge('badgePracticeTests', (m.practiceTests || []).length);

    // 1. Summary
    const packSummary = document.getElementById('packSummary');
    if (packSummary) {
      packSummary.innerHTML = `
        <div style="padding: 16px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 style="margin: 0; font-weight: 700; color: var(--accent-primary);">📝 Complete Lecture Summary</h4>
            <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('lectureSummary')" style="font-size: 0.72rem; padding: 2px 7px;">🔄 Regenerate</button>
          </div>
          <p style="margin: 0; line-height: 1.6; color: var(--text-primary); font-size: 0.95rem;">
            ${formatMath(m.lectureSummary || m.shortSummary || 'Comprehensive academic lecture overview synthesized directly from verbatim transcript.')}
          </p>
        </div>
      `;
    }

    // 2. Topic-wise Notes
    const packTopicNotes = document.getElementById('packTopicNotes');
    if (packTopicNotes) {
      const topicNotesHtml = (m.topicWiseNotes || []).map((tp, idx) => `
        <div class="topic-note-card" style="margin-bottom: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-primary);">
          <div class="topic-header" onclick="toggleTopicExpansion('${tp.id || 'tp_' + idx}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; cursor: pointer; user-select: none; background: var(--bg-surface); border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span id="chevron_${tp.id || 'tp_' + idx}" style="font-size: 0.8rem; color: var(--text-muted); transition: transform 0.2s;">▼</span>
              <strong style="font-size: 0.96rem;">${formatMath(tp.title)}</strong>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${tp.timestamp ? `<span class="unit-number-badge" style="font-size: 0.72rem; cursor: pointer;" title="Timestamp reference" onclick="event.stopPropagation(); jumpToTimestamp('${tp.timestamp}')">⏱️ ${tp.timestamp}</span>` : ''}
              <span style="font-size: 0.72rem; color: var(--text-muted);">${(tp.subtopics || []).length} Subtopics</span>
            </div>
          </div>

          <div id="topic_body_${tp.id || 'tp_' + idx}" class="topic-body" style="padding: 16px;">
            ${(tp.subtopics && tp.subtopics.length > 0) ? `
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                ${tp.subtopics.map(st => `<span style="font-size: 0.75rem; padding: 2px 8px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; color: var(--text-secondary);">📌 ${formatMath(st)}</span>`).join('')}
              </div>
            ` : ''}

            ${tp.introduction ? `
              <div style="margin-bottom: 12px; padding: 10px 14px; background: var(--bg-surface); border-radius: 6px;">
                <strong style="font-size: 0.82rem; color: var(--text-muted); text-transform: uppercase;">Introduction:</strong>
                <p style="margin: 4px 0 0; font-size: 0.88rem; line-height: 1.5; color: var(--text-primary);">${formatMath(tp.introduction)}</p>
              </div>
            ` : ''}

            ${tp.definition ? `
              <div style="margin-bottom: 12px; padding: 10px 14px; background: var(--bg-surface); border-left: 3px solid #10b981; border-radius: 4px;">
                <strong style="font-size: 0.82rem; color: #10b981; text-transform: uppercase;">Formal Definition:</strong>
                <p style="margin: 4px 0 0; font-size: 0.88rem; line-height: 1.5; color: var(--text-primary);">${formatMath(tp.definition)}</p>
              </div>
            ` : ''}

            <div style="margin-bottom: 14px; padding: 12px; background: var(--bg-surface); border-radius: 6px; border-left: 3px solid var(--accent-primary);">
              <strong style="font-size: 0.85rem; color: var(--accent-primary); display: block; margin-bottom: 4px;">📖 Detailed Topic Explanation</strong>
              <p style="margin: 0; font-size: 0.9rem; line-height: 1.55; color: var(--text-primary); white-space: pre-wrap;">${formatMath(tp.detailedExplanation || tp.simpleExplanation)}</p>
            </div>

            ${(tp.importantPoints && tp.importantPoints.length > 0) ? `
              <div style="margin-bottom: 12px;">
                <strong style="font-size: 0.84rem; color: var(--text-muted); text-transform: uppercase;">Important Points:</strong>
                <ul style="margin: 6px 0 0; padding-left: 18px; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5;">
                  ${tp.importantPoints.map(pt => `<li style="margin-bottom: 4px;">${formatMath(pt)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${(tp.examples && tp.examples.length > 0) ? `
              <div style="margin-bottom: 12px;">
                <strong style="font-size: 0.84rem; color: var(--text-muted); text-transform: uppercase;">Practical Examples:</strong>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
                  ${tp.examples.map(ex => `
                    <div style="font-size: 0.86rem; padding: 8px 12px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-color);">
                      <strong style="color: var(--accent-primary);">${formatMath(ex.title || 'Example')}:</strong>
                      <span style="display: block; margin-top: 2px; color: var(--text-secondary);">${formatMath(ex.explanation || ex.scenario || '')}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${(tp.relatedQuestions && tp.relatedQuestions.length > 0) ? `
              <div>
                <strong style="font-size: 0.84rem; color: var(--text-muted); text-transform: uppercase;">Related Exam Questions:</strong>
                <ul style="margin: 6px 0 0; padding-left: 18px; font-size: 0.86rem; color: var(--text-secondary);">
                  ${tp.relatedQuestions.map(rq => `<li style="margin-bottom: 3px;">❓ ${formatMath(rq)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');

      packTopicNotes.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <span style="font-size: 0.85rem; color: var(--text-muted);">Expand individual topics to review introduction, definitions, explanations, points, and examples.</span>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="expandAllTopics(true)" style="font-size: 0.75rem; padding: 3px 8px;">➕ Expand All</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="expandAllTopics(false)" style="font-size: 0.75rem; padding: 3px 8px;">➖ Collapse All</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('topicWiseNotes')" style="font-size: 0.75rem; padding: 3px 8px;">🔄 Regenerate</button>
          </div>
        </div>
        ${topicNotesHtml || '<p>No topic-wise notes available.</p>'}
      `;
    }

    // 3. Subtopics
    const packSubtopics = document.getElementById('packSubtopics');
    if (packSubtopics) {
      packSubtopics.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('subtopicWiseNotes')" style="font-size: 0.72rem; padding: 2px 7px;">🔄 Regenerate</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${(m.subtopicWiseNotes || []).map(st => `
            <div style="padding: 14px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="font-size: 0.95rem; color: var(--accent-primary);">${formatMath(st.subtopicTitle)}</strong>
                <span class="unit-number-badge" style="font-size: 0.72rem;">${st.timestamp || '[00:00]'}</span>
              </div>
              <span style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 6px;">Parent: ${formatMath(st.parentTopic)}</span>
              <p style="margin: 0 0 8px; font-size: 0.88rem; line-height: 1.5; color: var(--text-secondary);">${formatMath(st.summary)}</p>
              ${(st.keyTakeaways && st.keyTakeaways.length > 0) ? `
                <div style="font-size: 0.82rem; color: var(--text-muted);">
                  <strong>Key Takeaways:</strong>
                  <ul style="margin: 4px 0 0; padding-left: 18px;">
                    ${st.keyTakeaways.map(kt => `<li>${formatMath(kt)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('') || '<p>No subtopic notes generated.</p>'}
        </div>
      `;
    }

    // 4. Detailed Explanations
    const packDetailedNotes = document.getElementById('packDetailedNotes');
    if (packDetailedNotes) {
      packDetailedNotes.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('detailedExplanations')" style="font-size: 0.72rem; padding: 2px 7px;">🔄 Regenerate</button>
        </div>
        ${(m.detailedExplanations || []).map(n => `
          <div style="margin-bottom: 14px; padding: 14px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <h4 style="margin: 0; font-weight: 700; font-size: 0.98rem; color: var(--accent-primary);">${formatMath(n.heading)}</h4>
              ${n.timestampRef ? `<span class="unit-number-badge" style="font-size: 0.7rem; cursor: pointer;" onclick="jumpToTimestamp('${n.timestampRef}')">${n.timestampRef}</span>` : ''}
            </div>
            <p style="margin: 0 0 8px; color: var(--text-secondary); white-space: pre-wrap; font-size: 0.88rem; line-height: 1.55;">${formatMath(n.content)}</p>
            ${n.takeaway ? `<div style="font-size: 0.8rem; color: var(--text-muted); background: var(--bg-surface); padding: 4px 8px; border-radius: 4px;">💡 <strong>Takeaway:</strong> ${formatMath(n.takeaway)}</div>` : ''}
          </div>
        `).join('') || '<p>No detailed explanations.</p>'}
      `;
    }

    // 5. Definitions
    const packDefinitions = document.getElementById('packDefinitions');
    if (packDefinitions) {
      packDefinitions.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('importantDefinitions')" style="font-size: 0.72rem; padding: 2px 7px;">🔄 Regenerate</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${(m.importantDefinitions || []).map(d => `
            <div style="padding: 12px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: var(--accent-primary); font-size: 0.94rem;">${formatMath(d.term)}</strong>
                ${d.timestampRef ? `<span class="unit-number-badge" style="font-size: 0.7rem;">${d.timestampRef}</span>` : ''}
              </div>
              <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.45;">${formatMath(d.definition)}</p>
              ${d.context ? `<span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 4px;">📚 Context: ${formatMath(d.context)}</span>` : ''}
            </div>
          `).join('') || '<p>No definitions available.</p>'}
        </div>
      `;
    }

    // 6. Formulas
    const packFormulas = document.getElementById('packFormulas');
    if (packFormulas) {
      packFormulas.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('formulas')" style="font-size: 0.72rem; padding: 2px 7px;">🔄 Regenerate</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${(m.formulas || []).map(f => `
            <div style="padding: 12px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <strong style="color: var(--accent-primary); font-size: 0.92rem;">${formatMath(f.name)}</strong>
              <div style="margin: 6px 0; padding: 6px 12px; background: var(--bg-surface); border-radius: 4px; font-family: monospace; font-size: 0.92rem; color: var(--accent-primary); font-weight: 700;">
                ${formatMath(f.formula)}
              </div>
              <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">${formatMath(f.explanation)}</p>
              ${f.variables ? `<span style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-top: 4px;">Parameters: ${formatMath(f.variables)}</span>` : ''}
            </div>
          `).join('') || '<p>No formulas available.</p>'}
        </div>
      `;
    }

    // 7. Flashcards setup
    currentFlashcards = (m.flashcards && m.flashcards.length > 0) ? m.flashcards : [
      {
        id: 1,
        front: `What is the primary definition of ${topicTitle}?`,
        back: (m.importantDefinitions && m.importantDefinitions[0]) ? m.importantDefinitions[0].definition : `Core computing principle.`,
        topic: topicTitle,
        difficultyLevel: 'Easy',
        hint: 'Fundamental definition',
        completed: false
      }
    ];
    currentCardIndex = 0;
    isCardFlipped = false;
    completedFlashcardIndices.clear();
    renderFlashcardView();

    // 8. MCQs setup
    currentMcqs = (m.practiceMcqs && m.practiceMcqs.length > 0) ? m.practiceMcqs : [
      {
        id: 1,
        question: `What is the primary objective of studying ${topicTitle}?`,
        options: [
          `To build reliable, scalable, and modular computational systems`,
          `To bypass compiler checks`,
          `To consume unbounded memory`,
          `None of the above`
        ],
        correctOption: 0,
        explanation: 'Option A is correct based on core engineering principles.',
        difficultyLevel: 'Easy',
        relatedTopic: topicTitle
      }
    ];
    currentMcqAnswers = {};
    currentSelectedOption = null;
    currentMcqIndex = 0;
    renderInteractiveMcqs(currentMcqs);

    // 9. Short Answers
    const packShortAnswers = document.getElementById('packShortAnswers');
    if (packShortAnswers) {
      packShortAnswers.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('shortAnswerQuestions')" style="font-size: 0.72rem; padding: 2px 7px;">🔄 Regenerate</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${(m.shortAnswerQuestions || []).map((q, idx) => `
            <div style="padding: 12px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="font-size: 0.92rem;">Q${idx + 1}: ${formatMath(q.question)}</strong>
                <span class="unit-number-badge" style="font-size: 0.72rem;">${q.marks || 2} Marks</span>
              </div>
              <p style="margin: 0 0 6px; font-size: 0.88rem; line-height: 1.45; color: var(--text-secondary);">${formatMath(q.answer)}</p>
              ${(q.keyPoints && q.keyPoints.length > 0) ? `
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  <strong>Scoring Points:</strong> ${q.keyPoints.map(kp => formatMath(kp)).join(' • ')}
                </div>
              ` : ''}
            </div>
          `).join('') || '<p>No short answer questions available.</p>'}
        </div>
      `;
    }

    // 10. Long Answers
    const packLongAnswers = document.getElementById('packLongAnswers');
    if (packLongAnswers) {
      packLongAnswers.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('longAnswerQuestions')" style="font-size: 0.72rem; padding: 2px 7px;">🔄 Regenerate</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${(m.longAnswerQuestions || []).map((q, idx) => `
            <div style="padding: 14px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 0.96rem; color: var(--accent-primary);">Q${idx + 1}: ${formatMath(q.question)}</strong>
                <span class="unit-number-badge" style="font-size: 0.75rem; background: #8b5cf620; color: #8b5cf6;">${q.marks || 7} Marks</span>
              </div>
              <p style="margin: 0 0 10px; font-size: 0.9rem; line-height: 1.55; color: var(--text-primary);">${formatMath(q.answer)}</p>
            </div>
          `).join('') || '<p>No long answer questions available.</p>'}
        </div>
      `;
    }

    // Reset view to summary tab
    switchPackTab('summary');
  }

  // --- Flashcard Interactive Controls ---
  function renderFlashcardView() {
    const container = document.getElementById('packFlashcards');
    if (!container) return;
    if (!currentFlashcards || currentFlashcards.length === 0) {
      container.innerHTML = '<p>No flashcards available for this lecture.</p>';
      return;
    }

    const total = currentFlashcards.length;
    const card = currentFlashcards[currentCardIndex];
    const isCompleted = completedFlashcardIndices.has(currentCardIndex);
    const completedCount = completedFlashcardIndices.size;
    const progressPercent = Math.round((completedCount / total) * 100);
    const diffBadge = card.difficultyLevel || card.difficulty || 'Medium';

    container.innerHTML = `
      <div style="max-width: 640px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
          <div>
            <strong style="font-size: 0.95rem;">Card ${currentCardIndex + 1} of ${total}</strong>
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 6px;">(${completedCount} completed • ${progressPercent}%)</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="unit-number-badge" style="font-size: 0.75rem;">${card.topic || 'Flashcard'}</span>
            <span class="nav-badge" style="font-size: 0.72rem; ${diffBadge === 'Easy' ? 'background: #10b98120; color: #10b981;' : (diffBadge === 'Hard' ? 'background: #ef444420; color: #ef4444;' : 'background: #f59e0b20; color: #f59e0b;')}">${diffBadge}</span>
          </div>
        </div>

        <div class="progress-container" style="height: 6px; margin-bottom: 16px; background: var(--bg-surface); border-radius: 4px; overflow: hidden;">
          <div class="progress-bar-fill" style="width: ${progressPercent}%; height: 100%; background: #8b5cf6; transition: width 0.3s ease;"></div>
        </div>

        <div id="interactiveFlashcard" onclick="flipActiveCard()" style="min-height: 220px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 32px 24px; cursor: pointer; user-select: none; border-radius: var(--radius-md); border: 2px solid ${isCompleted ? '#10b981' : 'var(--border-color)'}; background: var(--bg-surface); position: relative; box-shadow: var(--shadow-sm); transition: transform 0.2s ease;">
          <div style="position: absolute; top: 12px; left: 16px; font-size: 0.72rem; font-weight: 700; color: var(--accent-primary); text-transform: uppercase;">
            ${isCardFlipped ? 'ANSWER / BACK' : 'QUESTION / FRONT'}
          </div>

          ${isCompleted ? `
            <div style="position: absolute; top: 12px; right: 16px; font-size: 0.72rem; font-weight: 700; color: #10b981; background: #10b98120; padding: 2px 8px; border-radius: 12px;">
              ✅ Completed
            </div>
          ` : ''}

          <div style="font-size: 1.15rem; font-weight: 600; line-height: 1.5; color: var(--text-primary); white-space: pre-line;">
            ${formatMath(isCardFlipped ? card.back : card.front)}
          </div>

          ${(!isCardFlipped && card.hint) ? `
            <div style="margin-top: 12px; font-size: 0.78rem; color: var(--text-muted);">
              💡 Clue: ${formatMath(card.hint)}
            </div>
          ` : ''}

          <div style="position: absolute; bottom: 10px; font-size: 0.75rem; color: var(--text-muted);">
            🔄 Click card or button below to flip
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="prevFlashcard()" ${currentCardIndex === 0 ? 'disabled' : ''}>
              ← Previous
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="flipActiveCard()">
              🔄 Flip
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="nextFlashcard()" ${currentCardIndex === total - 1 ? 'disabled' : ''}>
              Next →
            </button>
          </div>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="shuffleActiveFlashcards()" title="Shuffle flashcards">
              🔀 Shuffle
            </button>
            <button type="button" class="btn ${isCompleted ? 'btn-secondary' : 'btn-success'} btn-sm" onclick="toggleActiveCardCompleted()">
              ${isCompleted ? '↩️ Unmark' : '✅ Mark as Completed'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('flashcards')" title="Regenerate flashcards">
              🔄 Regenerate
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function flipActiveCard() {
    isCardFlipped = !isCardFlipped;
    renderFlashcardView();
  }

  function nextFlashcard() {
    if (currentCardIndex < currentFlashcards.length - 1) {
      currentCardIndex++;
      isCardFlipped = false;
      renderFlashcardView();
    }
  }

  function prevFlashcard() {
    if (currentCardIndex > 0) {
      currentCardIndex--;
      isCardFlipped = false;
      renderFlashcardView();
    }
  }

  function shuffleActiveFlashcards() {
    for (let i = currentFlashcards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentFlashcards[i], currentFlashcards[j]] = [currentFlashcards[j], currentFlashcards[i]];
    }
    currentCardIndex = 0;
    isCardFlipped = false;
    completedFlashcardIndices.clear();
    renderFlashcardView();
    if (window.showToast) window.showToast('Flashcards shuffled!', 'info');
  }

  function toggleActiveCardCompleted() {
    if (completedFlashcardIndices.has(currentCardIndex)) {
      completedFlashcardIndices.delete(currentCardIndex);
    } else {
      completedFlashcardIndices.add(currentCardIndex);
    }
    renderFlashcardView();
  }

  // --- Interactive MCQs ---
  function renderInteractiveMcqs(mcqList) {
    const container = document.getElementById('packMcqs');
    if (!container) return;
    currentMcqs = mcqList || [];
    if (!currentMcqs || currentMcqs.length === 0) {
      container.innerHTML = '<p>No practice MCQs available.</p>';
      return;
    }

    const answeredCount = Object.keys(currentMcqAnswers).length;
    let score = 0;
    Object.keys(currentMcqAnswers).forEach(qIdx => {
      if (currentMcqAnswers[qIdx].isCorrect) score++;
    });

    const allAnswered = answeredCount === currentMcqs.length && currentMcqs.length > 0;
    const scorePercent = Math.round((score / currentMcqs.length) * 100);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 10px 14px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
        <div>
          <strong style="font-size: 0.95rem;">🎯 Practice Quiz Mode</strong>
          <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">Select an option and submit for verification</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--accent-primary);">
            Score: ${score} / ${answeredCount} answered (${currentMcqs.length} total)
          </span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="resetInteractiveMcqs()" style="padding: 3px 8px; font-size: 0.75rem;">
            🔄 Reset
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="regenerateWorkspaceSection('practiceMcqs')" style="padding: 3px 8px; font-size: 0.75rem;">
            ✨ Regenerate
          </button>
        </div>
      </div>

      ${allAnswered ? `
        <div style="margin-bottom: 18px; padding: 16px 20px; background: #10b98115; border: 2px solid #10b981; border-radius: var(--radius-md); text-align: center;">
          <h3 style="margin: 0 0 6px; font-size: 1.25rem; color: #047857;">🎉 Practice Quiz Completed!</h3>
          <p style="margin: 0 0 10px; font-size: 0.95rem; color: var(--text-primary);">
            Final Score: <strong>${score} / ${currentMcqs.length} (${scorePercent}%)</strong> • Mastery Level: 
            <span class="nav-badge" style="font-size: 0.8rem; background: #10b981; color: white;">${scorePercent >= 80 ? 'Master' : (scorePercent >= 50 ? 'Proficient' : 'Needs Review')}</span>
          </p>
          <button type="button" class="btn btn-primary btn-sm" onclick="resetInteractiveMcqs()">Retake Quiz</button>
        </div>
      ` : ''}

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${currentMcqs.map((mcq, qIdx) => {
          const ans = currentMcqAnswers[qIdx];
          const hasAnswered = ans !== undefined;
          const isSelectedPending = !hasAnswered && currentSelectedOption && currentSelectedOption.qIdx === qIdx;
          const diffBadge = mcq.difficultyLevel || mcq.difficulty || 'Medium';

          return `
            <div style="padding: 14px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 8px;">
                <strong style="font-size: 0.94rem;">
                  Q${qIdx + 1}: ${formatMath(mcq.question)}
                </strong>
                <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                  <span class="unit-number-badge" style="font-size: 0.7rem;">${mcq.relatedTopic || mcq.topic || 'Concept'}</span>
                  <span class="nav-badge" style="font-size: 0.7rem; ${diffBadge === 'Easy' ? 'background: #10b98120; color: #10b981;' : (diffBadge === 'Hard' ? 'background: #ef444420; color: #ef4444;' : 'background: #f59e0b20; color: #f59e0b;')}">${diffBadge}</span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                ${(mcq.options || []).map((opt, oIdx) => {
                  let optStyle = 'background: var(--bg-surface); border: 1px solid var(--border-color); cursor: pointer;';
                  let icon = '';

                  if (hasAnswered) {
                    optStyle = 'background: var(--bg-surface); border: 1px solid var(--border-color); cursor: default;';
                    if (oIdx === mcq.correctOption) {
                      optStyle = 'background: #10b98120; border: 2px solid #10b981; font-weight: 700; color: #047857;';
                      icon = ' ✅';
                    } else if (ans.selectedOption === oIdx && !ans.isCorrect) {
                      optStyle = 'background: #ef444420; border: 2px solid #ef4444; font-weight: 700; color: #b91c1c;';
                      icon = ' ❌';
                    }
                  } else if (isSelectedPending && currentSelectedOption.oIdx === oIdx) {
                    optStyle = 'background: var(--accent-light); border: 2px solid var(--accent-primary); font-weight: 600; color: var(--accent-primary);';
                  }

                  return `
                    <div onclick="selectWorkspaceMcqOption(${qIdx}, ${oIdx})" style="padding: 10px 12px; border-radius: 4px; font-size: 0.86rem; transition: background 0.15s; ${optStyle}">
                      <strong>${String.fromCharCode(65 + oIdx)}.</strong> ${formatMath(opt)} ${icon}
                    </div>
                  `;
                }).join('')}
              </div>

              ${(!hasAnswered && isSelectedPending) ? `
                <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                  <button type="button" class="btn btn-primary btn-sm" onclick="submitWorkspaceMcqAnswer(${qIdx})">
                    Submit Answer ✓
                  </button>
                </div>
              ` : ''}

              ${hasAnswered ? `
                <div style="margin-top: 10px; padding: 10px 14px; background: var(--bg-surface); border-radius: 4px; font-size: 0.85rem; line-height: 1.45; border-left: 3px solid ${ans.isCorrect ? '#10b981' : '#f59e0b'};">
                  <strong>${ans.isCorrect ? '🎉 Correct Answer!' : '💡 Explanation:'}</strong> ${formatMath(mcq.explanation)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function selectWorkspaceMcqOption(qIdx, oIdx) {
    if (currentMcqAnswers[qIdx] !== undefined) return;
    currentSelectedOption = { qIdx, oIdx };
    renderInteractiveMcqs(currentMcqs);
  }

  function submitWorkspaceMcqAnswer(qIdx) {
    if (!currentSelectedOption || currentSelectedOption.qIdx !== qIdx) return;
    const mcq = currentMcqs[qIdx];
    if (!mcq) return;

    const oIdx = currentSelectedOption.oIdx;
    const isCorrect = oIdx === mcq.correctOption;
    currentMcqAnswers[qIdx] = { selectedOption: oIdx, isCorrect };
    currentSelectedOption = null;
    renderInteractiveMcqs(currentMcqs);
  }

  function resetInteractiveMcqs() {
    currentMcqAnswers = {};
    currentSelectedOption = null;
    renderInteractiveMcqs(currentMcqs);
  }

  // --- Regenerate Individual Academic Section ---
  async function regenerateWorkspaceSection(sectionName) {
    const txtArea = document.getElementById('transcriptTextarea');
    const transcriptText = (txtArea && txtArea.value.trim()) || '';
    if (!transcriptText) return alert('No transcript available.');

    const topicInput = document.getElementById('customTopicInput');
    const topicTitle = (topicInput && topicInput.value.trim()) || 'General Topic';
    const catSelect = document.getElementById('categorySelect');
    const categoryName = (catSelect && catSelect.options[catSelect.selectedIndex]) ?
      catSelect.options[catSelect.selectedIndex].text : 'Computer Science';

    showStatus(`⏳ Regenerating section "${sectionName}" using AI...`, 'info');

    try {
      const res = await fetch('/transcription/api/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionName, categoryName, topicTitle, transcriptText })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (currentStudyPack) {
        currentStudyPack[sectionName] = data.content;
        renderStudyPack(currentStudyPack, topicTitle, categoryName);
        switchPackTab(sectionName === 'practiceMcqs' ? 'mcqs' : (sectionName === 'lectureSummary' ? 'summary' : sectionName));
      }
      showStatus(`✅ Section "${sectionName}" successfully regenerated!`, 'success');
    } catch (e) {
      showStatus(`⚠️ Regeneration error: ${e.message}`, 'danger');
    }
  }

  // --- Tab Panes Switcher ---
  function switchPackTab(name) {
    const tabMap = {
      summary: 'packSummary',
      topicNotes: 'packTopicNotes',
      subtopics: 'packSubtopics',
      detailedNotes: 'packDetailedNotes',
      definitions: 'packDefinitions',
      concepts: 'packConcepts',
      points: 'packPoints',
      realWorld: 'packRealWorld',
      solvedExamples: 'packSolvedExamples',
      formulas: 'packFormulas',
      flashcards: 'packFlashcards',
      mcqs: 'packMcqs',
      mcqAnswers: 'packMcqAnswers',
      mcqExplanations: 'packMcqExplanations',
      shortAnswers: 'packShortAnswers',
      longAnswers: 'packLongAnswers',
      interviews: 'packInterviews',
      viva: 'packViva',
      pyqs: 'packPyqs',
      pyqMapping: 'packPyqMapping',
      faqs: 'packFaqs',
      examNotes: 'packExamNotes',
      revision: 'packRevision',
      practiceTests: 'packPracticeTests'
    };

    Object.keys(tabMap).forEach(k => {
      const pane = document.getElementById(tabMap[k]);
      if (pane) {
        pane.classList.toggle('active', k === name);
        pane.classList.toggle('hidden', k !== name);
      }
    });

    document.querySelectorAll('#academicPackTabsNav .tab-btn').forEach(btn => {
      const tabAttr = (btn.getAttribute && btn.getAttribute('data-tab')) || (btn.dataset && btn.dataset.tab);
      btn.classList.toggle('active', tabAttr === name);
    });

    const select = document.getElementById('sectionJumpSelect');
    if (select) select.value = name;
  }

  function toggleTopicExpansion(id) {
    const body = document.getElementById(`topic_body_${id}`);
    const chevron = document.getElementById(`chevron_${id}`);
    if (body) {
      const isHidden = body.classList.toggle('hidden');
      if (chevron) chevron.textContent = isHidden ? '▶' : '▼';
    }
  }

  function expandAllTopics(expand) {
    document.querySelectorAll('.topic-body').forEach(b => {
      b.classList.toggle('hidden', !expand);
    });
    document.querySelectorAll('[id^="chevron_topic_"]').forEach(ch => {
      ch.textContent = expand ? '▼' : '▶';
    });
  }

  function toggleAnswer(id) {
    const el = document.getElementById(id);
    const chevron = document.getElementById(`chevron_${id}`);
    if (el) {
      const isHidden = el.classList.toggle('hidden');
      if (chevron) chevron.textContent = isHidden ? '▼' : '▲';
    }
  }

  function toggleAllFaqs(expand) {
    document.querySelectorAll('[id^="faq_ans_"]').forEach(el => {
      el.classList.toggle('hidden', !expand);
    });
    document.querySelectorAll('[id^="chevron_faq_ans_"]').forEach(ch => {
      ch.textContent = expand ? '▲' : '▼';
    });
  }

  function jumpToTimestamp(ts) {
    const txtArea = document.getElementById('transcriptTextarea');
    if (!txtArea || !txtArea.value) return;

    const raw = txtArea.value;
    const cleanTs = ts.replace(/[\[\]]/g, '');
    const idx = raw.indexOf(cleanTs);
    if (idx !== -1) {
      txtArea.focus();
      txtArea.setSelectionRange(idx, idx + cleanTs.length);
      txtArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // --- Save Transcript & Study Pack ---
  async function saveTranscriptAndStudyPack() {
    const txtArea = document.getElementById('transcriptTextarea');
    const rawText = txtArea ? txtArea.value.trim() : '';
    if (!rawText) return alert('No transcript to save.');

    const topicSelect = document.getElementById('topicSelect');
    const topicId = topicSelect ? topicSelect.value : '';
    const topicInput = document.getElementById('customTopicInput');
    const topicTitle = (topicInput && topicInput.value.trim()) || 'General Topic';
    const typeSelect = document.getElementById('categoryTypeSelect');
    const categoryType = typeSelect ? typeSelect.value : (PRESELECTED_TYPE || 'explore');
    const catSelect = document.getElementById('categorySelect');
    const categoryId = catSelect ? catSelect.value : '';
    const categoryName = (catSelect && catSelect.options[catSelect.selectedIndex]) ?
      catSelect.options[catSelect.selectedIndex].text : categoryId;

    const payload = {
      title: `${topicTitle} - Lecture Transcript`,
      categoryType,
      categoryId,
      categoryName,
      topicId,
      topicTitle,
      sourceType: currentTranscriptData ? currentTranscriptData.sourceType : currentSourceType,
      sourceUrl: currentTranscriptData ? currentTranscriptData.sourceUrl : null,
      videoId: currentTranscriptData ? currentTranscriptData.videoId : null,
      rawText,
      timestampedTranscript: currentTranscriptData ? currentTranscriptData.timestampedTranscript : [],
      studyMaterials: currentStudyPack || {},
      markCompleted: true
    };

    const btn = document.getElementById('saveStudyPackBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '💾 Saving...';
    }

    try {
      const res = await fetch('/transcription/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (window.showToast) window.showToast('✅ Saved! Complete Academic Pack & Milestone Progress updated.', 'success');

        let confirmed = false;
        if (typeof window.showConfirmDialog === 'function') {
          confirmed = await window.showConfirmDialog({
            title: 'Complete Academic Pack Saved!',
            message: `Saved "${topicTitle}". Would you like to view the full saved study notes page now?`,
            confirmText: 'View Saved Notes',
            cancelText: 'Stay in Workspace',
            isDanger: false
          });
        } else {
          confirmed = window.confirm(`Saved "${topicTitle}". View saved notes now?`);
        }
        if (confirmed && data.transcript && data.transcript._id) {
          window.location.href = `/transcription/${data.transcript._id}`;
        } else {
          window.location.reload();
        }
      } else {
        alert(`Save failed: ${data.error}`);
      }
    } catch (e) {
      alert(`Save error: ${e.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '💾 Save & Update Progress';
      }
    }
  }

  // --- Export / Markdown Helpers ---
  function buildMarkdownContent() {
    const m = currentStudyPack;
    if (!m) return '';

    const topicInput = document.getElementById('customTopicInput');
    const title = (topicInput && topicInput.value.trim()) || 'Academic Study Pack';
    let md = `# ${title}\n\n`;
    md += `## 1. Lecture Summary\n${m.lectureSummary || m.shortSummary || ''}\n\n`;

    md += `## 2. Topic-wise Notes\n`;
    (m.topicWiseNotes || []).forEach(tp => {
      md += `### ${tp.title} ${tp.timestamp || ''}\n`;
      md += `**Explanation:** ${tp.simpleExplanation || tp.detailedExplanation || ''}\n\n`;
      if (tp.definitions && tp.definitions.length) {
        md += `**Definitions:**\n`;
        tp.definitions.forEach(d => md += `- **${d.term}:** ${d.definition}\n`);
        md += '\n';
      }
    });

    md += `## 3. Detailed Explanations\n`;
    (m.detailedExplanations || []).forEach(n => {
      md += `### ${n.heading} ${n.timestampRef || ''}\n${n.content}\n\n`;
    });

    md += `## 4. Key Definitions\n`;
    (m.importantDefinitions || []).forEach(d => {
      md += `- **${d.term}** (${d.timestampRef || ''}): ${d.definition}\n`;
    });
    md += '\n';

    md += `## 5. Important Questions\n`;
    (m.importantQuestions || []).forEach((q, i) => {
      md += `**Q${i+1} [${q.marks || 5} Marks]:** ${q.question}\n**Answer:** ${q.answer}\n\n`;
    });

    return md;
  }

  function exportPackMarkdown() {
    const md = buildMarkdownContent();
    if (!md) return alert('No study pack to export.');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-study-pack.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyPackMarkdown() {
    const md = buildMarkdownContent();
    if (!md) return;
    navigator.clipboard.writeText(md).then(() => {
      if (window.showToast) window.showToast('Complete study notes copied to clipboard!', 'success');
      else alert('Notes copied to clipboard!');
    });
  }

  function discardTranscriptWorkspace() {
    currentTranscriptData = null;
    currentStudyPack = null;
    const txtArea = document.getElementById('transcriptTextarea');
    if (txtArea) txtArea.value = '';
    const viewCard = document.getElementById('transcriptViewCard');
    if (viewCard) viewCard.classList.add('hidden');
    const packCard = document.getElementById('studyPackCard');
    if (packCard) packCard.classList.add('hidden');
    const statusBox = document.getElementById('transcribeStatusBox');
    if (statusBox) statusBox.classList.add('hidden');
    const urlInput = document.getElementById('youtubeUrlInput');
    if (urlInput) urlInput.value = '';
    if (window.showToast) window.showToast('Workspace reset.', 'info');
  }

  async function deleteHistoryItem(id, title = 'this transcript') {
    let confirmed = false;
    if (typeof window.showConfirmDialog === 'function') {
      confirmed = await window.showConfirmDialog({
        title: 'Delete Lecture Transcript',
        message: `Are you sure you want to delete "${title}" and all its linked study notes?`,
        confirmText: 'Confirm Delete'
      });
    } else {
      confirmed = window.confirm(`Delete "${title}"?`);
    }
    if (!confirmed) return;

    try {
      const res = await fetch(`/transcription/api/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (window.showToast) window.showToast('Transcript deleted successfully.', 'success');
        setTimeout(() => window.location.reload(), 450);
      } else {
        if (window.showToast) window.showToast(`Delete failed: ${data.error}`, 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast(`Error: ${e.message}`, 'error');
    }
  }

  function filterHistory() {
    const searchInput = document.getElementById('historySearchInput');
    const q = searchInput ? searchInput.value.toLowerCase() : '';
    document.querySelectorAll('.history-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? 'block' : 'none';
    });
  }

  // Expose all functions on window for inline HTML handlers
  window.initCategoryDropdowns = initCategoryDropdowns;
  window.handleCategoryTypeChange = handleCategoryTypeChange;
  window.handleCategoryChange = handleCategoryChange;
  window.handleTopicSelectChange = handleTopicSelectChange;
  window.switchSourceTab = switchSourceTab;
  window.fetchYouTubeTranscript = fetchYouTubeTranscript;
  window.handleManualFileInput = handleManualFileInput;
  window.uploadAndTranscribeMedia = uploadAndTranscribeMedia;
  window.useManualTranscript = useManualTranscript;
  window.discardTranscriptWorkspace = discardTranscriptWorkspace;
  window.generateCompleteStudyPack = generateCompleteStudyPack;
  window.exportPackMarkdown = exportPackMarkdown;
  window.copyPackMarkdown = copyPackMarkdown;
  window.saveTranscriptAndStudyPack = saveTranscriptAndStudyPack;
  window.switchPackTab = switchPackTab;
  window.deleteHistoryItem = deleteHistoryItem;
  window.regenerateWorkspaceSection = regenerateWorkspaceSection;
  window.toggleTopicExpansion = toggleTopicExpansion;
  window.expandAllTopics = expandAllTopics;
  window.jumpToTimestamp = jumpToTimestamp;
  window.toggleAllFaqs = toggleAllFaqs;
  window.toggleAnswer = toggleAnswer;
  window.flipActiveCard = flipActiveCard;
  window.prevFlashcard = prevFlashcard;
  window.nextFlashcard = nextFlashcard;
  window.shuffleActiveFlashcards = shuffleActiveFlashcards;
  window.toggleActiveCardCompleted = toggleActiveCardCompleted;
  window.resetInteractiveMcqs = resetInteractiveMcqs;
  window.selectWorkspaceMcqOption = selectWorkspaceMcqOption;
  window.submitWorkspaceMcqAnswer = submitWorkspaceMcqAnswer;
  window.filterHistory = filterHistory;

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    initCategoryDropdowns();

    // Attach explicit click listeners to ensure responsive tabs & buttons
    const tabYt = document.getElementById('tabSourceYoutubeBtn');
    if (tabYt) tabYt.addEventListener('click', () => switchSourceTab('youtube'));
    const tabAud = document.getElementById('tabSourceAudioBtn');
    if (tabAud) tabAud.addEventListener('click', () => switchSourceTab('audio'));
    const tabVid = document.getElementById('tabSourceVideoBtn');
    if (tabVid) tabVid.addEventListener('click', () => switchSourceTab('video'));
    const tabMan = document.getElementById('tabSourceManualBtn');
    if (tabMan) tabMan.addEventListener('click', () => switchSourceTab('manual'));

    const fetchBtn = document.getElementById('fetchYoutubeBtn');
    if (fetchBtn) fetchBtn.addEventListener('click', fetchYouTubeTranscript);

    const transcribeAudBtn = document.getElementById('transcribeAudioBtn');
    if (transcribeAudBtn) transcribeAudBtn.addEventListener('click', () => uploadAndTranscribeMedia('audioFileInput'));

    const transcribeVidBtn = document.getElementById('transcribeVideoBtn');
    if (transcribeVidBtn) transcribeVidBtn.addEventListener('click', () => uploadAndTranscribeMedia('videoFileInput'));

    const catTypeSelect = document.getElementById('categoryTypeSelect');
    if (catTypeSelect) catTypeSelect.addEventListener('change', handleCategoryTypeChange);

    const catSelect = document.getElementById('categorySelect');
    if (catSelect) catSelect.addEventListener('change', handleCategoryChange);

    const topicSelect = document.getElementById('topicSelect');
    if (topicSelect) topicSelect.addEventListener('change', handleTopicSelectChange);
  });
})();
