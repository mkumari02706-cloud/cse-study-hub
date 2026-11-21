const { YoutubeTranscript } = require('youtube-transcript');

/**
 * In-Memory Request & Result Cache with TTL and Rate-Limit Cooldown Tracker
 */
class TranscriptCache {
  constructor(defaultTtlMs = 60 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = 500;
    this.rateLimitCooldownUntil = 0;
    this.lastCooldownReason = '';
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now()
    });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.rateLimitCooldownUntil = 0;
    this.lastCooldownReason = '';
  }

  setRateLimitCooldown(durationMs = 60 * 1000, reason = 'YouTube IP rate limit / Captcha challenge detected') {
    this.rateLimitCooldownUntil = Date.now() + durationMs;
    this.lastCooldownReason = reason;
  }

  isCooldownActive() {
    return Date.now() < this.rateLimitCooldownUntil;
  }

  getCooldownRemainingSec() {
    if (!this.isCooldownActive()) return 0;
    return Math.ceil((this.rateLimitCooldownUntil - Date.now()) / 1000);
  }

  getStats() {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      isCooldownActive: this.isCooldownActive(),
      cooldownRemainingSec: this.getCooldownRemainingSec(),
      lastCooldownReason: this.lastCooldownReason
    };
  }
}

// Global cache instance for transcripts and metadata
const cache = new TranscriptCache();

/**
 * Standard User-Agents used for realistic header simulation
 */
const DESKTOP_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  const index = Math.floor(Math.random() * DESKTOP_USER_AGENTS.length);
  return DESKTOP_USER_AGENTS[index];
}

/**
 * Extracts standard 11-character YouTube Video ID from various URL patterns
 */
function extractVideoId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null;

  const trimmed = urlOrId.trim();

  // If already an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL regex patterns
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
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Decodes common HTML / XML entities
 */
