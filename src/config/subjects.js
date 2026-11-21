const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CUSTOM_SUBJECTS_FILE = path.join(DATA_DIR, 'custom_subjects.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 5 Core Semester 3 Subjects (Preserved and immutable)
const CORE_SUBJECTS = [
  {
    id: 'oops_java',
    slug: '01_OOPS_Java',
    semester: 3,
    isCore: true,
    name: 'OOPS with Java',
    code: 'CS-301',
    icon: '☕',
    badge: 'Programming',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    folder: '01_OOPS_Java',
    fullPath: path.join(ROOT_DIR, '01_OOPS_Java'),
    hasCode: true,
    description: 'Object-Oriented Programming principles, JVM architecture, Memory management, Collections, Concurrency, and Stream API in Java.',
    units: [
      { id: 'unit_1', number: 1, title: 'Introduction to Java & Fundamentals', topics: ['JVM, JRE, JDK Architecture', 'Primitive Data Types & Type Casting', 'Operators & Control Flow', 'Command Line Arguments & Scanner I/O'] },
      { id: 'unit_2', number: 2, title: 'Core OOP Concepts & Classes', topics: ['Class, Object & Methods', 'Constructors & Constructor Chaining', 'this & static Keywords', 'Stack vs Heap Memory & Garbage Collection'] },
      { id: 'unit_3', number: 3, title: 'Inheritance & Polymorphism', topics: ['Inheritance Types & Dynamic Method Dispatch', 'Method Overloading vs Overriding', 'super & final Keywords', 'Abstract Classes vs Interfaces'] },
      { id: 'unit_4', number: 4, title: 'Packages & Exception Handling', topics: ['Packages & Access Modifiers', 'Exception Hierarchy (Checked vs Unchecked)', 'try-catch-finally & Multi-catch', 'throw, throws & Custom Exceptions'] },
      { id: 'unit_5', number: 5, title: 'Multithreading & Concurrency', topics: ['Thread Lifecycle & States', 'Thread class vs Runnable interface', 'Synchronization & Critical Sections', 'Inter-thread Communication (wait/notify)', 'Deadlocks & Thread Safety'] },
      { id: 'unit_6', number: 6, title: 'Collections Framework & Generics', topics: ['Collections Overview & Generics', 'List: ArrayList & LinkedList', 'Set: HashSet & TreeSet (Comparable/Comparator)', 'Map: HashMap & TreeMap Internal Working', 'Queue & Deque'] },
      { id: 'unit_7', number: 7, title: 'I/O Streams & Serialization', topics: ['Byte Streams vs Character Streams', 'BufferedReader & File Operations', 'Serialization & Serializable Interface', 'transient & volatile Keywords'] },
      { id: 'unit_8', number: 8, title: 'Modern Java (Java 8+ Features)', topics: ['Lambda Expressions & Functional Interfaces', 'Stream API (Filter, Map, Collect, Reduce)', 'Optional Class & Method References'] }
    ]
  },
  {
    id: 'dsa_java',
    slug: '02_DSA_Java',
    semester: 3,
    isCore: true,
    name: 'DSA with Java',
    code: 'CS-302',
    icon: '⚡',
    badge: 'Algorithms',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    folder: '02_DSA_Java',
    fullPath: path.join(ROOT_DIR, '02_DSA_Java'),
    hasCode: true,
    description: 'Data Structures, Algorithm Analysis, Trees, Graphs, Dynamic Programming, and LeetCode problem patterns in Java.',
    units: [
      { id: 'unit_1', number: 1, title: 'Algorithm Analysis & Recurrences', topics: ['Asymptotic Notations (Big-O, Omega, Theta)', 'Time & Space Complexity Analysis', 'Recurrence Relations & Master Theorem', 'Recursion Tree & Amortized Analysis'] },
      { id: 'unit_2', number: 2, title: 'Arrays, Strings & Pointers', topics: ['Prefix Sum & Difference Arrays', 'Two Pointers (Opposite & Same Direction)', 'Sliding Window (Fixed & Variable Size)', "Kadane's Algorithm", 'String Algorithms (KMP & Rabin-Karp)'] },
      { id: 'unit_3', number: 3, title: 'Linked Lists', topics: ['Singly, Doubly & Circular Linked Lists', "Fast & Slow Pointers (Floyd's Cycle Detection)", 'Linked List Reversal (Iterative & Recursive)', 'Merge Two Sorted Lists & Merge Sort'] },
      { id: 'unit_4', number: 4, title: 'Stacks & Queues', topics: ['Stack & Queue Implementations', 'Infix to Postfix Conversion & Evaluation', 'Monotonic Stack (Next Greater Element)', 'Circular Queue & Deque'] },
      { id: 'unit_5', number: 5, title: 'Searching & Sorting', topics: ['Binary Search & Search in Rotated Sorted Array', 'Merge Sort & Quick Sort Partitioning', 'Counting Sort & Radix Sort', 'Lower Bound & Upper Bound Techniques'] },
      { id: 'unit_6', number: 6, title: 'Trees & Binary Search Trees', topics: ['Tree Properties & Traversals (In, Pre, Post, Level)', 'Height, Diameter & Lowest Common Ancestor (LCA)', 'BST Insertion, Deletion & Search', 'AVL Trees & Balancing Rotations'] },
      { id: 'unit_7', number: 7, title: 'Priority Queues & Heaps', topics: ['Min Heap & Max Heap Properties', 'Heap Operations & O(N) Heapify', 'Heap Sort Algorithm', 'Top-K Elements & Running Median'] },
      { id: 'unit_8', number: 8, title: 'Graphs & Networks', topics: ['Graph Representations (Matrix vs List)', 'BFS & DFS Traversals', 'Cycle Detection in Directed & Undirected Graphs', 'Topological Sort (Kahn’s Algorithm)', "Dijkstra's & Bellman-Ford Shortest Path", 'MST: Kruskal’s (DSU) & Prim’s Algorithm'] },
      { id: 'unit_9', number: 9, title: 'Dynamic Programming & Greedy', topics: ['Memoization vs Tabulation', '0/1 Knapsack & Unbounded Knapsack', 'Longest Common Subsequence (LCS)', 'Longest Increasing Subsequence (LIS)', 'Matrix Chain Multiplication (MCM)', 'Greedy Algorithms (Activity Selection, Huffman)'] },
      { id: 'unit_10', number: 10, title: 'Backtracking & Branch and Bound', topics: ['State Space Trees & Backtracking Template', 'N-Queens Problem', 'Sudoku Solver', 'Subsets & Permutations Generation'] }
    ]
  },
  {
    id: 'operating_systems',
    slug: '03_Operating_System',
    semester: 3,
    isCore: true,
    name: 'Operating Systems',
    code: 'CS-303',
    icon: '💻',
    badge: 'Core Systems',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    folder: '03_Operating_System',
    fullPath: path.join(ROOT_DIR, '03_Operating_System'),
    hasCode: true,
    description: 'Kernel architectures, Process management, CPU scheduling, Concurrency, Deadlocks, Virtual memory, and Storage.',
    units: [
      { id: 'unit_1', number: 1, title: 'Introduction & OS Architecture', topics: ['OS Roles & Dual Mode Operation', 'System Calls & Trap Handling', 'Monolithic vs Microkernel Architectures'] },
      { id: 'unit_2', number: 2, title: 'Process Management & Threads', topics: ['Process States & PCB Structure', 'Context Switching Overhead', 'fork(), exec(), wait() & Process Life', 'User vs Kernel Threads & Thread Models'] },
      { id: 'unit_3', number: 3, title: 'CPU Scheduling & Numericals', topics: ['Scheduling Criteria (TAT, WT, RT)', 'FCFS & Convoy Effect', 'SJF & SRTF Scheduling', 'Round Robin with Time Quantum Optimization', 'Priority Scheduling & Multilevel Feedback Queue'] },
      { id: 'unit_4', number: 4, title: 'Process Synchronization', topics: ['Critical Section Problem & Race Conditions', "Peterson's Algorithm", 'Hardware Primitives (TestAndSet, CAS)', 'Mutex Locks vs Binary/Counting Semaphores', 'Classic Problems (Producer-Consumer, Dining Philosophers)'] },
      { id: 'unit_5', number: 5, title: 'Deadlocks', topics: ['4 Coffman Conditions & Resource Allocation Graphs', 'Deadlock Prevention Strategies', "Deadlock Avoidance: Banker's Algorithm", 'Deadlock Detection & Recovery Methods'] },
      { id: 'unit_6', number: 6, title: 'Main Memory Management', topics: ['Logical vs Physical Address & MMU', 'Contiguous Allocation & Fragmentation', 'Paging & Multi-Level Page Tables', 'Translation Lookaside Buffer (TLB & EMAT)', 'Segmentation Architecture'] },
      { id: 'unit_7', number: 7, title: 'Virtual Memory & Page Replacement', topics: ['Demand Paging & Page Fault Handling', 'FIFO & Belady’s Anomaly', 'Optimal (OPT) Page Replacement', 'LRU & Clock/Second Chance Algorithm', 'Thrashing & Working Set Model'] },
      { id: 'unit_8', number: 8, title: 'Storage & File Systems', topics: ['Disk Geometry (Seek Time & Rotational Latency)', 'Disk Scheduling (FCFS, SSTF, SCAN, C-SCAN, LOOK)', 'File Allocation (Contiguous, Linked, Indexed/Inode)', 'Free Space Management Techniques'] }
    ]
  },
  {
    id: 'discrete_mathematics',
    slug: '04_Discrete_Mathematics',
    semester: 3,
    isCore: true,
    name: 'Discrete Mathematics',
    code: 'CS-304',
    icon: '📐',
    badge: 'Theory & Math',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    folder: '04_Discrete_Mathematics',
    fullPath: path.join(ROOT_DIR, '04_Discrete_Mathematics'),
    hasCode: false,
    description: 'Propositional logic, Proof techniques, Set theory, Combinatorics, Graph theory, and Algebraic structures.',
    units: [
      { id: 'unit_1', number: 1, title: 'Propositional & Predicate Logic', topics: ['Propositions, Truth Tables & Connectives', 'Tautologies, Contradictions & Equivalences', 'Predicates & Quantifiers (Universal & Existential)', 'Normal Forms: CNF & DNF', 'Rules of Inference & Valid Arguments'] },
      { id: 'unit_2', number: 2, title: 'Proof Techniques & Induction', topics: ['Direct Proof & Proof by Contraposition', 'Proof by Contradiction & Counterexamples', 'Mathematical Induction (Weak & Strong)', 'Well-Ordering Principle'] },
      { id: 'unit_3', number: 3, title: 'Sets, Relations & Functions', topics: ['Set Operations, Power Sets & Venn Diagrams', 'Relations (Reflexive, Symmetric, Transitive)', 'Equivalence Relations & Partitions', 'Posets, Hasse Diagrams & Lattices', 'Functions: Injective, Surjective & Bijective'] },
      { id: 'unit_4', number: 4, title: 'Combinatorics & Recurrence', topics: ['Rule of Sum & Product, Pigeonhole Principle', 'Permutations & Combinations', 'Principle of Inclusion-Exclusion (PIE) & Derangements', 'Linear Homogeneous & Non-Homogeneous Recurrences', 'Generating Functions'] },
      { id: 'unit_5', number: 5, title: 'Graph Theory', topics: ['Degrees & Handshaking Lemma', 'Paths, Cycles & Graph Isomorphism', 'Eulerian & Hamiltonian Graphs', 'Planar Graphs & Euler’s Formula (V - E + F = 2)', 'Graph Coloring & Chromatic Number', 'Trees & Spanning Trees'] },
      { id: 'unit_6', number: 6, title: 'Algebraic Structures', topics: ['Binary Operations, Semigroups & Monoids', 'Groups & Abelian Groups', 'Subgroups & Cyclic Groups', "Cosets & Lagrange's Theorem", 'Rings, Integral Domains & Fields Basics'] },
      { id: 'unit_7', number: 7, title: 'Boolean Algebra', topics: ['Axioms & Duality Principle', 'Boolean Functions & Minterm/Maxterm Representation', 'Logic Simplification in Discrete Formats'] }
    ]
  },
  {
    id: 'digital_electronics',
    slug: '05_Digital_Electronics',
    semester: 3,
    isCore: true,
    name: 'Digital Electronics',
    code: 'CS-305',
    icon: '🔌',
    badge: 'Hardware & Circuits',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    folder: '05_Digital_Electronics',
    fullPath: path.join(ROOT_DIR, '05_Digital_Electronics'),
    hasCode: true,
    description: 'Number systems, Boolean algebra, K-Maps, Combinational & Sequential circuits, Flip-Flops, Registers, Counters, and FSMs.',
    units: [
      { id: 'unit_1', number: 1, title: 'Number Systems & Binary Codes', topics: ['Binary, Octal, Hexadecimal Conversions', "1's & 2's Complement Arithmetic", 'Floating Point Representation (IEEE 754)', 'BCD, Excess-3 & Gray Code', 'Parity & Hamming Error Correction Code'] },
      { id: 'unit_2', number: 2, title: 'Boolean Algebra & K-Maps', topics: ['Basic & Universal Logic Gates', 'Boolean Postulates & De Morgan’s Laws', 'SOP and POS Canonical Forms', 'K-Map Minimization (2 to 5 Variables)', "Don't Care Conditions in K-Maps", 'Quine-McCluskey Tabular Method'] },
      { id: 'unit_3', number: 3, title: 'Combinational Logic Circuits', topics: ['Half Adder, Full Adder & Carry Lookahead', 'Half & Full Subtractors', 'Multiplexers (MUX) & Function Implementation', 'Demultiplexers & Decoders (3:8, BCD-7Seg)', 'Encoders & Priority Encoders', 'Magnitude Comparators & Code Converters'] },
      { id: 'unit_4', number: 4, title: 'Sequential Circuits & Flip-Flops', topics: ['Latches vs Flip-Flops (SR, JK, D, T)', 'Race-Around Condition & Master-Slave JK', 'Characteristic & Excitation Tables', 'Flip-Flop Conversion Methodology'] },
      { id: 'unit_5', number: 5, title: 'Registers & Counters', topics: ['Shift Registers (SISO, SIPO, PISO, PIPO)', 'Universal Shift Registers', 'Asynchronous / Ripple Counters (Mod-N)', 'Synchronous Counters Design', 'Ring Counter & Johnson Counter'] },
      { id: 'unit_6', number: 6, title: 'Finite State Machines (FSM)', topics: ['Mealy vs Moore State Machine Models', 'State Diagrams & State Reduction', 'Sequence Detector Design (Overlapping/Non-overlapping)', 'Glitches & Hazards in Digital Circuits'] },
      { id: 'unit_7', number: 7, title: 'Semiconductor Memories & PLDs', topics: ['RAM (SRAM vs DRAM) & ROM (PROM, EPROM)', 'Programmable Logic Devices (PLA, PAL, PROM)', 'CPLD & FPGA Architectures Overview'] },
      { id: 'unit_8', number: 8, title: 'Logic Families & Converters', topics: ['TTL vs CMOS Characteristics (Noise Margin, Delay, Fan-Out)', 'D/A Converters (Weighted Resistor & R-2R Ladder)', 'A/D Converters (Flash, SAR, Dual Slope)'] }
    ]
  }
];

/**
 * Loads custom subjects from data/custom_subjects.json
 */
function loadCustomSubjects() {
  if (!fs.existsSync(CUSTOM_SUBJECTS_FILE)) {
    fs.writeFileSync(CUSTOM_SUBJECTS_FILE, '[]', 'utf-8');
    return [];
  }
  try {
    const raw = fs.readFileSync(CUSTOM_SUBJECTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Subjects] Failed to read custom_subjects.json:', err.message);
    return [];
  }
}

/**
 * Saves custom subjects to data/custom_subjects.json
 */
function saveCustomSubjects(customList) {
  fs.writeFileSync(CUSTOM_SUBJECTS_FILE, JSON.stringify(customList, null, 2), 'utf-8');
}

// Module-level array that is kept synchronized for backward compatibility
const subjects = [...CORE_SUBJECTS];

/**
 * Synchronizes the exported subjects array with CORE + Custom subjects
 */
function syncSubjectsArray() {
  const custom = loadCustomSubjects();
  // Ensure fullPath is resolved for custom subjects
  const resolvedCustom = custom.map(sub => {
    const fullPath = sub.fullPath || path.join(ROOT_DIR, sub.folder || `uploads/subjects/${sub.id}`);
    return {
      ...sub,
      fullPath
    };
  });

  subjects.length = 0;
  subjects.push(...CORE_SUBJECTS, ...resolvedCustom);
}

// Initial sync
syncSubjectsArray();

/**
 * Get all subjects (Core + Custom across all semesters)
 */
function getAllSubjects() {
  syncSubjectsArray();
  return subjects;
}

/**
 * Get subject by ID or slug
 */
function getSubjectById(id) {
  if (!id) return null;
  syncSubjectsArray();
  const idStr = String(id).toLowerCase().trim();
  const found = subjects.find(s => s.id.toLowerCase() === idStr || (s.slug && s.slug.toLowerCase() === idStr));
  return found || null;
}

/**
 * Get subjects filtered by semester (1 - 8)
 */
function getSubjectsBySemester(semester) {
  syncSubjectsArray();
  if (!semester || semester === 'all') return subjects;
  const semNum = parseInt(semester, 10);
  return subjects.filter(s => s.semester === semNum);
}

/**
 * Helper to pick thematic color & icon for a subject
 */
function getThemeForSubject(name = '', code = '') {
  const text = (name + ' ' + code).toLowerCase();
  if (text.includes('data') || text.includes('dbms') || text.includes('database') || text.includes('sql')) {
    return { icon: '🗄️', color: '#0284c7', gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', badge: 'Database Systems' };
  }
  if (text.includes('web') || text.includes('internet') || text.includes('cloud') || text.includes('network')) {
    return { icon: '🌐', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', badge: 'Web & Networks' };
  }
  if (text.includes('ai') || text.includes('artificial') || text.includes('intelligence') || text.includes('ml') || text.includes('machine learning')) {
    return { icon: '🤖', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', badge: 'AI & Data Science' };
  }
  if (text.includes('security') || text.includes('crypto') || text.includes('cyber')) {
    return { icon: '🔒', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', badge: 'Cyber Security' };
  }
  if (text.includes('compiler') || text.includes('toc') || text.includes('automata') || text.includes('computation')) {
    return { icon: '⚙️', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', badge: 'Theoretical CS' };
  }
  if (text.includes('software') || text.includes('engineering') || text.includes('agile')) {
    return { icon: '📐', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', badge: 'Software Eng' };
  }
  if (text.includes('graphics') || text.includes('multimedia') || text.includes('game') || text.includes('vision')) {
    return { icon: '🎨', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', badge: 'Graphics & Vision' };
  }
  return { icon: '📚', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', badge: 'CSE Core' };
}

/**
 * Creates subject folder structure
 */
function ensureSubjectFolders(folderPath) {
  const subDirs = [
    '01_Video_Transcripts',
    '02_Notes',
    '03_Exam_Notes',
    '04_PYQs',
    '05_Important_Questions',
    '06_Code_Examples',
    '07_Revision'
  ];
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  subDirs.forEach(sub => {
    const p = path.join(folderPath, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

/**
 * Add a new subject (prevents duplicate codes / slugs)
 */
function addSubject(data) {
  syncSubjectsArray();

  const name = (data.name || '').trim();
  const code = (data.code || '').trim().toUpperCase();
  const semester = parseInt(data.semester, 10);

  if (!name) throw new Error('Subject name is required.');
  if (!code) throw new Error('Subject code is required (e.g., CS-401).');
  if (isNaN(semester) || semester < 1 || semester > 8) {
    throw new Error('Semester must be an integer between 1 and 8.');
  }

  // Check duplicate code or name within the same semester or global
  const existingCode = subjects.find(s => s.code.toUpperCase() === code && s.semester === semester);
  if (existingCode) {
    throw new Error(`Subject with code "${code}" already exists in Semester ${semester} (${existingCode.name}).`);
  }

  // Generate safe id
  const codeSlug = code.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const nameSlug = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30);
  let id = `${codeSlug}_${nameSlug}`.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!id) id = `subject_${Date.now()}`;

  // Ensure unique id
  let counter = 2;
  const originalId = id;
  while (subjects.some(s => s.id === id)) {
    id = `${originalId}_${counter++}`;
  }

  const theme = getThemeForSubject(name, code);
  const folder = `uploads/subjects/${id}`;
  const fullPath = path.join(ROOT_DIR, folder);

  ensureSubjectFolders(fullPath);

  // Normalize units & topics
  const rawUnits = Array.isArray(data.units) ? data.units : [];
  const normalizedUnits = rawUnits.map((u, uIdx) => {
    const unitNum = parseInt(u.number, 10) || (uIdx + 1);
    const unitTitle = (u.title || `Unit ${unitNum}`).trim();
    const rawTopics = Array.isArray(u.topics) ? u.topics : [];
    const topics = Array.from(new Set(rawTopics.map(t => String(t).trim()).filter(Boolean)));
    return {
      id: `unit_${unitNum}`,
      number: unitNum,
      title: unitTitle,
      topics
    };
  });

  const newSubject = {
    id,
    slug: id,
    semester,
    isCore: false,
    name,
    code,
    icon: data.icon || theme.icon,
    badge: data.badge || theme.badge,
    color: data.color || theme.color,
    gradient: data.gradient || theme.gradient,
    folder,
    fullPath,
    hasCode: Boolean(data.hasCode ?? true),
    description: (data.description || `${name} (${code}) curriculum for Semester ${semester}.`).trim(),
    units: normalizedUnits,
    createdAt: new Date().toISOString()
  };

  const custom = loadCustomSubjects();
  custom.push(newSubject);
  saveCustomSubjects(custom);

  syncSubjectsArray();
  return newSubject;
}

/**
 * Update an existing subject
 */
function updateSubject(id, updatedData) {
  syncSubjectsArray();
  const subject = getSubjectById(id);
  if (!subject) throw new Error(`Subject with ID "${id}" not found.`);

  const custom = loadCustomSubjects();
  const customIdx = custom.findIndex(s => s.id === id);

  if (subject.isCore) {
    // If it's a core subject, we can allow updating units/topics or description
    // but keep core flags intact
    if (customIdx === -1) {
      // Create custom overlay if core subject modified
      const modifiedCore = { ...subject, ...updatedData, id: subject.id, isCore: true };
      custom.push(modifiedCore);
    } else {
      custom[customIdx] = { ...custom[customIdx], ...updatedData, id: subject.id, isCore: true };
    }
  } else {
    if (customIdx === -1) {
      throw new Error(`Subject with ID "${id}" is not editable.`);
    }

    if (updatedData.code) {
      const targetSem = parseInt(updatedData.semester || custom[customIdx].semester, 10);
      const duplicate = subjects.find(s => s.id !== id && s.code.toUpperCase() === updatedData.code.trim().toUpperCase() && s.semester === targetSem);
      if (duplicate) {
        throw new Error(`Subject code "${updatedData.code}" is already used by "${duplicate.name}" in Semester ${targetSem}.`);
      }
    }

    // Normalize units if provided
    if (updatedData.units && Array.isArray(updatedData.units)) {
      updatedData.units = updatedData.units.map((u, uIdx) => {
        const unitNum = parseInt(u.number, 10) || (uIdx + 1);
        const unitTitle = (u.title || `Unit ${unitNum}`).trim();
        const rawTopics = Array.isArray(u.topics) ? u.topics : [];
        const topics = Array.from(new Set(rawTopics.map(t => String(t).trim()).filter(Boolean)));
        return {
          id: `unit_${unitNum}`,
          number: unitNum,
          title: unitTitle,
          topics
        };
      });
    }

    custom[customIdx] = {
      ...custom[customIdx],
      ...updatedData,
      id: custom[customIdx].id, // preserve immutable ID
      updatedAt: new Date().toISOString()
    };
  }

  saveCustomSubjects(custom);
  syncSubjectsArray();
  return getSubjectById(id);
}

/**
 * Delete a custom subject (Preserves Core Semester 3 Subjects)
 */
function deleteSubject(id) {
  syncSubjectsArray();
  const subject = getSubjectById(id);
  if (!subject) throw new Error(`Subject with ID "${id}" not found.`);

  if (subject.isCore) {
    throw new Error('Cannot delete core Semester 3 subjects. They are essential to the CSE curriculum foundation.');
  }

  const custom = loadCustomSubjects();
  const filtered = custom.filter(s => s.id !== id);
  saveCustomSubjects(filtered);

  // Clean up progress entry for deleted custom subject
  try {
    const progressFile = path.join(DATA_DIR, 'progress.json');
    if (fs.existsSync(progressFile)) {
      const prog = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      if (prog[id]) {
        delete prog[id];
        fs.writeFileSync(progressFile, JSON.stringify(prog, null, 2), 'utf-8');
      }
    }
  } catch (err) {
    console.warn('[Subjects] Could not clean progress for deleted subject:', err.message);
  }

  syncSubjectsArray();
  return true;
}

module.exports = {
  ROOT_DIR,
  CORE_SUBJECTS,
  subjects,
  getAllSubjects,
  getSubjectById,
  getSubjectsBySemester,
  addSubject,
  updateSubject,
  deleteSubject,
  getThemeForSubject,
  syncSubjectsArray
};
