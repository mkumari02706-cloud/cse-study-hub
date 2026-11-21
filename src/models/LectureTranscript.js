const { createModel } = require('./baseModel');

/**
 * LectureTranscript Model
 * Stores full transcripts with timestamps from YouTube or uploaded media.
 */
const LectureTranscript = createModel('LectureTranscript', 'lecture_transcripts', {
  studentId: { type: String, default: 'default_student' },
  title: { type: String, required: true },
  categoryType: { type: String, default: 'curriculum' }, // 'curriculum' or 'explore'
  categoryId: { type: String, required: true }, // subjectId or trackId (e.g. 'ai_ml', 'devops')
  categoryName: { type: String, default: '' },
  topicId: { type: String, default: '' },
  topicTitle: { type: String, required: true },
  unitNumber: { type: Number, default: null },
  sourceType: { type: String, default: 'youtube' }, // 'youtube', 'audio_upload', 'video_upload', 'recording', 'manual'
  sourceUrl: { type: String, default: null },
  videoId: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: 0 },
  language: { type: String, default: 'en' },
  wordCount: { type: Number, default: 0 },
  duration: { type: String, default: '' },
  timestampedTranscript: [{
    timestamp: String, // e.g. "[04:12]"
    offsetSec: Number,
    text: String
  }],
  rawText: { type: String, default: '' },
  isCompleted: { type: Boolean, default: false },
  notesId: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = LectureTranscript;
