const express = require('express');
const router = express.Router();
const exploreService = require('../services/exploreService');
const transcriptionService = require('../services/transcriptionService');
const { getAllSubjects } = require('../config/subjects');

// GET /explore - All 8 Learning Domains & Career Roadmaps
router.get('/', async (req, res) => {
  try {
    const tracks = exploreService.getAllTracks();
    const overallCompleted = tracks.reduce((sum, t) => sum + t.completedCount, 0);
    const overallTotal = tracks.reduce((sum, t) => sum + t.totalTopics, 0);
    const overallPercent = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

    // Fetch transcripts count per track
    const allTranscripts = await transcriptionService.getTranscripts({ studentId: 'default_student' });
    const trackTranscriptCounts = {};
    allTranscripts.forEach(t => {
      if (t.categoryId) {
        trackTranscriptCounts[t.categoryId] = (trackTranscriptCounts[t.categoryId] || 0) + 1;
      }
    });

    res.render('pages/explore', {
      title: 'Explore & Learn: CSE Roadmaps - CSE Study Hub',
      tracks,
      overallPercent,
      overallCompleted,
      overallTotal,
      trackTranscriptCounts,
      subjects: getAllSubjects(),
      activeNav: 'explore'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', error: err });
  }
});

// GET /explore/:id - Single Track Multi-Stage Roadmap & Milestone Tracker
router.get('/:id', async (req, res) => {
  try {
    const track = exploreService.getTrackById(req.params.id);
    if (!track) {
      return res.status(404).render('pages/404', {
        title: 'Roadmap Track Not Found',
        message: `The roadmap track "${req.params.id}" was not found.`
      });
    }

    // Fetch all transcribed lectures for this explore track
    const transcripts = await transcriptionService.getTranscripts({
      categoryId: req.params.id,
      studentId: 'default_student'
    });

    // Map transcripts by milestone ID and topic title for fast lookup
    const milestoneTranscripts = {};
    transcripts.forEach(t => {
      if (t.topicId) {
        if (!milestoneTranscripts[t.topicId]) milestoneTranscripts[t.topicId] = [];
        milestoneTranscripts[t.topicId].push(t);
      }
      if (t.topicTitle) {
        const key = t.topicTitle.toLowerCase().trim();
        if (!milestoneTranscripts[key]) milestoneTranscripts[key] = [];
        milestoneTranscripts[key].push(t);
      }
    });

    // Cross-bind transcripts to milestones by name and token matching
    if (track.stages) {
      track.stages.forEach(stage => {
        (stage.topics || []).forEach(mTopic => {
          if (!milestoneTranscripts[mTopic.id]) {
            const mNameLower = mTopic.name.toLowerCase().trim();
            const mWords = mNameLower.split(/\s+/).filter(w => w.length > 3);
            const matched = transcripts.find(t => {
              const tTitleLower = (t.topicTitle || '').toLowerCase().trim();
              if (tTitleLower === mNameLower) return true;
              if (tTitleLower.includes(mNameLower) || mNameLower.includes(tTitleLower)) return true;
              const matches = mWords.filter(w => tTitleLower.includes(w)).length;
              return matches >= 2 || (mWords.length === 1 && matches === 1);
            });
            if (matched) {
              milestoneTranscripts[mTopic.id] = [matched];
            }
          }
        });
      });
    }

    res.render('pages/explore-detail', {
      title: `${track.title} Roadmap - CSE Study Hub`,
      track,
      transcripts,
      milestoneTranscripts,
      subjects: getAllSubjects(),
      activeNav: 'explore'
    });
  } catch (err) {
    res.status(500).render('pages/error', { title: 'Error', error: err });
  }
});

// POST /explore/api/toggle - Toggle Milestone Completion
router.post('/api/toggle', (req, res) => {
  try {
    const { trackId, milestoneId } = req.body;
    if (!trackId || !milestoneId) {
      return res.status(400).json({ success: false, error: 'trackId and milestoneId are required.' });
    }

    const result = exploreService.toggleMilestone(trackId, milestoneId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /explore/api/reset - Reset All Completed Milestones for a Track
router.post('/api/reset', (req, res) => {
  try {
    const { trackId } = req.body;
    if (!trackId) {
      return res.status(400).json({ success: false, error: 'trackId is required.' });
    }

    const result = exploreService.resetTrackProgress(trackId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
