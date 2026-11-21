const { YoutubeTranscript } = require('youtube-transcript');

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
 * Fetches video metadata (title, author, thumbnail) via official YouTube oEmbed
 */
async function fetchVideoMetadata(videoId) {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) {
      return {
        title: `YouTube Lecture (${videoId})`,
        author: 'Unknown Instructor',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`
      };
    }
    const data = await res.json();
    return {
      title: data.title || `YouTube Lecture (${videoId})`,
      author: data.author_name || 'YouTube Instructor',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  } catch (err) {
    return {
      title: `YouTube Lecture (${videoId})`,
      author: 'YouTube Instructor',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  }
}

/**
 * Formats transcript items into readable text with timestamps and clean text
 */
function formatTranscript(items) {
  if (!items || !items.length) return '';

  const timestamped = items.map(item => {
    const totalSecs = Math.floor(item.offset / 1000);
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `[${mins}:${secs}] ${item.text}`;
  }).join('\n');

  const cleanText = items.map(i => i.text.trim()).join(' ');

  return {
    rawItems: items,
    timestampedText: timestamped,
    fullText: cleanText,
    wordCount: cleanText.split(/\s+/).filter(Boolean).length
  };
}

/**
 * Fetches transcript for a video with English / Hindi support
 * Returns clear error if captions are disabled or unavailable
 */
async function fetchTranscript(urlOrId, requestedLang = 'en') {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) {
    return {
      success: false,
      error: 'Invalid YouTube URL or Video ID. Please provide a valid YouTube link.'
    };
  }

  // Fetch metadata in parallel
  const metadataPromise = fetchVideoMetadata(videoId);

  let transcriptItems = null;
  let detectedLang = requestedLang;
  let fetchError = null;

  // 1. Try requested language first
  try {
    transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: requestedLang });
    if (transcriptItems && transcriptItems.length > 0) {
      detectedLang = requestedLang;
    }
  } catch (err) {
    fetchError = err;
  }

  // 2. If requested lang failed and wasn't English, try English fallback
  if ((!transcriptItems || transcriptItems.length === 0) && requestedLang !== 'en') {
    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
      if (transcriptItems && transcriptItems.length > 0) {
        detectedLang = 'en (fallback)';
      }
    } catch (err) {
      // ignore, proceed to general attempt
    }
  }

  // 3. If requested was English, but user might have Hindi captions, try 'hi'
  if ((!transcriptItems || transcriptItems.length === 0) && requestedLang === 'en') {
    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'hi' });
      if (transcriptItems && transcriptItems.length > 0) {
        detectedLang = 'hi (auto-detected)';
      }
    } catch (err) {
      // ignore
    }
  }

  // 4. Try without language parameter to grab default/auto-generated track
  if (!transcriptItems || transcriptItems.length === 0) {
    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      if (transcriptItems && transcriptItems.length > 0) {
        detectedLang = 'default / auto-generated';
      }
    } catch (err) {
      fetchError = err;
    }
  }

  const metadata = await metadataPromise;

  // If captions could not be retrieved
  if (!transcriptItems || transcriptItems.length === 0) {
    const errorMsg = fetchError ? fetchError.message : 'No captions found';
    return {
      success: false,
      videoId,
      metadata,
      error: `Captions are unavailable or disabled for this video (${errorMsg}). Please paste the transcript or upload a transcript file manually below.`,
      canFallbackManual: true
    };
  }

  const formatted = formatTranscript(transcriptItems);

  return {
    success: true,
    videoId,
    metadata,
    language: detectedLang,
    wordCount: formatted.wordCount,
    timestampedText: formatted.timestampedText,
    fullText: formatted.fullText
  };
}

module.exports = {
  extractVideoId,
  fetchVideoMetadata,
  fetchTranscript
};