function decodeEntities(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Fetches video metadata via YouTube oEmbed or Google YouTube Data API v3 (if key configured)
 */
async function fetchVideoMetadata(videoId) {
  if (!videoId) return null;

  const cacheKey = `yt_meta_${videoId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const defaultMeta = {
    title: `YouTube Lecture (${videoId})`,
    author: 'YouTube Instructor',
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`
  };

  // 1. Try YouTube Data API v3 if API key configured
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey && apiKey.trim()) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=snippet&key=${encodeURIComponent(apiKey.trim())}`;
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        const item = apiData.items && apiData.items[0];
        if (item && item.snippet) {
          const meta = {
            title: item.snippet.title || defaultMeta.title,
            author: item.snippet.channelTitle || defaultMeta.author,
            thumbnail: (item.snippet.thumbnails && item.snippet.thumbnails.high && item.snippet.thumbnails.high.url) || defaultMeta.thumbnail,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`
          };
          cache.set(cacheKey, meta, 24 * 60 * 60 * 1000); // 24hr cache
          return meta;
        }
      }
    } catch {
      // Fall through to oEmbed
    }
  }

  // 2. Try official YouTube oEmbed
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      const meta = {
        title: data.title || defaultMeta.title,
        author: data.author_name || defaultMeta.author,
        thumbnail: defaultMeta.thumbnail,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`
      };
      cache.set(cacheKey, meta, 24 * 60 * 60 * 1000);
      return meta;
    }
  } catch {
    // Ignore and return default
  }

  cache.set(cacheKey, defaultMeta, 60 * 60 * 1000);
  return defaultMeta;
}

/**
 * Formats transcript items into readable text with timestamps and clean text
 */
function formatTranscript(items) {
  if (!items || !items.length) {
    return {
      rawItems: [],
      timestampedText: '',
      fullText: '',
      wordCount: 0
    };
  }

  const timestamped = items.map(item => {
    const totalSecs = Math.floor((item.offset || 0) / (item.offset > 10000 ? 1000 : 1));
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    const cleanText = (item.text || '').replace(/\s+/g, ' ').trim();
    return `[${mins}:${secs}] ${cleanText}`;
  }).filter(line => line.length > 8).join('\n');

  const cleanText = items.map(i => (i.text || '').trim()).filter(Boolean).join(' ');

  return {
    rawItems: items,
    timestampedText: timestamped,
    fullText: cleanText,
    wordCount: cleanText.split(/\s+/).filter(Boolean).length
  };
}

/**
 * Parses XML transcript text supporting both srv3 format (<p t="ms" d="ms">)
 * and classic format (<text start="s" dur="s">)
 */
function parseTranscriptXml(xml, lang = 'en') {
  if (!xml || typeof xml !== 'string') return [];
  const results = [];

  // Format 1: srv3 (<p t="ms" d="ms"><s>word</s>...</p>)
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    const inner = match[3];
    let text = '';
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      text += sMatch[1];
    }
    if (!text) {
      text = inner.replace(/<[^>]+>/g, '');
    }
    text = decodeEntities(text).trim();
    if (text) {
      results.push({
        text,
        duration: durMs,
        offset: startMs,
        lang
      });
    }
  }

  if (results.length > 0) return results;

  // Format 2: Classic (<text start="sec" dur="sec">content</text>)
  const textRegex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let tMatch;
  while ((tMatch = textRegex.exec(xml)) !== null) {
    const startSec = parseFloat(tMatch[1]) || 0;
    const durSec = parseFloat(tMatch[2]) || 0;
    const text = decodeEntities(tMatch[3].replace(/<[^>]+>/g, '')).trim();
    if (text) {
      results.push({
        text,
        offset: Math.round(startSec * 1000),
        duration: Math.round(durSec * 1000),
        lang
      });
    }
  }

  return results;
}

/**
 * Retry helper with exponential backoff and jitter
 * Does NOT retry on rate-limit (429/Captcha), 404, or captions-disabled errors.
 */
async function withExponentialBackoff(fn, { maxRetries = 2, baseDelayMs = 400 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const isRateLimit = err && (
        err.message?.includes('too many requests') ||
        err.message?.includes('captcha') ||
        err.message?.includes('g-recaptcha') ||
        err.status === 429
      );
      const isPermanent = err && (
        err.status === 404 ||
        err.message?.includes('disabled') ||
        err.message?.includes('no longer available') ||
        err.message?.includes('Impossible to retrieve')
      );

      if (isRateLimit) {
        // Immediately record cooldown and do not retry
        cache.setRateLimitCooldown(60 * 1000, 'YouTube IP rate limit / Captcha detected');
        throw err;
      }

      if (isPermanent || attempt > maxRetries) {
        throw err;
      }

      const jitter = Math.floor(Math.random() * 150);
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Strategy 1: Multi-Client InnerTube Player API
 * Queries YouTube's player API with desktop WEB context to retrieve all caption tracks at once.
 */
async function fetchViaInnerTube(videoId, requestedLang = 'en') {
  const clients = [
    {
      name: 'WEB',
      version: '2.20240313.01.00',
      userAgent: getRandomUserAgent()
    },
    {
      name: 'ANDROID',
      version: '20.10.38',
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
    }
  ];

  for (const client of clients) {
    try {
      const playerUrl = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
      const res = await withExponentialBackoff(async () => {
        return await fetch(playerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': client.userAgent
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: client.name,
                clientVersion: client.version,
                hl: requestedLang || 'en',
                gl: 'US'
              }
            },
            videoId
          })
        });
      });

      if (!res.ok) continue;

      const data = await res.json();
      const playability = data?.playabilityStatus?.status;
      if (playability === 'UNPLAYABLE' || playability === 'ERROR' || playability === 'LOGIN_REQUIRED') {
        const reason = data?.playabilityStatus?.reason || 'Video is unavailable or private.';
        const err = new Error(reason);
        err.code = 'VIDEO_UNAVAILABLE';
        throw err;
      }

      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
        continue;
      }

      // Pick the best track from the track list in a single pass:
      // 1. Requested language (exact)
      // 2. Requested language (prefix, e.g. en-US for en)
      // 3. English track
      // 4. Hindi track
      // 5. First available track
      let chosenTrack = captionTracks.find(t => t.languageCode === requestedLang);
      if (!chosenTrack) {
        chosenTrack = captionTracks.find(t => t.languageCode && t.languageCode.startsWith(requestedLang));
      }
      if (!chosenTrack && requestedLang !== 'en') {
        chosenTrack = captionTracks.find(t => t.languageCode === 'en' || (t.languageCode && t.languageCode.startsWith('en')));
      }
      if (!chosenTrack && requestedLang !== 'hi') {
        chosenTrack = captionTracks.find(t => t.languageCode === 'hi');
      }
      if (!chosenTrack) {
        chosenTrack = captionTracks[0];
      }

      if (!chosenTrack || !chosenTrack.baseUrl) continue;

      const trackUrl = new URL(chosenTrack.baseUrl);
      if (!trackUrl.hostname.endsWith('.youtube.com')) continue;

      // Fetch the caption track content
      const trackRes = await withExponentialBackoff(async () => {
        return await fetch(chosenTrack.baseUrl, {
          headers: {
            'User-Agent': client.userAgent,
            'Accept-Language': requestedLang
          }
        });
      });

      if (!trackRes.ok) continue;

      const xml = await trackRes.text();
      const items = parseTranscriptXml(xml, chosenTrack.languageCode || requestedLang);
      if (items.length > 0) {
        return {
          items,
          language: chosenTrack.languageCode || requestedLang,
          isAutoGenerated: Boolean(chosenTrack.kind === 'asr')
        };
      }
    } catch (err) {
      if (err.code === 'VIDEO_UNAVAILABLE') throw err;
      if (err.message?.includes('too many requests') || err.message?.includes('captcha')) throw err;
    }
  }

  return null;
}

/**
 * Strategy 2: Direct TimedText API
 */
async function fetchViaTimedText(videoId, lang = 'en') {
  const timedTextUrls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`
  ];

  for (const url of timedTextUrls) {
    try {
      const res = await withExponentialBackoff(async () => {
        return await fetch(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept-Language': lang
          }
        });
      });

      if (!res.ok) continue;
      const body = await res.text();
      if (!body || body.includes('class="g-recaptcha"')) {
        if (body.includes('class="g-recaptcha"')) {
          cache.setRateLimitCooldown(60 * 1000, 'YouTube IP rate limit / Captcha challenge');
          const err = new Error('YouTube is receiving too many requests from this IP and now requires solving a captcha.');
          err.code = 'RATE_LIMITED';
          throw err;
        }
        continue;
      }

      const items = parseTranscriptXml(body, lang);
      if (items.length > 0) {
        return { items, language: lang, isAutoGenerated: false };
      }
    } catch (err) {
      if (err.code === 'RATE_LIMITED') throw err;
    }
  }

  return null;
}

