const fs = require('fs');
const path = require('path');
const { getSubjectById, getAllSubjects, ROOT_DIR } = require('../config/subjects');
const aiService = require('./aiService');
const pyqService = require('./pyqService');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const PRACTICE_FILE = path.join(DATA_DIR, 'practice.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadPracticeData() {
  if (!fs.existsSync(PRACTICE_FILE)) {
    const initial = {
      attempts: [],
      savedFlashcards: {},
      weakTopics: {}
    };
    fs.writeFileSync(PRACTICE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(PRACTICE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { attempts: [], savedFlashcards: {}, weakTopics: {} };
  }
}

function savePracticeData(data) {
  fs.writeFileSync(PRACTICE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Built-in Curated Questions Bank for Core Subjects
 */
const CURATED_QUESTION_BANK = {
  oops_java: [
    {
      id: 'oops_1',
      topic: 'JVM, JRE, JDK Architecture',
      question: 'Which component of the JVM is responsible for converting bytecode into machine-level instructions at runtime?',
      options: ['Class Loader', 'JIT (Just-In-Time) Compiler', 'Garbage Collector', 'Security Manager'],
      correctIndex: 1,
      explanation: 'The JIT compiler compiles hot bytecode sequences into native machine instructions to accelerate execution.'
    },
    {
      id: 'oops_2',
      topic: 'Stack vs Heap Memory & Garbage Collection',
      question: 'In Java memory management, where are local primitive variables and object references stored?',
      options: ['Heap Memory', 'Stack Memory', 'Metaspace', 'Code Cache'],
      correctIndex: 1,
      explanation: 'Method execution frames, local primitives, and reference pointers reside in Stack memory, while actual objects live on the Heap.'
    },
    {
      id: 'oops_3',
      topic: 'Inheritance Types & Dynamic Method Dispatch',
      question: 'How does Dynamic Method Dispatch resolve an overridden method invocation in Java?',
      options: ['At compile time based on reference type', 'At runtime based on the actual object instance being referred to', 'Based on package access modifier', 'Randomly selected by the JVM'],
      correctIndex: 1,
      explanation: 'Dynamic method dispatch uses the runtime object type (virtual method table lookup) to resolve overridden method calls.'
    },
    {
      id: 'oops_4',
      topic: 'Multithreading & Concurrency',
      question: 'Which method call transitions a running Java Thread into the WAITING state and releases the acquired monitor lock?',
      options: ['Thread.sleep()', 'Thread.yield()', 'object.wait()', 'thread.join()'],
      correctIndex: 2,
      explanation: 'object.wait() releases the synchronized monitor lock on the object and puts the current thread in the wait set until notified.'
    },
    {
      id: 'oops_5',
      topic: 'Map: HashMap & TreeMap Internal Working',
      question: 'In Java 8+, what happens when a single HashMap bucket has more than 8 elements (TREEIFY_THRESHOLD)?',
      options: ['Throws OutOfMemoryError', 'Converts LinkedList into a Red-Black Balanced Tree (TreeNode)', 'Doubles hash table size without changing bucket structure', 'Deletes oldest entry'],
      correctIndex: 1,
      explanation: 'Java 8 converts collided bucket linked lists into balanced Red-Black Trees to improve lookup from O(N) to O(log N).'
    }
  ],
  dsa_java: [
    {
      id: 'dsa_1',
      topic: 'Asymptotic Notations (Big-O, Omega, Theta)',
      question: 'What is the tightest worst-case time complexity of finding an element in a balanced AVL Binary Search Tree?',
      options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
      correctIndex: 1,
      explanation: 'AVL trees strictly maintain a height balance factor between -1 and +1, ensuring O(log N) worst-case height and lookup.'
    },
    {
      id: 'dsa_2',
      topic: "Fast & Slow Pointers (Floyd's Cycle Detection)",
      question: "In Floyd's Cycle Detection Algorithm, if the fast pointer moves at 2 nodes/step and slow at 1 node/step, where do they meet if a cycle exists?",
      options: ['At the head of the list', 'At the cycle entry point', 'Inside the cycle loop', 'They never meet'],
      correctIndex: 2,
      explanation: 'The fast pointer reduces the distance between them by 1 node per iteration, guaranteeing a meeting point inside the cycle.'
    },
    {
      id: 'dsa_3',
      topic: 'Topological Sort (Kahn’s Algorithm)',
      question: 'Topological sort is strictly valid for which type of graph representation?',
      options: ['Undirected Cyclic Graph', 'Directed Acyclic Graph (DAG)', 'Complete Bipartite Graph', 'Weighted Undirected Tree'],
      correctIndex: 1,
      explanation: 'Topological sorting linearly orders vertices such that for every directed edge u -> v, u comes before v. This requires a DAG.'
    },
    {
      id: 'dsa_4',
      topic: '0/1 Knapsack & Unbounded Knapsack',
      question: 'What is the primary difference in recurrence relation between 0/1 Knapsack and Unbounded Knapsack?',
      options: ['0/1 Knapsack allows items to be chosen multiple times', 'Unbounded Knapsack stays on the same item index i after inclusion: dp[i][w - wt[i]]', 'Unbounded Knapsack cannot be solved via Dynamic Programming', '0/1 Knapsack requires negative weights'],
      correctIndex: 1,
      explanation: 'Unbounded knapsack allows unlimited reuse of an item, keeping the state on the current item index after including its weight.'
    }
  ],
  operating_systems: [
    {
      id: 'os_1',
      topic: 'Process States & PCB Structure',
      question: 'Which hardware register saved in the Process Control Block (PCB) points to the next machine instruction to be fetched?',
      options: ['Stack Pointer (SP)', 'Program Counter (PC)', 'Accumulator', 'Base Limit Register'],
      correctIndex: 1,
      explanation: 'The Program Counter (PC) stores the memory address of the next sequential instruction to be executed by the CPU.'
    },
    {
      id: 'os_2',
      topic: '4 Coffman Conditions & Resource Allocation Graphs',
      question: 'Which of the following is NOT one of the 4 necessary Coffman conditions for a deadlock?',
      options: ['Mutual Exclusion', 'Preemption Allowed', 'Hold and Wait', 'Circular Wait'],
      correctIndex: 1,
      explanation: 'The condition is NO PREEMPTION. If preemption is allowed, deadlocks can be systematically resolved.'
    },
    {
      id: 'os_3',
      topic: 'Translation Lookaside Buffer (TLB & EMAT)',
      question: 'If TLB search time is 10ns, Main Memory access is 100ns, and TLB Hit Ratio is 90%, what is Effective Memory Access Time (EMAT)?',
      options: ['110 ns', '120 ns', '100 ns', '150 ns'],
      correctIndex: 1,
      explanation: 'EMAT = 0.90*(10 + 100) + 0.10*(10 + 100 + 100) = 0.90*(110) + 0.10*(210) = 99 + 21 = 120 ns.'
    },
    {
      id: 'os_4',
      topic: 'FIFO & Belady’s Anomaly',
      question: "What is Belady's Anomaly observed in virtual memory page replacement?",
      options: ['Page faults decrease when allocated frames increase', 'Page faults increase when allocated frames increase under FIFO', 'Memory thrashing on LRU', 'Deadlock in disk scheduling'],
      correctIndex: 1,
      explanation: "Belady's anomaly is the counter-intuitive phenomenon where increasing physical page frames increases page faults under FIFO."
    }
  ],
  discrete_mathematics: [
    {
      id: 'dm_1',
      topic: 'Tautologies, Contradictions & Equivalences',
      question: 'What is the logical negation of the proposition: "Every student passed the exam" (∀x P(x))?',
      options: ['No student passed the exam', 'There exists at least one student who did not pass (∃x ¬P(x))', 'Every student failed', 'Some students passed'],
      correctIndex: 1,
      explanation: 'By De Morgan’s laws for quantifiers, ¬(∀x P(x)) ≡ ∃x (¬P(x)).'
    },
    {
      id: 'dm_2',
      topic: 'Degrees & Handshaking Lemma',
      question: 'In an undirected graph with 8 vertices, each having degree 3, how many total edges exist?',
      options: ['24 edges', '12 edges', '8 edges', '16 edges'],
      correctIndex: 1,
      explanation: 'By Handshaking Lemma: Sum of degrees = 2 * |E|. 8 * 3 = 24 => |E| = 24 / 2 = 12 edges.'
    }
  ],
  digital_electronics: [
    {
      id: 'de_1',
      topic: 'K-Map Minimization (2 to 5 Variables)',
      question: 'In a 4-variable Karnaugh Map, grouping an octet (8 adjacent 1s) eliminates how many boolean variables?',
      options: ['1 variable', '2 variables', '3 variables', '4 variables'],
      correctIndex: 2,
      explanation: 'A group of 2^k cells eliminates k variables. 8 = 2^3, so an octet eliminates 3 variables, leaving a single literal.'
    },
    {
      id: 'de_2',
      topic: 'Race-Around Condition & Master-Slave JK',
      question: 'What condition causes race-around in a level-triggered JK flip-flop?',
      options: ['J=0, K=0 and clock is high', 'J=1, K=1 and clock pulse width tp > propagation delay td', 'J=1, K=0 and clock is low', 'Inverted clock edges'],
      correctIndex: 1,
      explanation: 'When J=K=1 in toggle mode and pulse width exceeds flip-flop propagation delay, output oscillates unpredictably during one clock pulse.'
    }
  ]
};

/**
 * Gets or Generates a Practice Quiz for a Topic
 */
async function getTopicQuiz(subjectId, unitNumber, topicName) {
  const subject = getSubjectById(subjectId);
  const subjectName = subject ? subject.name : 'Computer Science';
  const safeUnit = unitNumber ? `Unit ${unitNumber}` : 'Core Unit';

  // 1. Check if we have curated questions matching this subject
  let questions = [];
  if (CURATED_QUESTION_BANK[subjectId]) {
    const matched = CURATED_QUESTION_BANK[subjectId].filter(q => 
      !topicName || q.topic.toLowerCase().includes(topicName.toLowerCase()) || topicName.toLowerCase().includes(q.topic.toLowerCase())
    );
    if (matched.length > 0) {
      questions.push(...matched);
    }
  }

  // 2. If fewer than 3 questions and AI is available, generate fresh questions
  if (questions.length < 3 && aiService.isConfigured()) {
    try {
      const generated = await aiService.generatePracticeQuestions(subjectName, safeUnit, topicName || 'Core Fundamentals', 5);
      if (generated && generated.length > 0) {
        questions.push(...generated);
      }
    } catch (err) {
      console.warn('[Practice Service AI Quiz Error]', err.message);
    }
  }

  // 3. Fallback generic questions if still empty
  if (questions.length === 0) {
    questions = [
      {
        id: 'q_gen_1',
        topic: topicName || 'General',
        question: `Which fundamental principle is central to ${topicName || 'this computer science concept'}?`,
        options: [
          `Abstract representation and deterministic state transitions`,
          `Uncontrolled global state mutations`,
          `Hardware bus inversion only`,
          `Single-threaded restrictions`
        ],
        correctIndex: 0,
        explanation: `${topicName || 'This concept'} provides high structural abstraction and state integrity in computing systems.`
      },
      {
        id: 'q_gen_2',
        topic: topicName || 'General',
        question: `In university examinations, what is the most important factor when evaluating ${topicName || 'this algorithm'}?`,
        options: [
          `Time and Space complexity invariants`,
          `Variable names character count`,
          `Using only recursive syntax`,
          `Disabling hardware caching`
        ],
        correctIndex: 0,
        explanation: 'Academic evaluations prioritize formal asymptotic bounds and correctness proofs.'
      },
      {
        id: 'q_gen_3',
        topic: topicName || 'General',
        question: `What is the primary trade-off when optimizing ${topicName || 'this system architecture'}?`,
        options: [
          `Space complexity versus time efficiency and throughput`,
          `Increasing network latency arbitrarily`,
          `Eliminating compile-time type validation`,
          `Restricting memory bus width`
        ],
        correctIndex: 0,
        explanation: 'System designs balance memory overhead with CPU execution time and cache locality.'
      },
      {
        id: 'q_gen_4',
        topic: topicName || 'General',
        question: `Which error condition must be safeguarded against when implementing ${topicName || 'this data structure'}?`,
        options: [
          `Null pointer dereference and out-of-bounds boundary errors`,
          `Excessive stack frame reuse`,
          `Register renaming overhead`,
          `Deterministic instruction scheduling`
        ],
        correctIndex: 0,
        explanation: 'Defensive programming requires boundary bounds checking and non-null guarantees.'
      }
    ];
  }

  // Normalize each question to ensure 4 options, difficultyLevel, and relatedTopic
  const normalizedQuestions = questions.map((q, idx) => {
    let opts = Array.isArray(q.options) ? [...q.options] : [];
    if (opts.length < 4) {
      const padOptions = [
        'Deterministic algorithmic state processing',
        'Hardware-level clock cycle synchronization',
        'Asymptotic boundary conditions invariance',
        'Dynamic runtime dispatch resolution'
      ];
      while (opts.length < 4) {
        opts.push(padOptions[opts.length] || `Alternative academic formulation ${opts.length + 1}`);
      }
    }
    const diffs = ['Easy', 'Medium', 'Hard'];
    const difficultyLevel = q.difficultyLevel || q.difficulty || diffs[idx % 3];
    const relatedTopic = q.relatedTopic || q.topic || topicName || subjectName;
    const correctIndex = typeof q.correctIndex === 'number' 
      ? q.correctIndex 
      : (typeof q.correctOption === 'number' ? q.correctOption : 0);

    return {
      id: q.id || `q_${idx + 1}`,
      question: q.question,
      options: opts.slice(0, 4),
      correctIndex: Math.min(3, Math.max(0, correctIndex)),
      explanation: q.explanation || 'Detailed proof and curriculum derivations are available in the syllabus notes.',
      difficultyLevel,
      relatedTopic
    };
  });

  return {
    subjectId,
    subjectName,
    unitNumber,
    topicName: topicName || 'Curriculum Practice',
    questions: normalizedQuestions
  };
}

/**
 * Gets or Generates Interactive Flashcards for a Topic
 */
async function getTopicFlashcards(subjectId, unitNumber, topicName) {
  const subject = getSubjectById(subjectId);
  const subjectName = subject ? subject.name : 'Computer Science';
  const safeUnit = unitNumber ? `Unit ${unitNumber}` : 'Core Unit';

  let cards = [];
  if (aiService.isConfigured()) {
    try {
      cards = await aiService.generateFlashcards(subjectName, safeUnit, topicName || 'Key Concepts', 6);
    } catch (err) {
      console.warn('[Practice Service Flashcards Error]', err.message);
    }
  }

  if (!cards || cards.length === 0) {
    cards = [
      {
        id: 1,
        front: `What is the core definition of ${topicName || 'this concept'}?`,
        back: `Foundational computing architecture principle in ${subjectName} providing modularity, determinism, and performance guarantees.`,
        difficultyLevel: 'Easy',
        topic: topicName || subjectName
      },
      {
        id: 2,
        front: `Exam Tip: What diagram or table should you draw for ${topicName || 'this topic'}?`,
        back: `Draw the state transition / architecture diagram, label inputs, processing logic, and output invariants.`,
        difficultyLevel: 'Medium',
        topic: topicName || subjectName
      },
      {
        id: 3,
        front: `Common Edge Case / Hazard in ${topicName || 'this topic'}?`,
        back: `Watch out for boundary conditions (null/empty inputs, race conditions, memory leaks, and overflow).`,
        difficultyLevel: 'Hard',
        topic: topicName || subjectName
      },
      {
        id: 4,
        front: `What is the primary real-world use case of ${topicName || 'this topic'}?`,
        back: `Deployed in operating system kernels, distributed engines, and backend frameworks to maintain scalability and correctness.`,
        difficultyLevel: 'Medium',
        topic: topicName || subjectName
      }
    ];
  }

  // Normalize all cards to guarantee front, back, topic, difficultyLevel
  const diffs = ['Easy', 'Medium', 'Hard'];
  const normalizedCards = cards.map((c, idx) => ({
    id: c.id || idx + 1,
    front: c.front || c.question || `Key question on ${topicName || 'this concept'}`,
    back: c.back || c.answer || `Comprehensive explanation and takeaway for ${topicName || 'this concept'}`,
    topic: c.topic || topicName || subjectName,
    difficultyLevel: c.difficultyLevel || c.difficulty || diffs[idx % 3],
    hint: c.hint || ''
  }));

  return {
    subjectId,
    subjectName,
    unitNumber,
    topicName: topicName || 'Active Recall',
    flashcards: normalizedCards
  };
}

/**
 * Generates Full-Length Mock Exam Test across multiple units
 */
async function generateMockTest(subjectId, count = 10) {
  const subject = getSubjectById(subjectId);
  if (!subject) throw new Error('Subject not found');

  const pool = [];
  if (CURATED_QUESTION_BANK[subject.id]) {
    pool.push(...CURATED_QUESTION_BANK[subject.id]);
  }

  // Supplement with questions from uploaded PYQs
  const pyqPapers = pyqService.getPYQs(subject.id);
  pyqPapers.forEach(p => {
    const list = p.structuredQuestions || [];
    list.forEach(q => {
      pool.push({
        id: `pyq_${Math.random().toString(36).slice(2, 7)}`,
        topic: q.topic || 'Exam Question',
        question: q.question,
        options: [
          'Correct university model answer approach',
          'Alternative theoretical counter-example',
          'Edge case condition failure',
          'Heuristic approximation'
        ],
        correctIndex: 0,
        explanation: `Authentic ${q.year || 'past'} exam question (${q.marks || 5} marks).`
      });
    });
  });

  // Pick up to count questions
  const selected = pool.slice(0, count);

  return {
    testId: `mock_${Date.now()}`,
    subject,
    title: `${subject.name} - Full Curriculum Mock Examination`,
    durationMinutes: 45,
    totalQuestions: selected.length,
    questions: selected
  };
}

/**
 * Records a Student's Quiz / Mock Attempt & Updates Weak Topic Analysis
 */
function recordQuizAttempt({ subjectId, topicName, score, total, answers = [] }) {
  const data = loadPracticeData();
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const attempt = {
    id: `att_${Date.now()}`,
    subjectId,
    topicName: topicName || 'General Practice',
    score,
    total,
    percentage,
    date: new Date().toISOString()
  };

  data.attempts.unshift(attempt);

  // Update Weak Topic Analysis: If accuracy < 60%, mark topic as weak
  const topicKey = `${subjectId}::${topicName || 'General'}`;
  if (!data.weakTopics[topicKey]) {
    data.weakTopics[topicKey] = {
      subjectId,
      topicName: topicName || 'General',
      totalAttempts: 0,
      totalScore: 0,
      totalPossible: 0,
      lastTested: new Date().toISOString()
    };
  }

  const stat = data.weakTopics[topicKey];
  stat.totalAttempts++;
  stat.totalScore += score;
  stat.totalPossible += total;
  stat.lastTested = new Date().toISOString();
  stat.averageAccuracy = Math.round((stat.totalScore / stat.totalPossible) * 100);

  savePracticeData(data);
  return attempt;
}

/**
 * Returns Weak Topics Analyzed across all student practice
 */
function getWeakTopicAnalysis() {
  const data = loadPracticeData();
  const weakList = Object.values(data.weakTopics || {})
    .filter(t => t.totalPossible >= 2 && t.averageAccuracy < 70)
    .sort((a, b) => a.averageAccuracy - b.averageAccuracy);

  return weakList.map(item => {
    const subject = getSubjectById(item.subjectId);
    return {
      ...item,
      subjectName: subject ? subject.name : item.subjectId,
      subjectColor: subject ? subject.color : '#4f46e5',
      recommendation: `Scoring ${item.averageAccuracy}%. Review lecture notes and practice related PYQ questions.`
    };
  });
}

function getPracticeStats() {
  const data = loadPracticeData();
  const totalAttempts = data.attempts.length;
  const avgScore = totalAttempts > 0 
    ? Math.round(data.attempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts)
    : 0;

  return {
    totalAttempts,
    avgScore,
    recentAttempts: data.attempts.slice(0, 5),
    weakTopics: getWeakTopicAnalysis()
  };
}

module.exports = {
  getTopicQuiz,
  getTopicFlashcards,
  generateMockTest,
  recordQuizAttempt,
  getWeakTopicAnalysis,
  getPracticeStats,
  CURATED_QUESTION_BANK
};
