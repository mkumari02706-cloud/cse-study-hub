// Add Lecture & AI Study Material Generator Interactions

let currentTranscript = '';
let currentVideoMetadata = null;
let generatedMaterials = {
  hinglish: '',
  examNotes: '',
  importantQuestions: '',
  quickRevision: '',
  codeExamples: ''
};

document.addEventListener('DOMContentLoaded', () => {
  const subjectSelect = document.getElementById('subjectSelect');
  const unitSelect = document.getElementById('unitSelect');
  const topicSelect = document.getElementById('topicSelect');
  const customTopicInput = document.getElementById('customTopicInput');

  // Always keep manual transcript input and AI study generator sections visible on page load
  const manualBox = document.getElementById('manualTranscriptBox');
  if (manualBox) manualBox.classList.remove('hidden');
  const aiSection = document.getElementById('aiGeneratorSection');
  if (aiSection) aiSection.classList.remove('hidden');

  // Handle dynamic units & topics on subject change
  if (subjectSelect) {
    subjectSelect.addEventListener('change', updateUnitsAndTopics);
    updateUnitsAndTopics(); // initial run
  }

  if (unitSelect) {
    unitSelect.addEventListener('change', updateTopics);
  }

  function updateUnitsAndTopics() {
    const selectedSubId = subjectSelect.value;
    const subjectData = window.SUBJECTS_DATA ? window.SUBJECTS_DATA.find(s => s.id === selectedSubId) : null;

    if (!unitSelect || !subjectData) return;

    unitSelect.innerHTML = '<option value="">-- Select Unit --</option>';
    subjectData.units.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.number;
      opt.textContent = `Unit ${u.number}: ${u.title}`;
      opt.dataset.topics = JSON.stringify(u.topics || []);
      unitSelect.appendChild(opt);
    });

    if (subjectData.units.length > 0) {
      unitSelect.selectedIndex = 1;
      updateTopics();
    }
  }

  function updateTopics() {
    const selectedOpt = unitSelect.options[unitSelect.selectedIndex];
    if (!topicSelect || !selectedOpt) return;

    const topics = selectedOpt.dataset.topics ? JSON.parse(selectedOpt.dataset.topics) : [];
    topicSelect.innerHTML = '<option value="">-- Select Predefined Topic or Enter Custom --</option>';

    topics.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      topicSelect.appendChild(opt);
    });

    if (topics.length > 0) {
      topicSelect.selectedIndex = 1;
      if (customTopicInput) customTopicInput.value = topics[0];
    }
  }

  if (topicSelect && customTopicInput) {
    topicSelect.addEventListener('change', () => {
      if (topicSelect.value) {
        customTopicInput.value = topicSelect.value;
      }
    });
  }

  // 1. Fetch YouTube Transcript
  const fetchTranscriptBtn = document.getElementById('fetchTranscriptBtn');
  const videoUrlInput = document.getElementById('videoUrlInput');
  const langSelect = document.getElementById('transcriptLangSelect');
  const transcriptStatus = document.getElementById('transcriptStatus');
  const transcriptPreview = document.getElementById('transcriptPreview');
  const manualTranscriptArea = document.getElementById('manualTranscriptArea');
  const manualBox = document.getElementById('manualTranscriptBox');

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

  function parseBrowserSubtitleTrack(rawContent, lang = 'en') {
    if (!rawContent || typeof rawContent !== 'string') return null;
    const content = rawContent.replace(/^\uFEFF/, '').trim();
    if (!content) return null;

    const lines = content.split(/\r?\n/);
    const items = [];

    // 1. Check if VTT or SRT format
    const timecodeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.]\d{3}\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.]\d{3}/;
    const isVttOrSrt = content.includes('WEBVTT') || lines.some(l => timecodeRegex.test(l));

    if (isVttOrSrt) {
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

    // 2. Check if XML format (<p t="ms" d="ms"> or <text start="s" dur="s">)
    if (items.length === 0 && (content.includes('<transcript') || content.includes('<timedtext') || content.includes('<p ') || content.includes('<text '))) {
      // srv3 format
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
        // Classic format
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
      // Fallback: parse plain lines
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

    // Deduplicate consecutive repeating lines (rolling transcripts)
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

  /**
   * Fetches captions directly from multiple public Piped & Invidious mirror endpoints and proxy fallbacks
   */
  async function fetchTranscriptFromBrowser(videoId, requestedLang = 'en') {
    if (!videoId) return { success: false, error: 'No video ID provided' };

    // 1. Piped API instances
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.adminforge.de',
      'https://api.piped.private.coffee',
      'https://pipedapi.leptons.xyz'
    ];

    for (const base of pipedInstances) {
      try {
        const streamRes = await fetch(`${base}/streams/${videoId}`, {
          signal: AbortSignal.timeout(4000)
        });
        if (!streamRes.ok) continue;

        const data = await streamRes.json();
        const subtitles = data.subtitles || [];
        if (!Array.isArray(subtitles) || subtitles.length === 0) continue;

        let chosen = subtitles.find(s => s.code === requestedLang && !s.autoGenerated) ||
                     subtitles.find(s => s.code === requestedLang) ||
                     subtitles.find(s => s.code && s.code.startsWith(requestedLang)) ||
                     subtitles.find(s => s.code === 'en' || s.code?.startsWith('en')) ||
                     subtitles.find(s => s.code === 'hi' || s.code?.startsWith('hi')) ||
                     subtitles[0];

        if (chosen && chosen.url) {
          const subRes = await fetch(chosen.url, { signal: AbortSignal.timeout(4000) });
          if (subRes.ok) {
            const raw = await subRes.text();
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
      } catch (e) {
        // Continue to next mirror
      }
    }

    // 2. Invidious Captions API instances
    const invidiousInstances = [
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://yewtu.be',
      'https://invidious.jing.rocks'
    ];

    for (const base of invidiousInstances) {
      try {
        const capRes = await fetch(`${base}/api/v1/captions/${videoId}`, {
          signal: AbortSignal.timeout(4000)
        });
        if (!capRes.ok) continue;

        const data = await capRes.json();
        const captions = data.captions || [];
        if (!Array.isArray(captions) || captions.length === 0) continue;

        let chosen = captions.find(c => c.languageCode === requestedLang) ||
                     captions.find(c => c.languageCode && c.languageCode.startsWith(requestedLang)) ||
                     captions.find(c => c.languageCode === 'en' || c.languageCode?.startsWith('en')) ||
                     captions[0];

        if (chosen && chosen.url) {
          const fullUrl = chosen.url.startsWith('http') ? chosen.url : `${base}${chosen.url}`;
          const subRes = await fetch(fullUrl, { signal: AbortSignal.timeout(4000) });
          if (subRes.ok) {
            const raw = await subRes.text();
            const parsed = parseBrowserSubtitleTrack(raw, chosen.languageCode || requestedLang);
            if (parsed && parsed.wordCount > 10) {
              return {
                success: true,
                ...parsed,
                language: chosen.languageCode || requestedLang,
                source: `Invidious API (${new URL(base).hostname})`
              };
            }
          }
        }
      } catch (e) {
        // Continue to next mirror
      }
    }

    // 3. Fallback: CORS Proxy TimedText
    const proxyUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${requestedLang}`)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${requestedLang}`)}`
    ];

    for (const pUrl of proxyUrls) {
      try {
        const pRes = await fetch(pUrl, { signal: AbortSignal.timeout(4000) });
        if (pRes.ok) {
          const raw = await pRes.text();
          const parsed = parseBrowserSubtitleTrack(raw, requestedLang);
          if (parsed && parsed.wordCount > 10) {
            return {
              success: true,
              ...parsed,
              language: requestedLang,
              source: 'CORS Proxy TimedText'
            };
          }
        }
      } catch (e) {
        // Continue
      }
    }

    return {
      success: false,
      error: 'Could not fetch captions from any public Piped/Invidious mirror or proxy.'
    };
  }

  if (fetchTranscriptBtn) {
    fetchTranscriptBtn.addEventListener('click', async () => {
      const url = videoUrlInput.value.trim();
      if (!url) {
        showStatus('Please enter a YouTube video URL.', 'danger');
        return;
      }

      showStatus('Fetching transcript & video metadata...', 'info', true);
      fetchTranscriptBtn.disabled = true;

      const videoId = extractVideoId(url);

      try {
        // Step 1: Call server backend
        const res = await fetch('/api/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: url, language: langSelect.value })
        });
        const data = await res.json();

        if (data.success) {
          currentTranscript = data.fullText || data.timestampedText;
          currentVideoMetadata = data.metadata;

          showStatus(`✅ Transcript retrieved automatically (${data.wordCount} words${data.isAutoGenerated ? ' [Auto-Generated]' : ''}). Generating complete study pack with AI...`, 'info', true);
          if (transcriptPreview) {
            transcriptPreview.value = data.timestampedText || data.fullText;
            transcriptPreview.classList.remove('hidden');
          }
          if (manualTranscriptArea) {
            manualTranscriptArea.value = data.fullText || data.timestampedText;
          }

          // Autofill lecture title if blank
          const titleInput = document.getElementById('lectureTitleInput');
          if (titleInput && !titleInput.value && data.metadata && data.metadata.title) {
            titleInput.value = data.metadata.title;
          }

          // Enable AI Generator and directly trigger automatic generation without extra steps
          enableAIGenerator();
          const genBtn = document.getElementById('generateAllBtn');
          if (genBtn) {
            genBtn.click();
          }
          return;
        }

        // Autofill lecture title if metadata was retrieved
        if (data.metadata && data.metadata.title) {
          currentVideoMetadata = data.metadata;
          const titleInput = document.getElementById('lectureTitleInput');
          if (titleInput && !titleInput.value) {
            titleInput.value = data.metadata.title;
          }
        }

        // Step 2: Server IP was blocked or failed, try browser-side multi-source fetcher!
        if (videoId) {
          showStatus('⏳ Cloud server IP blocked by YouTube. Fetching captions directly via browser mirrors (Piped & Invidious)...', 'info', true);
          const browserResult = await fetchTranscriptFromBrowser(videoId, langSelect.value);

          if (browserResult.success) {
            currentTranscript = browserResult.fullText || browserResult.timestampedText;
            if (!currentVideoMetadata) {
              currentVideoMetadata = {
                videoId,
                title: browserResult.title || `Lecture (${videoId})`
              };
            } else if (browserResult.title && (!currentVideoMetadata.title || currentVideoMetadata.title.startsWith('YouTube Lecture'))) {
              currentVideoMetadata.title = browserResult.title;
            }

            const titleInput = document.getElementById('lectureTitleInput');
            if (titleInput && !titleInput.value && currentVideoMetadata.title) {
              titleInput.value = currentVideoMetadata.title;
            }

            if (transcriptPreview) {
              transcriptPreview.value = browserResult.timestampedText || browserResult.fullText;
              transcriptPreview.classList.remove('hidden');
            }
            if (manualTranscriptArea) {
              manualTranscriptArea.value = browserResult.fullText;
            }

            showStatus(`✅ Transcript retrieved automatically via ${browserResult.source} (${browserResult.wordCount} words). Generating complete study pack with AI...`, 'info', true);

            // Enable AI Generator and directly trigger automatic generation
            enableAIGenerator();
            const genBtn = document.getElementById('generateAllBtn');
            if (genBtn) {
              genBtn.click();
            }
            return;
          }
        }

        // Step 3: If both failed, show clear instructions to paste manually
        if (data.errorCode === 'RATE_LIMITED' || data.isRateLimited) {
          const remaining = data.cooldownRemainingSec || 60;
          showStatus(`⏳ <strong>YouTube Cloud IP Rate-Limited (${remaining}s):</strong> Automated caption requests are temporarily resting. Please paste your lecture transcript or upload a file (.txt, .srt, .vtt) below to generate your study pack immediately.`, 'warning');
        } else {
          const errorMsg = data.error || 'Captions are unavailable for this video.';
          const detailMsg = data.details ? `<br><small style="opacity:0.9;">${data.details}</small>` : '';
          showStatus(`⚠️ ${errorMsg}${detailMsg}<br><small>You can paste the transcript or upload a file (.txt, .srt, .vtt) below to continue.</small>`, 'warning');
        }
      } catch (err) {
        // Network error contacting backend; try browser fetch directly
        if (videoId) {
          try {
            showStatus('⏳ Attempting browser-side multi-source caption fetcher...', 'info', true);
            const browserResult = await fetchTranscriptFromBrowser(videoId, langSelect.value);
            if (browserResult.success) {
              currentTranscript = browserResult.fullText || browserResult.timestampedText;
              currentVideoMetadata = { videoId, title: browserResult.title || `Lecture (${videoId})` };
              const titleInput = document.getElementById('lectureTitleInput');
              if (titleInput && !titleInput.value && browserResult.title) {
                titleInput.value = browserResult.title;
              }
              if (transcriptPreview) {
                transcriptPreview.value = browserResult.timestampedText || browserResult.fullText;
                transcriptPreview.classList.remove('hidden');
              }
              if (manualTranscriptArea) {
                manualTranscriptArea.value = browserResult.fullText;
              }
              showStatus(`✅ Transcript retrieved automatically via ${browserResult.source} (${browserResult.wordCount} words). Generating complete study pack with AI...`, 'info', true);
              enableAIGenerator();
              const genBtn = document.getElementById('generateAllBtn');
              if (genBtn) {
                genBtn.click();
              }
              return;
            }
          } catch (e2) {}
        }
        showStatus(`⚠️ Error: ${err.message}. Please paste transcript below.`, 'danger');
      } finally {
        fetchTranscriptBtn.disabled = false;
      }
    });
  }

  // Manual Transcript File Upload Handler
  const manualFileInput = document.getElementById('manualTranscriptFileInput');
  if (manualFileInput) {
    manualFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      showStatus(`⏳ Uploading and reading transcript file "${file.name}"...`, 'info', true);

      const formData = new FormData();
      formData.append('transcriptFile', file);
      const url = videoUrlInput ? videoUrlInput.value.trim() : '';
      if (url) formData.append('videoId', url);

      try {
        const res = await fetch('/api/upload-transcript-file', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && (data.text || data.fullText)) {
          const content = data.fullText || data.text;
          if (manualTranscriptArea) manualTranscriptArea.value = content;
          currentTranscript = content;
          const words = data.wordCount || content.split(/\s+/).filter(Boolean).length;
          showStatus(`✅ Transcript file loaded successfully (${words} words).`, 'success');
          if (transcriptPreview) {
            transcriptPreview.value = data.timestampedText || content;
            transcriptPreview.classList.remove('hidden');
          }
          enableAIGenerator();
        } else {
          showStatus(`⚠️ Could not parse file: ${data.error || 'Unknown error'}`, 'warning');
        }
      } catch (err) {
        // Fallback to FileReader
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target.result;
          if (manualTranscriptArea) manualTranscriptArea.value = text;
          currentTranscript = text;
          const words = text.split(/\s+/).filter(Boolean).length;
          showStatus(`✅ Transcript file loaded locally (${words} words).`, 'success');
          if (transcriptPreview) {
            transcriptPreview.value = text;
            transcriptPreview.classList.remove('hidden');
          }
          enableAIGenerator();
        };
        reader.onerror = () => showStatus('Could not read file locally.', 'danger');
        reader.readAsText(file);
      }
    });
  }

  // Audio / Video Media Upload Handler (Speech-to-Text)
  const mediaFileInput = document.getElementById('mediaFileInput');
  if (mediaFileInput) {
    mediaFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      showStatus(`⏳ Uploading and processing "${file.name}" with AI Speech-to-Text...`, 'info', true);

      const formData = new FormData();
      formData.append('mediaFile', file);
      if (langSelect) formData.append('language', langSelect.value);

      try {
        const res = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && (data.timestampedText || data.fullText)) {
          currentTranscript = data.fullText || data.timestampedText;
          if (manualTranscriptArea) manualTranscriptArea.value = currentTranscript;
          if (transcriptPreview) {
            transcriptPreview.value = data.timestampedText || currentTranscript;
            transcriptPreview.classList.remove('hidden');
          }
          if (manualBox) manualBox.classList.remove('hidden');
          showStatus(`✅ Speech-to-Text completed (${data.wordCount} words, Language: ${data.language || 'en'}).`, 'success');
          enableAIGenerator();
        } else {
          showStatus(`⚠️ Speech-to-Text failed: ${data.error || 'Unknown error'}`, 'warning');
        }
      } catch (err) {
        showStatus(`⚠️ Media upload failed: ${err.message}`, 'danger');
      }
    });
  }

  // Manual Transcript Paste / Upload Handler
  const useManualBtn = document.getElementById('useManualBtn');
  if (useManualBtn && manualTranscriptArea) {
    useManualBtn.addEventListener('click', () => {
      const manualText = manualTranscriptArea.value.trim();
      if (!manualText) {
        alert('Please paste transcript text into the box.');
        return;
      }
      currentTranscript = manualText;
      if (transcriptPreview) {
        transcriptPreview.value = manualText;
        transcriptPreview.classList.remove('hidden');
      }
      const words = manualText.split(/\s+/).filter(Boolean).length;
      showStatus(`✅ Manual transcript accepted (${words} words). AI Study Generator ready!`, 'success');
      enableAIGenerator();
    });
  }

  function showStatus(msg, type = 'info', loading = false) {
    if (!transcriptStatus) return;
    transcriptStatus.className = `alert alert-${type}`;
    transcriptStatus.innerHTML = loading
      ? `<span class="spinner">⏳</span> ${msg}`
      : msg;
    transcriptStatus.classList.remove('hidden');
  }

  function enableAIGenerator() {
    const aiSection = document.getElementById('aiGeneratorSection');
    if (aiSection) aiSection.classList.remove('hidden');
  }

  // 2. Generate All Sections (1-Click)
  const generateAllBtn = document.getElementById('generateAllBtn');
  if (generateAllBtn) {
    generateAllBtn.addEventListener('click', async () => {
      const transcript = currentTranscript || (manualTranscriptArea ? manualTranscriptArea.value.trim() : '');
      if (!transcript) {
        alert('Please fetch or paste a lecture transcript first.');
        return;
      }

      const subjectId = subjectSelect.value;
      const topic = (customTopicInput && customTopicInput.value) || (topicSelect && topicSelect.value) || 'General CSE';

      generateAllBtn.disabled = true;
      generateAllBtn.innerHTML = '⏳ Generating 5 Study Sections with AI...';

      try {
        const res = await fetch('/api/generate-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, topic, transcript })
        });
        const data = await res.json();

        if (data.success && data.studyMaterials) {
          generatedMaterials = data.studyMaterials;
          renderGeneratedTabs(data.studyMaterials);
          document.getElementById('saveSection').classList.remove('hidden');
        } else {
          alert(`AI Generation Notice: ${data.error}`);
        }
      } catch (err) {
        alert(`Error during generation: ${err.message}`);
      } finally {
        generateAllBtn.disabled = false;
        generateAllBtn.innerHTML = '✨ Generate Complete Study Pack';
      }
    });
  }

  // 3. Tab Switching for Generated Materials
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(tabTarget);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  function renderGeneratedTabs(materials) {
    const panes = {
      tabHinglish: materials.hinglish || '*No Hinglish notes generated.*',
      tabExamNotes: materials.examNotes || '*No Exam notes generated.*',
      tabQuestions: materials.importantQuestions || '*No Questions generated.*',
      tabRevision: materials.quickRevision || '*No Revision summary generated.*',
      tabCode: materials.codeExamples || '*No Code examples generated.*'
    };

    Object.keys(panes).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // Render simple markdown or text
        el.innerHTML = `<div class="markdown-body">${formatMarkdown(panes[id])}</div>`;
      }
    });
  }

  // Basic markdown formatter for preview
  function formatMarkdown(md) {
    if (!md) return '';
    return md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br>');
  }

  // 4. Save to Study Hub
  const saveLectureBtn = document.getElementById('saveLectureBtn');
  if (saveLectureBtn) {
    saveLectureBtn.addEventListener('click', async () => {
      const subjectId = subjectSelect.value;
      const unitNumber = unitSelect.value;
      const unitOpt = unitSelect.options[unitSelect.selectedIndex];
      const unitTitle = unitOpt ? unitOpt.textContent.replace(/^Unit \d+:\s*/, '') : '';
      const topicTitle = (customTopicInput && customTopicInput.value) || 'Lecture Topic';
      const lectureTitle = (document.getElementById('lectureTitleInput') && document.getElementById('lectureTitleInput').value) || topicTitle;
      const videoUrl = videoUrlInput.value.trim();
      const markTopicComplete = document.getElementById('markTopicCompleteCheckbox') ? document.getElementById('markTopicCompleteCheckbox').checked : false;

      saveLectureBtn.disabled = true;
      saveLectureBtn.innerHTML = '💾 Saving to Subject Folders...';

      try {
        const res = await fetch('/api/save-lecture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId,
            unitNumber,
            unitTitle,
            topicTitle,
            lectureTitle,
            videoUrl,
            videoId: currentVideoMetadata ? currentVideoMetadata.videoId : null,
            transcriptText: currentTranscript,
            studyMaterials: generatedMaterials,
            markTopicComplete
          })
        });

        const data = await res.json();
        if (data.success) {
          alert('✅ Lecture and all study materials successfully saved to your subject folder!');
          window.location.href = `/library/${data.lecture.id}`;
        } else {
          alert(`Save Error: ${data.error}`);
          saveLectureBtn.disabled = false;
          saveLectureBtn.innerHTML = '💾 Save to Study Hub';
        }
      } catch (err) {
        alert(`Save Error: ${err.message}`);
        saveLectureBtn.disabled = false;
        saveLectureBtn.innerHTML = '💾 Save to Study Hub';
      }
    });
  }
});