/**
 * Strategy 3: Standard youtube-transcript library fallback (with rate-limit interception)
 */
async function fetchViaYoutubeTranscriptLib(videoId, requestedLang) {
  // If cooldown is active, abort immediately without hitting YouTube
  if (cache.isCooldownActive()) {
    const err = new Error('YouTube rate limit cooldown is currently active.');
    err.code = 'RATE_LIMITED';
    throw err;
  }

  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: requestedLang
    });

    if (items && items.length > 0) {
      return {
        items,
        language: requestedLang,
        isAutoGenerated: false
      };
    }
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('too many requests') || msg.includes('captcha') || msg.includes('g-recaptcha')) {
      cache.setRateLimitCooldown(60 * 1000, 'YouTube rate limit detected by library');
      const rateErr = new Error('YouTube is receiving too many requests from this IP and now requires solving a captcha.');
      rateErr.code = 'RATE_LIMITED';
      throw rateErr;
    }
    if (msg.includes('disabled')) {
      const disErr = new Error(`Transcript is disabled on this video (${videoId})`);
      disErr.code = 'CAPTIONS_DISABLED';
      throw disErr;
    }
    if (msg.includes('no longer available') || msg.includes('unavailable')) {
      const unavailErr = new Error(`The video is no longer available (${videoId})`);
      unavailErr.code = 'VIDEO_UNAVAILABLE';
      throw unavailErr;
    }
  }

  return null;
}

/**
 * Categorizes an error and provides actionable, clear messaging with alternatives
 */
function categorizeError(err, videoId) {
  const msg = (err && err.message) || 'Unknown error occurred.';

  // 1. Rate Limit / CAPTCHA challenge
  if (
    cache.isCooldownActive() ||
    err?.code === 'RATE_LIMITED' ||
    msg.includes('too many requests') ||
    msg.includes('captcha') ||
    msg.includes('g-recaptcha')
  ) {
    const remaining = cache.getCooldownRemainingSec() || 60;
    return {
      errorCode: 'RATE_LIMITED',
      error: `YouTube is receiving too many requests from this IP and now requires solving a captcha (Protection active for ${remaining}s).`,
      details: 'YouTube has rate-limited automated subtitle queries from this server. To respect YouTube rate limits, further scraping is temporarily paused. Please paste the transcript text, upload a transcript file, or upload the audio/video file for Speech-to-Text.',
      canFallbackManual: true,
      canUploadMedia: true,
      suggestedAction: 'manual_paste_or_upload'
    };
  }

  // 2. Disabled Captions
  if (err?.code === 'CAPTIONS_DISABLED' || msg.includes('disabled') || msg.includes('Disabled')) {
    return {
      errorCode: 'CAPTIONS_DISABLED',
      error: `Captions are disabled by the creator for this video (${videoId}).`,
      details: 'The video publisher has turned off closed captions. You can paste the transcript or upload a .txt transcript file below.',
      canFallbackManual: true,
      canUploadMedia: true,
      suggestedAction: 'manual_paste_or_upload'
    };
  }

  // 3. Video Unavailable / Private / Deleted
  if (err?.code === 'VIDEO_UNAVAILABLE' || msg.includes('unavailable') || msg.includes('no longer available') || msg.includes('private')) {
    return {
      errorCode: 'VIDEO_UNAVAILABLE',
      error: `This YouTube video is unavailable, private, or not found (${videoId}).`,
      details: 'Please verify that the video is public and accessible.',
      canFallbackManual: true,
      canUploadMedia: true,
      suggestedAction: 'check_url'
    };
  }

  // 4. Network or Timeout Failure
  if (msg.includes('fetch failed') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') || msg.includes('network')) {
    return {
      errorCode: 'NETWORK_ERROR',
      error: `Network timeout connecting to YouTube (${msg.slice(0, 100)}).`,
      details: 'Could not reach YouTube servers. Please try again or paste the transcript text manually.',
      canFallbackManual: true,
      canUploadMedia: true,
      suggestedAction: 'manual_paste_or_upload'
    };
  }

  // 5. General Transcript Not Available
  return {
    errorCode: 'TRANSCRIPT_NOT_AVAILABLE',
    error: `No captions or subtitles are available for this video (${videoId}).`,
    details: 'The video does not have readable subtitles in the requested language. Please paste the transcript or upload audio/video for automated AI Speech-to-Text.',
    canFallbackManual: true,
    canUploadMedia: true,
    suggestedAction: 'manual_paste_or_upload'
  };
}

