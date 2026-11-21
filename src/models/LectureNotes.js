const { createModel } = require('./baseModel');

/**
 * LectureNotes Model
 * Comprehensive 24-Dimension Academic Study Pack linked to transcripts:
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
 * 11. Flashcards
 * 12. MCQs with four options
 * 13. MCQ Correct Answers
 * 14. MCQ Explanations
 * 15. Short Answer Questions
 * 16. Long Answer Questions
 * 17. Interview Questions
 * 18. Viva Questions
 * 19. Previous Year Questions
 * 20. PYQ Topic Mapping
 * 21. Frequently Asked Questions
 * 22. Exam-Oriented Notes
 * 23. Quick Revision Notes
 * 24. Practice Tests
 */
const LectureNotes = createModel('LectureNotes', 'lecture_notes', {
  studentId: { type: String, default: 'default_student' },
  transcriptId: { type: String, required: true },
  topicTitle: { type: String, required: true },
  categoryType: { type: String, default: 'curriculum' },
  categoryId: { type: String, required: true },

  // 1. Complete Lecture Summary
  lectureSummary: { type: String, default: '' },
  shortSummary: { type: String, default: '' }, // legacy alias

  // 2. Topic-wise Notes (With intro, definition, explanation, points, examples, related Qs, timestamp)
  topicWiseNotes: [{
    id: String,
    title: String,
    timestamp: String,
    subtopics: [String],
    introduction: String,
    definition: String,
    detailedExplanation: String,
    importantPoints: [String],
    examples: [{ title: String, explanation: String }],
    relatedQuestions: [String],
    simpleExplanation: String, // alias
    definitions: [{ term: String, definition: String }],
    keyConcepts: [String]
  }],

  // 3. Subtopic-wise Notes
  subtopicWiseNotes: [{
    id: String,
    subtopicTitle: String,
    parentTopic: String,
    timestamp: String,
    summary: String,
    keyTakeaways: [String]
  }],

  // 4. Detailed Topic Explanations
  detailedExplanations: [{
    heading: String,
    content: String,
    timestampRef: String,
    takeaway: String
  }],
  detailedNotes: [{
    heading: String,
    content: String,
    timestampRef: String
  }], // legacy alias

  // 5. Important Definitions
  importantDefinitions: [{
    term: String,
    definition: String,
    timestampRef: String,
    context: String
  }],
  keyDefinitions: [{
    term: String,
    definition: String,
    timestampRef: String
  }], // legacy alias

  // 6. Key Concepts
  keyConcepts: [{
    concept: String,
    explanation: String,
    importance: String
  }],
  importantConcepts: [{ type: String }], // legacy alias

  // 7. Important Points
  importantPoints: [{ type: String }],
  keyTakeaways: [{ type: String }], // legacy alias

  // 8. Real-world Examples
  realWorldExamples: [{
    title: String,
    scenario: String,
    industryApplication: String,
    explanation: String
  }],

  // 9. Solved Examples
  solvedExamples: [{
    title: String,
    problem: String,
    stepByStepSolution: [String],
    codeOrProof: String,
    keyTakeaway: String
  }],
  examples: [{
    title: String,
    scenario: String,
    codeOrIllustration: String,
    example: String,
    explanation: String
  }], // unified alias

  // 10. Important Formulas
  importantFormulas: [{
    name: String,
    formula: String,
    explanation: String,
    variables: String
  }],
  formulas: [{
    name: String,
    formula: String,
    explanation: String,
    variables: String
  }], // legacy alias

  // 11. Flashcards (Question on front, answer on back, topic name, difficulty level)
  flashcards: [{
    id: Number,
    front: String,
    back: String,
    topic: String,
    difficultyLevel: { type: String, default: 'Medium' },
    hint: String
  }],

  // 12. MCQs with four options (Question, 4 options, correct answer, explanation, difficulty, related topic)
  practiceMcqs: [{
    id: Number,
    question: String,
    options: [String],
    correctOption: Number,
    explanation: String,
    difficultyLevel: { type: String, default: 'Medium' },
    relatedTopic: String,
    hint: String
  }],
  mcqs: [{
    question: String,
    options: [String],
    correctOption: Number,
    explanation: String,
    difficultyLevel: String,
    relatedTopic: String
  }], // legacy alias

  // 13. MCQ Correct Answers (Summary of correct options & rationale)
  mcqCorrectAnswers: [{
    questionNumber: Number,
    question: String,
    correctOptionLetter: String,
    correctOptionText: String,
    keyRationale: String
  }],

  // 14. MCQ Explanations (Comprehensive breakdown of options)
  mcqExplanations: [{
    questionNumber: Number,
    question: String,
    correctExplanation: String,
    distractorAnalysis: String
  }],

  // 15. Short Answer Questions (2-3 Marks)
  shortAnswerQuestions: [{
    question: String,
    marks: Number,
    answer: String,
    keyPoints: [String]
  }],

  // 16. Long Answer Questions (7-10 Marks)
  longAnswerQuestions: [{
    question: String,
    marks: Number,
    answer: String,
    structuralOutline: [String]
  }],
  importantQuestions: [{
    question: String,
    answer: String,
    marks: Number,
    modelAnswerOutline: [String]
  }], // legacy alias

  // 17. Interview Questions (Technical screening & conceptual depth)
  interviewQuestions: [{
    question: String,
    companyContext: String,
    technicalAnswer: String,
    followUpTip: String
  }],

  // 18. Viva Questions (Oral exam & lab defense)
  vivaQuestions: [{
    question: String,
    quickAnswer: String,
    examinerExpectedKeyword: String
  }],

  // 19. Previous Year Questions
  previousYearQuestions: [{
    year: String,
    examName: String,
    question: String,
    marks: Number,
    solution: String,
    frequency: String
  }],
  pyqMapping: [{
    year: String,
    question: String,
    marks: Number,
    frequency: String,
    topicArea: String,
    examTips: String
  }], // legacy alias

  // 20. PYQ Topic Mapping
  pyqTopicMapping: [{
    topicName: String,
    appearancesCount: Number,
    examWeightage: String,
    trendAnalysis: String
  }],

  // 21. Frequently Asked Questions
  faqs: [{
    question: String,
    answer: String,
    practicalScenario: String
  }],

  // 22. Exam-Oriented Notes
  examOrientedNotes: [{
    category: String,
    tip: String,
    commonMistakesToAvoid: String,
    highScoringStrategy: String
  }],

  // 23. Quick Revision Notes
  quickRevisionNotes: [{ type: String }],
  revisionNotes: [{ type: String }], // legacy alias

  // 24. Practice Tests
  practiceTests: [{
    testTitle: String,
    instructions: String,
    durationMinutes: Number,
    totalMarks: Number,
    questions: [{
      qNum: Number,
      question: String,
      marks: Number,
      type: String
    }]
  }],

  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

module.exports = LectureNotes;
