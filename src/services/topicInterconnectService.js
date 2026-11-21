const { getSubjectById } = require('../config/subjects');
const pyqService = require('./pyqService');
const fileService = require('./fileService');
const progressService = require('./progressService');
const practiceService = require('./practiceService');

/**
 * Aggregates all interconnected academic resources for any specific syllabus topic
 */
function getInterconnectedTopicHub(subjectId, topicName, unitNumber = null) {
  const subject = getSubjectById(subjectId);
  if (!subject) throw new Error(`Subject "${subjectId}" not found`);

  // 1. Locate Unit
  let unit = null;
  if (unitNumber) {
    unit = (subject.units || []).find(u => u.number === parseInt(unitNumber, 10));
  }
  if (!unit) {
    unit = (subject.units || []).find(u => 
      (u.topics || []).some(t => t.toLowerCase() === topicName.toLowerCase())
    ) || (subject.units && subject.units[0]) || { number: 1, title: 'Core Concepts' };
  }

  // 2. Completion Status
  const progress = progressService.loadProgress();
  const subProg = progress[subject.id] || { completedTopics: [] };
  const isCompleted = (subProg.completedTopics || []).includes(topicName);

  // 3. Related PYQs & Repeated Questions
  const pyqData = pyqService.getRelatedPYQsForTopic(subject.id, topicName);

  // 4. Saved Lectures & Transcripts in Library
  const allSubjectLectures = fileService.getLectures({ subjectId: subject.id });
  const relatedLectures = allSubjectLectures.filter(lec => 
    (lec.topicTitle && lec.topicTitle.toLowerCase().includes(topicName.toLowerCase())) ||
    (topicName.toLowerCase().includes((lec.topicTitle || '').toLowerCase())) ||
    (lec.unitNumber === unit.number)
  );

  // 5. Practice MCQs preview for this topic
  let practiceSample = [];
  if (practiceService.CURATED_QUESTION_BANK[subject.id]) {
    practiceSample = practiceService.CURATED_QUESTION_BANK[subject.id].filter(q =>
      q.topic.toLowerCase().includes(topicName.toLowerCase()) || topicName.toLowerCase().includes(q.topic.toLowerCase())
    );
  }

  // 6. Importance Status Calculation
  let importanceBadge = 'Normal Weightage';
  let importanceClass = 'badge-normal';
  let importanceDescription = 'Standard syllabus concept.';

  if (pyqData.appearances >= 3 || pyqData.totalMarks >= 15) {
    importanceBadge = '🔥 High Yield / Must Prepare';
    importanceClass = 'badge-high';
    importanceDescription = `Appeared ${pyqData.appearances} times in university exams (${pyqData.years.join(', ')}), carrying approx ${pyqData.totalMarks} marks.`;
  } else if (pyqData.appearances >= 1) {
    importanceBadge = '⚡ Medium Frequency';
    importanceClass = 'badge-medium';
    importanceDescription = `Observed in past paper (${pyqData.years.join(', ')}), carrying ${pyqData.totalMarks} marks.`;
  }

  return {
    subject: {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      semester: subject.semester || 3,
      color: subject.color,
      gradient: subject.gradient,
      icon: subject.icon
    },
    unit: {
      number: unit.number,
      title: unit.title
    },
    topic: topicName,
    isCompleted,
    importance: {
      badge: importanceBadge,
      class: importanceClass,
      description: importanceDescription,
      level: pyqData.importance
    },
    pyqs: pyqData,
    lectures: relatedLectures,
    practiceSample,
    recommendedYoutubeSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(subject.name + ' ' + topicName + ' computer science lecture')}`
  };
}

module.exports = {
  getInterconnectedTopicHub
};