/**
 * Main YouTube Transcript Fetcher
 * Implements request caching, rate-limit cooldown, multiple fallback strategies,
 * and clear, non-fabricating error reporting with manual fallback.
 */
async function fetchTranscript(urlOrId, requestedLang = 'en', options = {}) {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) {
    return {
      success: false,
      errorCode: 'INVALID_URL',
      error: 'Invalid YouTube URL or Video ID. Please provide a valid YouTube link.',
      canFallbackManual: true,
      canUploadMedia: true
    };
  }

  // 1. Check in-memory cache
  const cacheKey = `yt_transcript_${videoId}_${requestedLang}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult && !options.skipCache) {
    return {
      ...cachedResult,
      isCached: true
    };
  }

  // 2. Fetch video metadata in parallel
  const metadataPromise = fetchVideoMetadata(videoId);

  // 3. Check if IP is currently under rate-limit cooldown
  if (cache.isCooldownActive()) {
    const metadata = await metadataPromise;
    const errorInfo = categorizeError(new Error('Rate limit cooldown active'), videoId);
    return {
      success: false,
      videoId,
      metadata,
      ...errorInfo
    };
  }

  let transcriptData = null;
  let lastError = null;

  // 4. Strategy 1: Multi-Client InnerTube API (single-pass inspection of all caption tracks)
  try {
    transcriptData = await fetchViaInnerTube(videoId, requestedLang);
  } catch (err) {
    lastError = err;
  }

  // 5. Strategy 2: Direct TimedText API (if InnerTube didn't return data)
  if (!transcriptData && !cache.isCooldownActive()) {
    try {
      transcriptData = await fetchViaTimedText(videoId, requestedLang);
    } catch (err) {
      lastError = err;
    }
  }

  // 6. Strategy 3: Standard youtube-transcript library fallback
  if (!transcriptData && !cache.isCooldownActive()) {
    try {
      transcriptData = await fetchViaYoutubeTranscriptLib(videoId, requestedLang);
    } catch (err) {
      lastError = err;
    }
  }

  const metadata = await metadataPromise;

  // 7. Handle failure
  if (!transcriptData || !transcriptData.items || transcriptData.items.length === 0) {
    // Short negative cache (90s) to prevent hammering YouTube on repeated clicks
    cache.set(`yt_negative_${videoId}`, true, 90 * 1000);

    const errorInfo = categorizeError(lastError, videoId);
    return {
      success: false,
      videoId,
      metadata,
      ...errorInfo
    };
  }

  // 8. Format successful transcript
  const formatted = formatTranscript(transcriptData.items);
  const result = {
    success: true,
    videoId,
    metadata,
    language: transcriptData.language || requestedLang,
    isAutoGenerated: Boolean(transcriptData.isAutoGenerated),
    wordCount: formatted.wordCount,
    timestampedText: formatted.timestampedText,
    fullText: formatted.fullText,
    rawItems: formatted.rawItems
  };

  // Cache successful result (1 hour TTL)
  cache.set(cacheKey, result, 60 * 60 * 1000);

  return result;
}

/**
 * Allows clearing or querying cache (useful for testing and monitoring)
 */
function getCache() {
  return cache;
}

module.exports = {
  extractVideoId,
  fetchVideoMetadata,
  fetchTranscript,
  formatTranscript,
  parseTranscriptXml,
  decodeEntities,
  getCache
};
