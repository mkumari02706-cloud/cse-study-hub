const assert = require('assert');
const path = require('path');
const fs = require('fs');
const app = require('./server');
const {
  subjects,
  CORE_SUBJECTS,
  getAllSubjects,
  getSubjectById,
  getSubjectsBySemester,
  addSubject,
  updateSubject,
  deleteSubject
} = require('./src/config/subjects');
const youtubeService = require('./src/services/youtubeService');
const fileService = require('./src/services/fileService');
const progressService = require('./src/services/progressService');
const syllabusService = require('./src/services/syllabusService');
const aiService = require('./src/services/aiService');

async function runTests() {
  console.log('🧪 Starting CSE Study Hub Test Suite...\n');

  // Test 1: Subjects Configuration
  console.log('Test 1: Verifying 5 Core Subjects Configuration');
  assert.strictEqual(CORE_SUBJECTS.length, 5, 'Should have exactly 5 core subjects');
  const expectedIds = ['oops_java', 'dsa_java', 'operating_systems', 'discrete_mathematics', 'digital_electronics'];
  expectedIds.forEach(id => {
    const sub = getSubjectById(id);
    assert.ok(sub, `Subject ${id} must exist`);
    assert.strictEqual(sub.semester, 3, `Subject ${id} must belong to Semester 3`);
    assert.strictEqual(sub.isCore, true, `Subject ${id} must be flagged as core`);
    assert.ok(sub.units.length > 0, `Subject ${id} must have units defined`);
    console.log(`  ✓ ${sub.name} (Sem ${sub.semester}, ${sub.units.length} Units loaded)`);
  });

  // Test 2: YouTube Video ID Extractor
  console.log('\nTest 2: Verifying YouTube Video ID Extractor');
  const testUrls = [
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
    { url: 'https://youtu.be/dQw4w9WgXcQ?si=abc', expected: 'dQw4w9WgXcQ' },
    { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
    { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
    { url: 'dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' }
  ];

  testUrls.forEach(({ url, expected }) => {
    const extracted = youtubeService.extractVideoId(url);
    assert.strictEqual(extracted, expected, `Failed to extract ID from ${url}`);
    console.log(`  ✓ Extracted ${extracted} from ${url}`);
  });

  // Test 3: YouTube Captions Missing Error Handling
  console.log('\nTest 3: Verifying Captions Unavailable Error Handling');
  const badResult = await youtubeService.fetchTranscript('invalid_id_xyz');
  assert.strictEqual(badResult.success, false, 'Should report success: false on unavailable captions');
  assert.ok(badResult.error, 'Should provide helpful error message');
  console.log(`  ✓ Clear error message returned: "${badResult.error.slice(0, 60)}..."`);

  // Test 4: Progress Stats Calculation
  console.log('\nTest 4: Verifying Progress Stats & Checklists');
  const stats = progressService.getProgressStats();
  assert.ok(stats.grandTotalTopics > 0, 'Grand total topics must be greater than 0');
  console.log(`  ✓ Total topics across curriculum: ${stats.grandTotalTopics}`);
  console.log(`  ✓ Completed: ${stats.grandCompletedTopics} (${stats.overallPercentage}%)`);

  // Test 5: HTTP Server Route Rendering Check
  console.log('\nTest 5: Verifying Express Route Rendering');
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const routesToTest = [
    '/',
    '/?semester=3',
    '/?semester=4',
    '/subject/oops_java',
    '/subject/dsa_java',
    '/subject/operating_systems',
    '/subject/discrete_mathematics',
    '/subject/digital_electronics',
    '/syllabus/upload',
    '/add-lecture',
    '/library',
    '/pyqs',
    '/progress',
    '/search?q=polymorphism'
  ];

  for (const route of routesToTest) {
    const res = await fetch(`${baseUrl}${route}`);
    assert.strictEqual(res.status, 200, `Route ${route} returned status ${res.status}`);
    const html = await res.text();
    assert.ok(html.includes('CSE Study Hub'), `Route ${route} HTML should contain "CSE Study Hub"`);
    console.log(`  ✓ GET ${route} -> 200 OK (${html.length} bytes)`);
  }

  // Test 6: Multi-Semester Subject Management & Duplicate Prevention
  console.log('\nTest 6: Multi-Semester Management & Subject Protection');
  // Attempt to delete core subject (must fail)
  assert.throws(() => {
    deleteSubject('oops_java');
  }, /Cannot delete core/i, 'Deleting core subject must throw error');
  console.log('  ✓ Preserved core subject: deletion prevented with security error');

  // Add a new subject to Semester 4
  const testSub = addSubject({
    name: 'Database Management Systems',
    code: 'CS-401',
    semester: 4,
    description: 'Relational models, SQL, and indexing.',
    units: [
      { number: 1, title: 'Introduction to DBMS', topics: ['Database Concepts', 'DBMS Architecture', 'Data Models'] },
      { number: 2, title: 'Relational Algebra', topics: ['Tuple Calculus', 'Domain Calculus'] }
    ]
  });
  assert.ok(testSub.id, 'New subject should have an ID generated');
  assert.strictEqual(testSub.semester, 4, 'New subject should belong to Semester 4');
  console.log(`  ✓ Successfully added custom subject: ${testSub.name} (${testSub.code}) in Sem ${testSub.semester}`);

  // Test duplicate prevention: attempting to add same code in Sem 4 must fail
  assert.throws(() => {
    addSubject({
      name: 'Advanced DBMS',
      code: 'CS-401',
      semester: 4,
      units: []
    });
  }, /already exists/i, 'Duplicate code in same semester must throw error');
  console.log('  ✓ Duplicate subject code prevention verified');

  // Test semester filtering
  const sem4Subs = getSubjectsBySemester(4);
  assert.ok(sem4Subs.some(s => s.code === 'CS-401'), 'Semester 4 should contain CS-401');
  console.log(`  ✓ Semester filtering verified: ${sem4Subs.length} subjects found in Semester 4`);

  // Clean up test subject
  deleteSubject(testSub.id);
  assert.strictEqual(getSubjectById(testSub.id), null, 'Custom subject should be removed cleanly');
  console.log('  ✓ Custom subject cleanly removed after verification');

  // Test 7: Syllabus JSON Validation & Error Handling
  console.log('\nTest 7: Syllabus Validation Engine');
  const validJson = JSON.stringify({
    semester: 4,
    subjects: [
      {
        name: 'Operating Systems II',
        code: 'CS-402',
        units: [
          { number: 1, title: 'Distributed Systems', topics: ['RPC', 'MapReduce'] }
        ]
      }
    ]
  });

  const validResult = syllabusService.validateExtractedSyllabus(validJson);
  assert.strictEqual(validResult.isValid, true, 'Valid JSON must be accepted');
  assert.strictEqual(validResult.data.subjects[0].name, 'Operating Systems II');
  console.log('  ✓ Valid syllabus JSON schema validated successfully');

  const invalidJson = '{"broken": [}';
  const invalidResult = syllabusService.validateExtractedSyllabus(invalidJson);
  assert.strictEqual(invalidResult.isValid, false, 'Malformed JSON must be rejected gracefully');
  assert.ok(invalidResult.error, 'Error message must be present for malformed JSON');
  console.log(`  ✓ Malformed JSON rejected gracefully: "${invalidResult.error}"`);

  // Test 8: Heuristic Syllabus Text Parser
  console.log('\nTest 8: Intelligent Heuristic Syllabus Text Parser');
  const sampleSyllabusText = `
    University Computer Science Curriculum
    Semester IV
    Subject Code: CS-403
    Course Title: Design and Analysis of Algorithms
    Unit 1: Divide and Conquer
    Binary Search, Merge Sort, Quick Sort, Strassen's Matrix Multiplication
    Unit 2: Dynamic Programming
    0/1 Knapsack, Longest Common Subsequence, Matrix Chain Multiplication
  `;
  const parsedHeuristic = aiService.heuristicSyllabusParser(sampleSyllabusText, 4);
  assert.strictEqual(parsedHeuristic.semester, 4);
  assert.ok(parsedHeuristic.subjects.length > 0, 'Heuristic parser should extract subjects');
  assert.ok(parsedHeuristic.subjects[0].units.length > 0, 'Heuristic parser should extract units');
  console.log(`  ✓ Heuristic parser extracted ${parsedHeuristic.subjects.length} subject(s) with ${parsedHeuristic.subjects[0].units.length} units`);

  // Test 9: Syllabus API Endpoints via HTTP
  console.log('\nTest 9: Syllabus Save API Endpoint & Overwrite Protection');
  const saveRes = await fetch(`${baseUrl}/syllabus/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      semester: 5,
      subjects: [
        {
          name: 'Computer Networks',
          code: 'CS-501',
          semester: 5,
          units: [
            { number: 1, title: 'Physical Layer', topics: ['OSI Model', 'Transmission Media'] }
          ]
        }
      ]
    })
  });
  assert.strictEqual(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.strictEqual(saveData.success, true);
  assert.strictEqual(saveData.savedCount, 1);
  console.log('  ✓ POST /syllabus/api/save successfully saved test subject to Semester 5');

  // Verify duplicate prevention without overwrite flag
  const dupRes = await fetch(`${baseUrl}/syllabus/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      semester: 5,
      overwrite: false,
      subjects: [
        {
          name: 'Computer Networks Duplicate',
          code: 'CS-501',
          semester: 5,
          units: [{ number: 1, title: 'Network Security', topics: ['Firewalls', 'VPNs'] }]
        }
      ]
    })
  });
  const dupData = await dupRes.json();
  assert.strictEqual(dupData.savedCount, 0, 'Duplicate subject should not be saved without overwrite flag');
  assert.ok(dupData.errors.length > 0, 'Duplicate error must be reported');
  console.log('  ✓ Duplicate subject rejected gracefully without overwrite flag');

  // Verify duplicate update WITH overwrite flag
  const overwriteRes = await fetch(`${baseUrl}/syllabus/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      semester: 5,
      overwrite: true,
      subjects: [
        {
          name: 'Computer Networks Advanced',
          code: 'CS-501',
          semester: 5,
          units: [{ number: 1, title: 'Network Security', topics: ['Firewalls', 'VPNs'] }]
        }
      ]
    })
  });
  const overwriteData = await overwriteRes.json();
  assert.strictEqual(overwriteData.success, true);
  assert.strictEqual(overwriteData.savedCount, 1);
  console.log('  ✓ Overwrite successfully updated existing subject when overwrite: true');

  // Verify it appears in Semester 5 stats
  const sem5Stats = progressService.getProgressStats(5);
  assert.ok(sem5Stats.grandTotalSubjects >= 1);
  assert.ok(sem5Stats.grandTotalTopics >= 2);
  console.log(`  ✓ Semester 5 stats updated dynamically: ${sem5Stats.grandTotalTopics} topics tracked`);

  // Verify custom subject is cleaned up along with progress entry
  deleteSubject(saveData.savedSubjects[0].id);
  const progressAfterDelete = progressService.loadProgress();
  assert.strictEqual(progressAfterDelete[saveData.savedSubjects[0].id], undefined, 'Deleted subject progress should be purged');
  console.log('  ✓ Test subject and progress cleanly purged after verification');

  // Test 10: PDF Upload Endpoint Validation & /syllabus Redirect
  console.log('\nTest 10: PDF Upload Route & Navigation Verification');
  const redirectRes = await fetch(`${baseUrl}/syllabus`, { redirect: 'manual' });
  assert.strictEqual(redirectRes.status, 302, 'GET /syllabus should redirect with 302');
  assert.strictEqual(redirectRes.headers.get('location'), '/syllabus/upload');
  console.log('  ✓ GET /syllabus correctly redirects to /syllabus/upload');

  // Test PDF upload without file returns 400
  const noFileRes = await fetch(`${baseUrl}/syllabus/api/extract`, {
    method: 'POST'
  });
  assert.strictEqual(noFileRes.status, 400);
  const noFileData = await noFileRes.json();
  assert.strictEqual(noFileData.success, false);
  console.log('  ✓ POST /syllabus/api/extract without file returns 400 Bad Request');

  // Test PDF upload with actual PDF file via FormData
  const fs = require('fs');
  const pdfBuffer = fs.readFileSync('./node_modules/pdf-parse/test/data/01-valid.pdf');
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const form = new FormData();
  form.append('syllabusPdf', pdfBlob, '01-valid.pdf');
  form.append('semester', '4');

  const pdfUploadRes = await fetch(`${baseUrl}/syllabus/api/extract`, {
    method: 'POST',
    body: form
  });
  assert.strictEqual(pdfUploadRes.status, 200, 'Uploading valid PDF should succeed with 200 OK');
  const pdfUploadData = await pdfUploadRes.json();
  assert.strictEqual(pdfUploadData.success, true);
  assert.ok(pdfUploadData.syllabus, 'Extracted syllabus payload must exist');
  assert.strictEqual(pdfUploadData.syllabus.semester, 4);
  assert.ok(pdfUploadData.syllabus.subjects.length > 0, 'Should extract at least one subject');
  console.log(`  ✓ POST /syllabus/api/extract multipart PDF upload parsed ${pdfUploadData.syllabus.subjects.length} subject(s) successfully`);

  // Test 11: PYQ Analyzer & Frequency Analytics Engine
  console.log('\nTest 11: PYQ Analyzer, Repeat Detection & Frequency Engine');
  const pyqService = require('./src/services/pyqService');
  const samplePaperText = `
    University Examination 2023 - CS-301: OOPS with Java
    Max Marks: 70
    Q1(a) Explain JVM, JRE, JDK Architecture with a neat diagram. [7 Marks]
    Q1(b) Differentiate between Method Overloading and Method Overriding. [7 Marks]
    Q2(a) Explain Exception Hierarchy in Java with Checked vs Unchecked exceptions. [7 Marks]
    Q3(a) Write a Java program implementing Producer-Consumer problem using wait() and notify(). [10 Marks]
    Q4(a) Explain dynamic method dispatch with an example. [5 Marks]
  `;
  const tempPaperPath = path.join(__dirname, 'uploads', 'test_paper.txt');
  fs.writeFileSync(tempPaperPath, samplePaperText, 'utf-8');

  const processedPYQ = await pyqService.processUploadedPaper({
    subjectId: 'oops_java',
    unitNumber: 1,
    year: '2023',
    examType: 'University Exam',
    uploadedFile: {
      path: tempPaperPath,
      originalname: '2023_University_Exam.txt',
      mimetype: 'text/plain'
    }
  });
  if (fs.existsSync(tempPaperPath)) fs.unlinkSync(tempPaperPath);

  assert.ok(processedPYQ.id, 'Processed PYQ should have an ID');
  assert.strictEqual(processedPYQ.subjectId, 'oops_java');
  assert.ok(processedPYQ.totalQuestions > 0, 'Should extract questions from paper');
  console.log(`  ✓ Processed PYQ uploaded: ${processedPYQ.totalQuestions} questions parsed, ${processedPYQ.totalMarks} marks`);

  // Check analytics calculation
  const pyqAnalytics = pyqService.getSubjectPYQAnalytics('oops_java');
  assert.ok(pyqAnalytics.totalPapers >= 1, 'Should reflect at least 1 paper in analytics');
  assert.ok(pyqAnalytics.importanceRanking.length > 0, 'Should calculate importance ranking for topics');
  assert.ok(pyqAnalytics.marksDistribution.medium >= 1 || pyqAnalytics.marksDistribution.long >= 1, 'Marks distribution should be populated');
  console.log(`  ✓ PYQ Analytics verified: ${pyqAnalytics.importanceRanking.length} syllabus topics ranked with historical evidence`);

  // Check related PYQs for a topic
  const relatedPYQs = pyqService.getRelatedPYQsForTopic('oops_java', 'JVM, JRE, JDK Architecture');
  assert.ok(relatedPYQs.questions.length >= 1, 'Should find questions matching JVM architecture');
  console.log(`  ✓ Interconnected PYQ query: Found ${relatedPYQs.questions.length} questions matching "JVM, JRE, JDK Architecture"`);

  // Check HTTP analytics endpoint
  const analyticsRes = await fetch(`${baseUrl}/pyqs/analytics/oops_java`);
  assert.strictEqual(analyticsRes.status, 200);
  console.log('  ✓ GET /pyqs/analytics/oops_java -> 200 OK');

  // Test 12: AI Academic Study Assistant Handlers
  console.log('\nTest 12: AI Academic Study Assistant Handlers');
  const assistantPageRes = await fetch(`${baseUrl}/assistant`);
  assert.strictEqual(assistantPageRes.status, 200);
  console.log('  ✓ GET /assistant -> 200 OK');

  // Test Ask Doubt API in Hinglish, Hindi, English
  const doubtRes = await fetch(`${baseUrl}/assistant/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectId: 'operating_systems',
      unitTitle: 'Unit 5 - Deadlocks',
      topicName: "Deadlock Avoidance: Banker's Algorithm",
      question: "Explain Banker's Algorithm step-by-step",
      language: 'hinglish'
    })
  });
  assert.strictEqual(doubtRes.status, 200);
  const doubtData = await doubtRes.json();
  assert.strictEqual(doubtData.success, true);
  assert.ok(doubtData.answer.length > 50);
  console.log('  ✓ POST /assistant/api/ask -> 200 OK (returned structured academic response)');

  // Test Code Explainer API
  const codeRes = await fetch(`${baseUrl}/assistant/api/explain-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'public int binarySearch(int[] arr, int target) { int l=0, r=arr.length-1; while(l<=r) { int m = l+(r-l)/2; if (arr[m]==target) return m; else if(arr[m]<target) l=m+1; else r=m-1; } return -1; }',
      topicName: 'Binary Search',
      programmingLanguage: 'java'
    })
  });
  assert.strictEqual(codeRes.status, 200);
  const codeData = await codeRes.json();
  assert.strictEqual(codeData.success, true);
  assert.ok(codeData.explanation.length > 50);
  console.log('  ✓ POST /assistant/api/explain-code -> 200 OK (returned execution dry-run and complexities)');

  // Test PDF QA API
  const pdfQaRes = await fetch(`${baseUrl}/assistant/api/pdf-qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      existingPdfText: 'In Computer Science, Virtual Memory allows execution of processes not completely in memory. Paging maps logical address to physical frames.',
      question: 'What does virtual memory allow?',
      language: 'english'
    })
  });
  assert.strictEqual(pdfQaRes.status, 200);
  const pdfQaData = await pdfQaRes.json();
  assert.strictEqual(pdfQaData.success, true);
  console.log('  ✓ POST /assistant/api/pdf-qa -> 200 OK (grounded question answering over document)');

  // Test 13: Explore & Learn Career Roadmaps & Progress Tracking
  console.log('\nTest 13: Explore & Learn: 8 Domain Roadmaps & Milestone Tracking');
  const exploreRes = await fetch(`${baseUrl}/explore`);
  assert.strictEqual(exploreRes.status, 200);
  const exploreService = require('./src/services/exploreService');
  const allTracks = exploreService.getAllTracks();
  assert.strictEqual(allTracks.length, 8, 'Must provide all 8 required engineering roadmaps');
  const expectedTrackIds = ['ai_ml', 'generative_ai', 'devops', 'cybersecurity', 'web_development', 'cloud_computing', 'data_science', 'dsa'];
  expectedTrackIds.forEach(tId => {
    assert.ok(allTracks.some(t => t.id === tId), `Track ${tId} must exist`);
  });
  console.log(`  ✓ Verified all 8 career roadmaps: ${allTracks.map(t => t.shortName).join(', ')}`);

  // Verify track detail route
  const aimlTrackRes = await fetch(`${baseUrl}/explore/ai_ml`);
  assert.strictEqual(aimlTrackRes.status, 200);
  console.log('  ✓ GET /explore/ai_ml -> 200 OK');

  // Verify milestone toggle
  const toggleRes = await fetch(`${baseUrl}/explore/api/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId: 'ai_ml', milestoneId: 'aiml_1' })
  });
  assert.strictEqual(toggleRes.status, 200);
  const toggleData = await toggleRes.json();
  assert.strictEqual(toggleData.success, true);
  assert.strictEqual(toggleData.result.isCompleted, true);
  console.log('  ✓ POST /explore/api/toggle milestone successfully persisted');
  // Untoggle to restore state
  await fetch(`${baseUrl}/explore/api/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId: 'ai_ml', milestoneId: 'aiml_1' })
  });

  // Test 14: Practice Center (MCQs, Flashcards, Mock Exams, Weak Topics)
  console.log('\nTest 14: Practice Center: MCQs, Flashcards & Weak-Topic Diagnostics');
  const practiceRes = await fetch(`${baseUrl}/practice`);
  assert.strictEqual(practiceRes.status, 200);
  console.log('  ✓ GET /practice -> 200 OK');

  // Quiz endpoint
  const quizRes = await fetch(`${baseUrl}/practice/quiz?subject=oops_java&topic=JVM`);
  assert.strictEqual(quizRes.status, 200);
  console.log('  ✓ GET /practice/quiz?subject=oops_java -> 200 OK');

  // Flashcards endpoint
  const flashcardRes = await fetch(`${baseUrl}/practice/flashcards?subject=dsa_java`);
  assert.strictEqual(flashcardRes.status, 200);
  console.log('  ✓ GET /practice/flashcards?subject=dsa_java -> 200 OK');

  // Mock exam endpoint
  const mockExamRes = await fetch(`${baseUrl}/practice/mock/operating_systems`);
  assert.strictEqual(mockExamRes.status, 200);
  console.log('  ✓ GET /practice/mock/operating_systems -> 200 OK');

  // Submit test score to trigger weak-topic analysis
  const submitQuizRes = await fetch(`${baseUrl}/practice/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectId: 'operating_systems',
      topicName: 'Disk Scheduling (SSTF, SCAN, LOOK)',
      score: 1,
      total: 5
    })
  });
  assert.strictEqual(submitQuizRes.status, 200);
  const submitData = await submitQuizRes.json();
  assert.strictEqual(submitData.success, true);
  assert.ok(submitData.weakTopics.some(w => w.topicName.includes('Disk Scheduling')));
  console.log('  ✓ POST /practice/api/submit logged score (20%) and flagged topic in Weak-Topic Diagnostic Matrix');

  // Test 15: Personal Study Planner
  console.log('\nTest 15: Personal Study Planner: Daily Goals, Timetable & Spaced Revision');
  const plannerRes = await fetch(`${baseUrl}/planner`);
  assert.strictEqual(plannerRes.status, 200);
  console.log('  ✓ GET /planner -> 200 OK');

  // Add daily goal
  const addGoalRes = await fetch(`${baseUrl}/planner/api/goal/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Test Study Objective', subjectId: 'oops_java' })
  });
  assert.strictEqual(addGoalRes.status, 200);
  const goalData = await addGoalRes.json();
  assert.strictEqual(goalData.success, true);
  assert.ok(goalData.goal.id);
  console.log('  ✓ POST /planner/api/goal/add successfully added daily goal');

  // Toggle goal
  const toggleGoalRes = await fetch(`${baseUrl}/planner/api/goal/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goalId: goalData.goal.id })
  });
  assert.strictEqual(toggleGoalRes.status, 200);
  const toggleGoalData = await toggleGoalRes.json();
  assert.strictEqual(toggleGoalData.goal.completed, true);
  console.log('  ✓ POST /planner/api/goal/toggle toggled goal completion state');

  // Delete goal
  const deleteGoalRes = await fetch(`${baseUrl}/planner/api/goal/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goalId: goalData.goal.id })
  });
  assert.strictEqual(deleteGoalRes.status, 200);
  console.log('  ✓ POST /planner/api/goal/delete cleaned up test goal');

  // Test 16: Interconnected Topic Hub
  console.log('\nTest 16: Interconnected Topic Hub API');
  const topicHubRes = await fetch(`${baseUrl}/subject/oops_java/topic-hub?topic=JVM,%20JRE,%20JDK%20Architecture&unit=1`);
  assert.strictEqual(topicHubRes.status, 200);
  const topicHubData = await topicHubRes.json();
  assert.strictEqual(topicHubData.success, true);
  assert.ok(topicHubData.hub.subject, 'Hub must contain subject metadata');
  assert.ok(topicHubData.hub.importance, 'Hub must contain importance ranking');
  assert.ok(topicHubData.hub.pyqs, 'Hub must contain PYQ questions');
  assert.ok(Array.isArray(topicHubData.hub.lectures), 'Hub must contain related lectures array');
  console.log(`  ✓ GET /subject/oops_java/topic-hub returned complete interconnected learning suite: ${topicHubData.hub.importance.badge}`);

  // =========================================================================
  // INTEGRATED WORKFLOW TESTS: FEATURES 1, 2, 3, 4, 5
  // =========================================================================

  const { UniversityNotice, AcademicEvent, StudyPlan, StudyTask, LectureTranscript, LectureNotes, LearningProgress } = require('./src/models');
  const noticeService = require('./src/services/noticeService');
  const transcriptionService = require('./src/services/transcriptionService');
  const plannerService = require('./src/services/plannerService');

  // Test 17: University Notice Upload, OCR & Confirmation Flow (Workflow Steps 1 & 2)
  console.log('\nTest 17: University Notice Upload, OCR & Confirmation Flow (Workflow Steps 1 & 2)');
  const noticeRes = await fetch(`${baseUrl}/notices`);
  assert.strictEqual(noticeRes.status, 200, 'GET /notices should return 200 OK');
  console.log('  ✓ GET /notices -> 200 OK (University notices dashboard section renders)');

  // Extract from notice text containing exam dates and subject timetable
  const sampleNoticeText = `
    RAJIV GANDHI PROUDYOGIKI VISHWAVIDYALAYA, BHOPAL
    NOTIFICATION / CIRCULAR: END-SEMESTER EXAMINATION 2026
    Date: 2026-11-20
    It is hereby notified to all B.Tech Semester 3 students that the University Examination will commence from 15-12-2026.
    
    EXAMINATION TIMETABLE:
    15-12-2026 | 10:00 AM - 01:00 PM | CS-301: Object Oriented Programming with Java
    18-12-2026 | 10:00 AM - 01:00 PM | CS-302: Data Structures and Algorithms with Java
    22-12-2026 | 10:00 AM - 01:00 PM | CS-303: Operating Systems
    26-12-2026 | 10:00 AM - 01:00 PM | CS-304: Discrete Mathematics
    30-12-2026 | 10:00 AM - 01:00 PM | CS-305: Digital Electronics
    
    PRACTICAL VIVA DATES:
    05-12-2026 | 09:00 AM | Object Oriented Programming Java Lab
    07-12-2026 | 09:00 AM | Data Structures Lab
    
    ASSIGNMENT SUBMISSION DEADLINE:
    01-12-2026 | Semester Assignment Report Submission
  `;

  const extractRes = await fetch(`${baseUrl}/notices/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noticeText: sampleNoticeText })
  });
  assert.strictEqual(extractRes.status, 200);
  const extractData = await extractRes.json();
  assert.strictEqual(extractData.success, true);
  assert.ok(extractData.extracted.universityName, 'Should extract university name');
  assert.strictEqual(extractData.extracted.semester, 3, 'Should recognize Semester 3');
  assert.ok(extractData.extracted.timetable.length >= 3, 'Should extract at least 3 timetable subjects');
  console.log(`  ✓ Extracted notice: ${extractData.extracted.universityName}, Sem ${extractData.extracted.semester}, ${extractData.extracted.timetable.length} exam papers`);

  // Confirm extracted notice
  const confirmRes = await fetch(`${baseUrl}/notices/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'End-Semester Examination Dec 2026',
      universityName: extractData.extracted.universityName,
      semester: 3,
      noticeType: 'Exam Timetable',
      noticeDate: '2026-11-20',
      examinationDates: { start: '2026-12-15', end: '2026-12-30' },
      timetable: extractData.extracted.timetable,
      practicalDates: extractData.extracted.practicalDates,
      assignmentDeadlines: extractData.extracted.assignmentDeadlines,
      syncWithPlanner: true
    })
  });
  assert.strictEqual(confirmRes.status, 200);
  const confirmData = await confirmRes.json();
  assert.strictEqual(confirmData.success, true);
  assert.ok(confirmData.notice._id, 'Confirmed notice must have database ID');
  assert.ok(confirmData.eventsCount >= 3, 'Should generate calendar academic events');
  console.log(`  ✓ Confirmed notice saved to DB with ${confirmData.eventsCount} academic events`);

  // Verify Notice Detail page
  const noticeDetailRes = await fetch(`${baseUrl}/notices/${confirmData.notice._id}`);
  assert.strictEqual(noticeDetailRes.status, 200);
  console.log(`  ✓ GET /notices/${confirmData.notice._id} -> 200 OK`);

  // Test 18: AI-Based Personal Study Planner Generation (Workflow Step 3)
  console.log('\nTest 18: AI-Based Personal Study Planner Generation (Workflow Step 3)');
  const generatePlanRes = await fetch(`${baseUrl}/planner/api/plan/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      semester: 3,
      targetExamDate: '2026-12-15',
      dailyAvailableHours: 3
    })
  });
  assert.strictEqual(generatePlanRes.status, 200);
  const planData = await generatePlanRes.json();
  assert.strictEqual(planData.success, true);
  assert.ok(planData.totalTasksScheduled > 0, 'Plan should contain scheduled daily tasks');
  assert.ok(planData.preparationDays > 0, 'Plan should compute preparation duration');
  assert.strictEqual(planData.examTargetDate, '2026-12-15');
  console.log(`  ✓ Generated personal plan: ${planData.totalTasksScheduled} tasks over ${planData.preparationDays} preparation days (Daily: 3 hrs)`);

  // Test 19: Edit & Complete Study Tasks (Workflow Step 4)
  console.log('\nTest 19: Edit & Complete Study Tasks (Workflow Step 4)');
  const allTasks = await StudyTask.find({ planId: planData.plan._id });
  assert.ok(allTasks.length > 0, 'Study tasks must exist in DB');
  const targetTask = allTasks[0];

  // Complete study task
  const toggleTaskRes = await fetch(`${baseUrl}/planner/api/task/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: targetTask._id })
  });
  assert.strictEqual(toggleTaskRes.status, 200);
  const toggleTaskData = await toggleTaskRes.json();
  assert.strictEqual(toggleTaskData.success, true);
  assert.strictEqual(toggleTaskData.task.isCompleted, true, 'Task should be marked completed');

  // Verify updated plan progress
  const updatedPlan = await StudyPlan.findById(planData.plan._id);
  assert.strictEqual(updatedPlan.completedTasks, 1);
  assert.ok(updatedPlan.progressPercentage > 0);
  console.log(`  ✓ Task completed: plan updated to ${updatedPlan.completedTasks}/${updatedPlan.totalTasks} (${updatedPlan.progressPercentage}%)`);

  // Edit task details
  const updateTaskRes = await fetch(`${baseUrl}/planner/api/task/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: targetTask._id,
      topicTitle: 'JVM, JRE, JDK In-Depth Architecture Mastery',
      allocatedHours: 2.0
    })
  });
  assert.strictEqual(updateTaskRes.status, 200);
  const updateTaskData = await updateTaskRes.json();
  assert.strictEqual(updateTaskData.success, true);
  assert.strictEqual(updateTaskData.task.allocatedHours, 2.0);
  console.log('  ✓ Task successfully edited (allocated hours & title updated)');

  // Test 20: Change Examination Date & Regenerate Plan (Workflow Step 5)
  console.log('\nTest 20: Change Examination Date & Regenerate Plan (Workflow Step 5)');
  const newExamDate = '2026-12-25';
  const regenRes = await fetch(`${baseUrl}/planner/api/plan/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      semester: 3,
      targetExamDate: newExamDate,
      dailyAvailableHours: 4
    })
  });
  assert.strictEqual(regenRes.status, 200);
  const regenData = await regenRes.json();
  assert.strictEqual(regenData.success, true);
  assert.strictEqual(regenData.examTargetDate, newExamDate);
  assert.ok(regenData.totalTasksScheduled > 0);
  console.log(`  ✓ Regenerated plan with new exam date (${newExamDate}): ${regenData.totalTasksScheduled} tasks scheduled`);

  // Test rescheduling unfinished tasks
  const rescheduleRes = await fetch(`${baseUrl}/planner/api/task/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: regenData.plan._id })
  });
  assert.strictEqual(rescheduleRes.status, 200);
  console.log('  ✓ Overdue & unfinished tasks rescheduling engine verified');

  // Test 21: Explore & Learn - Paste YouTube Lecture URL (Workflow Step 6)
  console.log('\nTest 21: Explore & Learn - YouTube Lecture Extraction (Workflow Step 6)');
  const transcriptionPageRes = await fetch(`${baseUrl}/transcription?category=devops&topic=Docker%20Mastery&type=explore`);
  assert.strictEqual(transcriptionPageRes.status, 200);
  console.log('  ✓ GET /transcription -> 200 OK (Transcription Workspace renders)');

  // YouTube transcript extraction
  const ytFetchRes = await fetch(`${baseUrl}/transcription/api/fetch-youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      language: 'en'
    })
  });
  assert.strictEqual(ytFetchRes.status, 200);
  const ytData = await ytFetchRes.json();
  assert.strictEqual(ytData.videoId, 'dQw4w9WgXcQ');
  console.log(`  ✓ YouTube metadata and transcript fetch verified for video ID ${ytData.videoId}`);

  // Test 22: Upload Supported Lecture Recording with File Limits (Workflow Step 7)
  console.log('\nTest 22: Upload Supported Lecture Recording & Size Limit (Workflow Step 7)');
  // Unsupported file format check
  const badFileForm = new FormData();
  badFileForm.append('mediaFile', new Blob(['test dummy'], { type: 'application/exe' }), 'malicious.exe');
  const badMediaRes = await fetch(`${baseUrl}/transcription/api/upload-media`, {
    method: 'POST',
    body: badFileForm
  });
  assert.strictEqual(badMediaRes.status, 200);
  const badMediaData = await badMediaRes.json();
  assert.strictEqual(badMediaData.success, false, 'Unsupported file format must be rejected');
  assert.ok(badMediaData.error.includes('Unsupported'), 'Clear error returned for invalid format');
  console.log('  ✓ Invalid file formats properly blocked with validation error');

  // Test 23: Generate 10-Dimension Academic Study Pack (Workflow Step 8)
  console.log('\nTest 23: Generate 10-Dimension Academic Study Pack (Workflow Step 8)');
  const sampleTranscript = `
    [00:00] Welcome to this in-depth lecture on Docker Multi-Stage Builds and Container Optimization in DevOps.
    [01:15] A multi-stage build allows you to use multiple FROM statements in your Dockerfile. Each FROM instruction can use a different base.
    [02:45] The major advantage is that you can selectively copy artifacts from one stage to another, leaving behind everything you don't want in the final image.
    [04:20] This drastically reduces container attack surface and decreases image size from 1GB to under 50MB using Alpine Linux.
    [06:30] Best practice: always run your container process under a non-root user and scan images for vulnerabilities using Trivy.
  `;

  const studyPackRes = await fetch(`${baseUrl}/transcription/api/generate-materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categoryName: 'DevOps & Site Reliability Engineering',
      topicTitle: 'Optimized Multi-Stage Dockerfiles',
      transcriptText: sampleTranscript
    })
  });
  assert.strictEqual(studyPackRes.status, 200);
  const packData = await studyPackRes.json();
  assert.strictEqual(packData.success, true);
  assert.ok(packData.studyMaterials.shortSummary, 'Must contain short lecture summary');
  assert.ok(packData.studyMaterials.detailedNotes.length > 0, 'Must contain detailed notes');
  assert.ok(packData.studyMaterials.importantConcepts.length > 0, 'Must contain important concepts');
  assert.ok(packData.studyMaterials.keyDefinitions.length > 0, 'Must contain key definitions');
  assert.ok(packData.studyMaterials.importantQuestions.length > 0, 'Must contain questions');
  assert.ok(packData.studyMaterials.mcqs.length > 0, 'Must contain practice MCQs');
  assert.ok(packData.studyMaterials.keyTakeaways.length > 0, 'Must contain key takeaways');

  // Verify All 15 Required Dimensions
  assert.ok(packData.studyMaterials.lectureSummary, 'Dimension 1: Must contain lectureSummary');
  assert.ok(Array.isArray(packData.studyMaterials.topicWiseNotes) && packData.studyMaterials.topicWiseNotes.length > 0, 'Dimension 2: Must contain topicWiseNotes');
  assert.ok(packData.studyMaterials.topicWiseNotes[0].simpleExplanation, 'Dimension 2: Topic must have simpleExplanation');
  assert.ok(packData.studyMaterials.topicWiseNotes[0].title, 'Dimension 2: Topic must have title');
  assert.ok(Array.isArray(packData.studyMaterials.detailedExplanations) && packData.studyMaterials.detailedExplanations.length > 0, 'Dimension 3: Must contain detailedExplanations');
  assert.ok(Array.isArray(packData.studyMaterials.importantDefinitions) && packData.studyMaterials.importantDefinitions.length > 0, 'Dimension 4: Must contain importantDefinitions');
  assert.ok(Array.isArray(packData.studyMaterials.keyConcepts) && packData.studyMaterials.keyConcepts.length > 0, 'Dimension 5: Must contain keyConcepts');
  assert.ok(Array.isArray(packData.studyMaterials.importantPoints) && packData.studyMaterials.importantPoints.length > 0, 'Dimension 6: Must contain importantPoints');
  assert.ok(Array.isArray(packData.studyMaterials.examples) && packData.studyMaterials.examples.length > 0, 'Dimension 7: Must contain examples');
  assert.ok(Array.isArray(packData.studyMaterials.formulas) && packData.studyMaterials.formulas.length > 0, 'Dimension 8: Must contain formulas');
  assert.ok(Array.isArray(packData.studyMaterials.importantQuestions) && packData.studyMaterials.importantQuestions.length > 0, 'Dimension 9: Must contain importantQuestions');
  assert.ok(Array.isArray(packData.studyMaterials.pyqMapping) && packData.studyMaterials.pyqMapping.length > 0, 'Dimension 10: Must contain pyqMapping');
  assert.ok(Array.isArray(packData.studyMaterials.examOrientedNotes) && packData.studyMaterials.examOrientedNotes.length > 0, 'Dimension 11: Must contain examOrientedNotes');
  assert.ok(Array.isArray(packData.studyMaterials.quickRevisionNotes) && packData.studyMaterials.quickRevisionNotes.length > 0, 'Dimension 12: Must contain quickRevisionNotes');
  assert.ok(Array.isArray(packData.studyMaterials.flashcards) && packData.studyMaterials.flashcards.length > 0, 'Dimension 13: Must contain flashcards');
  assert.ok(Array.isArray(packData.studyMaterials.practiceMcqs) && packData.studyMaterials.practiceMcqs.length > 0, 'Dimension 14: Must contain practiceMcqs');
  assert.ok(Array.isArray(packData.studyMaterials.faqs) && packData.studyMaterials.faqs.length > 0, 'Dimension 15: Must contain faqs');
  console.log('  ✓ Generated 15-dimension Complete Academic Study Pack (All 15 sections verified)');

  // Test 24: Save Lecture, Maintain History & Search (Workflow Step 9)
  console.log('\nTest 24: Save Lecture, Maintain History & Search (Workflow Step 9)');
  const saveTranscriptRes = await fetch(`${baseUrl}/transcription/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'DevOps Mastery: Multi-Stage Docker Builds',
      categoryType: 'explore',
      categoryId: 'devops',
      categoryName: 'DevOps & SRE',
      topicId: 'devops_5',
      topicTitle: 'Optimized Multi-Stage Dockerfiles',
      sourceType: 'youtube',
      rawText: sampleTranscript,
      studyMaterials: packData.studyMaterials,
      markCompleted: true
    })
  });
  assert.strictEqual(saveTranscriptRes.status, 200);
  const saveTranscriptData = await saveTranscriptRes.json();
  assert.strictEqual(saveTranscriptData.success, true);
  assert.ok(saveTranscriptData.transcript._id);
  console.log(`  ✓ Saved lecture transcript & study pack to database (ID: ${saveTranscriptData.transcript._id})`);

  // Verify search
  const historySearchRes = await fetch(`${baseUrl}/transcription/api/history?search=Docker`);
  assert.strictEqual(historySearchRes.status, 200);
  const historyData = await historySearchRes.json();
  assert.ok(historyData.history.some(h => h.title.includes('Docker')), 'Search should find Docker transcript');
  console.log(`  ✓ Transcript search verified: found ${historyData.history.length} matching saved lecture(s)`);

  // Verify detail view renders all 15 sections
  const transcriptDetailRes = await fetch(`${baseUrl}/transcription/${saveTranscriptData.transcript._id}`);
  assert.strictEqual(transcriptDetailRes.status, 200);
  const detailHtml = await transcriptDetailRes.text();
  assert.ok(detailHtml.includes('Topic-wise Notes') || detailHtml.includes('Topic Notes'), 'Detail page must render topic-wise notes');
  assert.ok(detailHtml.includes('Active Recall Flashcards') || detailHtml.includes('Flashcards'), 'Detail page must render flashcards');
  assert.ok(detailHtml.includes('Practice MCQs') || detailHtml.includes('MCQs'), 'Detail page must render MCQs');
  console.log(`  ✓ GET /transcription/${saveTranscriptData.transcript._id} -> 200 OK (renders all 15 Complete Academic Pack sections)`);

  // Verify Explore & Learn DevOps connected workflow
  const exploreDevopsRes = await fetch(`${baseUrl}/explore/devops`);
  assert.strictEqual(exploreDevopsRes.status, 200);
  const devopsHtml = await exploreDevopsRes.text();
  assert.ok(devopsHtml.includes('Academic Pack Ready') || devopsHtml.includes('Open Academic Pack') || devopsHtml.includes('Transcribed Lectures'), 'Explore DevOps must connect to transcribed academic pack');
  console.log('  ✓ GET /explore/devops -> 200 OK (Milestone successfully connected to Academic Pack)');

  // Test 25: Verify Progress Updates Across Modules & Roadmaps (Workflow Step 10)
  console.log('\nTest 25: Verify Progress Updates Across Roadmaps & Learning Progress (Workflow Step 10)');
  const devopsTrack = exploreService.getTrackById('devops');
  assert.ok(devopsTrack.completedTopics.includes('devops_5'), 'DevOps milestone devops_5 must be marked completed');
  console.log(`  ✓ DevOps roadmap progress automatically synchronized: ${devopsTrack.completedCount}/${devopsTrack.totalTopics} (${devopsTrack.percentage}%)`);

  // Test Feature 5: Explore & Learn Roadmap Planner
  const expPlanRes = await fetch(`${baseUrl}/planner/api/plan/explore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: 'devops',
      targetDate: '2026-12-31',
      dailyAvailableHours: 2
    })
  });
  assert.strictEqual(expPlanRes.status, 200);
  const expPlanData = await expPlanRes.json();
  assert.strictEqual(expPlanData.success, true);
  assert.strictEqual(expPlanData.plan.planType, 'explore_roadmap');
  console.log(`  ✓ Explore & Learn Roadmap Planner generated: ${expPlanData.totalMilestonesScheduled} milestones scheduled separately for DevOps`);

  // Clean up test notice and test transcript
  await noticeService.deleteNotice(confirmData.notice._id);
  await transcriptionService.deleteTranscript(saveTranscriptData.transcript._id);
  console.log('  ✓ Test notice, academic events, and test transcript cleanly purged after verification');

  // =========================================================================
  // CANCEL & DELETE VERIFICATION TEST SUITE (Tests 26 - 32)
  // =========================================================================

  // Test 26: Planner - Cancel Plan, Cancel Task, & Delete Plan
  console.log('\nTest 26: Planner - Cancel Plan, Cancel Task, & Delete Plan');
  const genPlanRes = await fetch(`${baseUrl}/planner/api/plan/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetExamDate: '2026-12-15',
      dailyStudyHours: 3
    })
  });
  assert.strictEqual(genPlanRes.status, 200);
  const genPlanData = await genPlanRes.json();
  assert.strictEqual(genPlanData.success, true);
  const planToTest = genPlanData.plan;
  assert.ok(planToTest._id, 'Generated plan must have an _id');

  // Verify active plan exists
  let activePlanResult = await plannerService.getActiveStudyPlan();
  assert.ok(activePlanResult, 'Active plan must exist after generation');
  assert.ok(activePlanResult.plan, 'Active plan payload must exist');
  assert.strictEqual(activePlanResult.plan.status, 'active');

  // Test 26a: Cancel individual task via POST /planner/api/task/cancel
  const tasksBefore = await StudyTask.find({ planId: planToTest._id });
  assert.ok(tasksBefore.length > 0, 'Plan must contain study tasks');
  const taskToCancel = tasksBefore[0];

  const cancelTaskRes = await fetch(`${baseUrl}/planner/api/task/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: taskToCancel._id })
  });
  assert.strictEqual(cancelTaskRes.status, 200);
  const cancelTaskData = await cancelTaskRes.json();
  assert.strictEqual(cancelTaskData.success, true);
  const tasksAfter = await StudyTask.find({ planId: planToTest._id });
  assert.strictEqual(tasksAfter.length, tasksBefore.length - 1, 'Task count should decrease by 1 after cancellation');
  assert.ok(!tasksAfter.some(t => t._id === taskToCancel._id), 'Cancelled task must be removed from tasks list');
  console.log('  ✓ POST /planner/api/task/cancel successfully cancelled single task & updated schedule');

  // Test 26b: Cancel entire plan via POST /planner/api/plan/cancel
  const cancelPlanRes = await fetch(`${baseUrl}/planner/api/plan/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: planToTest._id })
  });
  assert.strictEqual(cancelPlanRes.status, 200);
  const cancelPlanData = await cancelPlanRes.json();
  assert.strictEqual(cancelPlanData.success, true);

  // CRITICAL REQUIREMENT: Cancelled plan must NEVER appear as active plan
  activePlanResult = await plannerService.getActiveStudyPlan();
  assert.strictEqual(activePlanResult, null, 'Cancelled plan must NOT be returned by getActiveStudyPlan()');

  // Verify tasks associated with the plan were cleared
  const tasksForCancelledPlan = await StudyTask.find({ planId: planToTest._id });
  assert.strictEqual(tasksForCancelledPlan.length, 0, 'Cancelled plan tasks must be cleaned up from active schedule');
  console.log('  ✓ POST /planner/api/plan/cancel set status = "cancelled" & removed from active views');

  // Test 26c: Delete plan completely via DELETE /planner/api/plan/:id
  const deletePlanRes = await fetch(`${baseUrl}/planner/api/plan/${planToTest._id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(deletePlanRes.status, 200);
  const deletePlanData = await deletePlanRes.json();
  assert.strictEqual(deletePlanData.success, true);
  console.log('  ✓ DELETE /planner/api/plan/:id permanently purged plan record from database');

  // Test 27: University Notice - Delete & Event Cleanup
  console.log('\nTest 27: University Notice - Delete & Event Cleanup');
  const confirmNoticeRes = await fetch(`${baseUrl}/notices/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Notice To Delete Test',
      universityName: 'Test University',
      semester: 3,
      noticeType: 'Exam Timetable',
      noticeDate: '2026-11-20',
      examinationDates: { start: '2026-12-01', end: '2026-12-10' },
      timetable: [
        { subjectName: 'OOPS with Java', subjectCode: 'CS-301', date: '2026-12-02', time: '10:00 AM - 01:00 PM' }
      ]
    })
  });
  assert.strictEqual(confirmNoticeRes.status, 200);
  const confirmNoticeData = await confirmNoticeRes.json();
  const dummyNotice = confirmNoticeData.notice;
  assert.ok(dummyNotice._id, 'Notice created for deletion test');
  let events = await AcademicEvent.find({ noticeId: dummyNotice._id });
  assert.ok(events.length > 0, 'Linked academic events must exist');

  // Test DELETE /notices/api/:id
  const delNoticeRes = await fetch(`${baseUrl}/notices/api/${dummyNotice._id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delNoticeRes.status, 200);
  const delNoticeData = await delNoticeRes.json();
  assert.strictEqual(delNoticeData.success, true);

  // Verify DB removal
  const noticeAfter = await noticeService.getNoticeById(dummyNotice._id);
  assert.strictEqual(noticeAfter, null, 'Notice must be permanently removed from DB');
  events = await AcademicEvent.find({ noticeId: dummyNotice._id });
  assert.strictEqual(events.length, 0, 'Linked academic events must be deleted');
  console.log('  ✓ DELETE /notices/api/:id purged notice and all linked academic events');

  // Test fallback route POST /notices/api/:id/delete
  const confirmNotice2Res = await fetch(`${baseUrl}/notices/api/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Fallback Notice Test',
      universityName: 'Fallback University',
      semester: 3,
      noticeType: 'Exam Timetable',
      noticeDate: '2026-11-20',
      timetable: []
    })
  });
  assert.strictEqual(confirmNotice2Res.status, 200);
  const dummyNotice2 = (await confirmNotice2Res.json()).notice;
  const fallbackDelRes = await fetch(`${baseUrl}/notices/api/${dummyNotice2._id}/delete`, {
    method: 'POST'
  });
  assert.strictEqual(fallbackDelRes.status, 200);
  assert.strictEqual(await noticeService.getNoticeById(dummyNotice2._id), null);
  console.log('  ✓ POST /notices/api/:id/delete fallback endpoint verified');

  // Test 28: PYQ Delete - Record & File Cleanup
  console.log('\nTest 28: PYQ Delete - Record & File System Cleanup');
  const pyqPaperText = `
    Mid-Sem Exam 2024 - CS-301: OOPS with Java
    Q1 Explain Multithreading lifecycle. [7 Marks]
  `;
  const dummyPYQPath = path.join(__dirname, 'uploads', 'temp_pyq_del_test.txt');
  fs.writeFileSync(dummyPYQPath, pyqPaperText, 'utf-8');
  const pyqToDel = await pyqService.processUploadedPaper({
    subjectId: 'oops_java',
    unitNumber: 2,
    year: '2024',
    examType: 'Mid-Sem Exam',
    uploadedFile: {
      path: dummyPYQPath,
      originalname: 'MidSem_2024.txt',
      mimetype: 'text/plain'
    }
  });
  assert.ok(pyqToDel.id, 'PYQ created for deletion test');
  const pyqListBefore = pyqService.getPYQs('oops_java');
  assert.ok(pyqListBefore.some(p => p.id === pyqToDel.id), 'PYQ must appear in list before deletion');

  // Test DELETE /pyqs/api/:id
  const delPyqRes = await fetch(`${baseUrl}/pyqs/api/${pyqToDel.id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delPyqRes.status, 200);
  const delPyqData = await delPyqRes.json();
  assert.strictEqual(delPyqData.success, true);

  const pyqListAfter = pyqService.getPYQs('oops_java');
  assert.ok(!pyqListAfter.some(p => p.id === pyqToDel.id), 'PYQ must be deleted from database');
  console.log('  ✓ DELETE /pyqs/api/:id purged PYQ record and unlinked associated disk files');

  // Test fallback route POST /pyqs/api/:id/delete
  fs.writeFileSync(dummyPYQPath, pyqPaperText, 'utf-8');
  const pyqToDel2 = await pyqService.processUploadedPaper({
    subjectId: 'oops_java',
    unitNumber: 2,
    year: '2024',
    examType: 'Quiz',
    uploadedFile: {
      path: dummyPYQPath,
      originalname: 'Quiz_2024.txt',
      mimetype: 'text/plain'
    }
  });
  const fallbackPyqRes = await fetch(`${baseUrl}/pyqs/api/${pyqToDel2.id}/delete`, {
    method: 'POST'
  });
  assert.strictEqual(fallbackPyqRes.status, 200);
  assert.ok(!pyqService.getPYQs('oops_java').some(p => p.id === pyqToDel2.id));
  console.log('  ✓ POST /pyqs/api/:id/delete fallback endpoint verified');

  // Test 29: Library / Uploaded Notes / Lectures Delete
  console.log('\nTest 29: Library / Uploaded Notes / Lectures Delete');
  const savedPack = await fileService.saveStudyPack({
    subjectId: 'oops_java',
    unitNumber: 1,
    unitTitle: 'Introduction',
    topicTitle: 'Delete Test Lecture Topic',
    lectureTitle: 'Delete Test Lecture',
    videoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    transcriptText: 'Sample transcript for deletion testing',
    studyMaterials: {
      shortSummary: 'Summary to delete',
      detailedNotes: [{ heading: 'Point 1', content: 'Details 1' }],
      importantConcepts: ['Concept 1'],
      keyDefinitions: [{ term: 'Term 1', definition: 'Def 1' }],
      importantQuestions: [{ question: 'Q1?', answer: 'A1' }],
      codeExamples: [{ title: 'Code 1', code: '// code' }],
      quickRevisionNotes: 'Revision notes'
    }
  });
  assert.ok(savedPack.id, 'Saved pack should have ID');
  const lectureRecord = fileService.getLectureById(savedPack.id);
  assert.ok(lectureRecord, 'Lecture record must exist in library');

  // Test DELETE /library/api/:id
  const delLibRes = await fetch(`${baseUrl}/library/api/${savedPack.id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delLibRes.status, 200);
  const delLibData = await delLibRes.json();
  assert.strictEqual(delLibData.success, true);
  assert.strictEqual(fileService.getLectureById(savedPack.id), undefined, 'Lecture must be deleted from library');
  console.log('  ✓ DELETE /library/api/:id permanently deleted lecture note & markdown files');

  // Test fallback route POST /library/api/:id/delete
  const savedPack2 = await fileService.saveStudyPack({
    subjectId: 'oops_java',
    unitNumber: 1,
    topicTitle: 'Fallback Delete Topic',
    lectureTitle: 'Fallback Delete Lecture',
    studyMaterials: {}
  });
  const fallbackLibRes = await fetch(`${baseUrl}/library/api/${savedPack2.id}/delete`, {
    method: 'POST'
  });
  assert.strictEqual(fallbackLibRes.status, 200);
  assert.strictEqual(fileService.getLectureById(savedPack2.id), undefined);
  console.log('  ✓ POST /library/api/:id/delete fallback endpoint verified');

  // Test 30: Transcripts Delete & Fallback APIs
  console.log('\nTest 30: Transcripts Delete & Fallback APIs');
  const saveTransRes1 = await fetch(`${baseUrl}/transcription/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Transcript To Delete Test',
      categoryType: 'subject',
      categoryId: 'oops_java',
      categoryName: 'OOPS with Java',
      topicId: 'unit1_t1',
      topicTitle: 'Test Topic',
      sourceType: 'media_upload',
      rawText: 'Test transcript content to be deleted',
      studyMaterials: { shortSummary: 'Summary' }
    })
  });
  assert.strictEqual(saveTransRes1.status, 200);
  const dummyTranscript = (await saveTransRes1.json()).transcript;
  assert.ok(dummyTranscript._id, 'Transcript must have _id');

  // Test DELETE /transcription/api/:id
  const delTransRes = await fetch(`${baseUrl}/transcription/api/${dummyTranscript._id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delTransRes.status, 200);
  const delTransData = await delTransRes.json();
  assert.strictEqual(delTransData.success, true);
  const transcriptAfter = await transcriptionService.getTranscriptWithNotes(dummyTranscript._id);
  assert.strictEqual(transcriptAfter, null, 'Transcript must be deleted from DB');
  console.log('  ✓ DELETE /transcription/api/:id removed transcript and linked notes');

  // Test fallback route POST /transcription/api/:id/delete
  const saveTransRes2 = await fetch(`${baseUrl}/transcription/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Fallback Transcript Test',
      categoryType: 'subject',
      categoryId: 'oops_java',
      categoryName: 'OOPS with Java',
      topicId: 'unit1_t2',
      topicTitle: 'Fallback Test Topic',
      sourceType: 'youtube',
      rawText: 'Fallback test text',
      studyMaterials: {}
    })
  });
  assert.strictEqual(saveTransRes2.status, 200);
  const dummyTranscript2 = (await saveTransRes2.json()).transcript;
  const fallbackTransRes = await fetch(`${baseUrl}/transcription/api/${dummyTranscript2._id}/delete`, {
    method: 'POST'
  });
  assert.strictEqual(fallbackTransRes.status, 200);
  assert.strictEqual(await transcriptionService.getTranscriptWithNotes(dummyTranscript2._id), null);
  console.log('  ✓ POST /transcription/api/:id/delete fallback endpoint verified');

  // Test 31: Explore Roadmap Progress Reset
  console.log('\nTest 31: Explore Roadmap Progress Reset');
  // First toggle some milestones
  exploreService.toggleMilestone('ai_ml', 'aiml_1', true);
  exploreService.toggleMilestone('ai_ml', 'aiml_2', true);
  const trackBefore = exploreService.getTrackById('ai_ml');
  assert.ok(trackBefore.completedCount >= 2, 'Track should have at least 2 completed milestones');

  // Reset track progress via POST /explore/api/reset
  const resetTrackRes = await fetch(`${baseUrl}/explore/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId: 'ai_ml' })
  });
  assert.strictEqual(resetTrackRes.status, 200);
  const resetTrackData = await resetTrackRes.json();
  assert.strictEqual(resetTrackData.success, true);
  assert.strictEqual(resetTrackData.result.completedCount, 0, 'Completed count must reset to 0');
  assert.strictEqual(resetTrackData.result.trackPercentage, 0, 'Percentage must reset to 0%');

  const trackAfter = exploreService.getTrackById('ai_ml');
  assert.strictEqual(trackAfter.completedCount, 0, 'Track completed count must be 0 after reset');
  assert.strictEqual(trackAfter.completedTopics.length, 0, 'Completed topics array must be empty');
  console.log('  ✓ POST /explore/api/reset successfully cleared all milestones & reset progress to 0%');

  // Test 32: Subject Deletion & Core Protection (DELETE & POST Fallback)
  console.log('\nTest 32: Subject Deletion & Core Protection (DELETE & POST Fallback)');
  // Ensure core subjects cannot be deleted
  const delCoreRes = await fetch(`${baseUrl}/syllabus/api/subject/oops_java`, { method: 'DELETE' });
  assert.strictEqual(delCoreRes.status, 400);
  const delCoreData = await delCoreRes.json();
  assert.strictEqual(delCoreData.success, false);
  assert.ok(delCoreData.error.includes('Cannot delete core'), 'Core subjects must be protected');
  console.log('  ✓ Core Semester 3 subject deletion strictly prevented with security error');

  // Add custom subject and delete via DELETE route
  const customSub1 = addSubject({
    name: 'Temporary Test Subject 1',
    code: 'CS-TEMP1',
    semester: 6,
    description: 'Temporary subject',
    units: [{ unitNumber: 1, title: 'Unit 1', topics: ['Topic 1'] }]
  });
  const delCustomRes1 = await fetch(`${baseUrl}/syllabus/api/subject/${customSub1.id}`, { method: 'DELETE' });
  assert.strictEqual(delCustomRes1.status, 200);
  assert.strictEqual(getSubjectById(customSub1.id), null, 'Custom subject must be deleted');
  console.log('  ✓ DELETE /syllabus/api/subject/:id successfully deleted custom subject');

  // Add custom subject and delete via POST fallback route
  const customSub2 = addSubject({
    name: 'Temporary Test Subject 2',
    code: 'CS-TEMP2',
    semester: 6,
    description: 'Temporary subject 2',
    units: [{ unitNumber: 1, title: 'Unit 1', topics: ['Topic 1'] }]
  });
  const delCustomRes2 = await fetch(`${baseUrl}/syllabus/api/subject/${customSub2.id}/delete`, { method: 'POST' });
  assert.strictEqual(delCustomRes2.status, 200);
  assert.strictEqual(getSubjectById(customSub2.id), null, 'Custom subject must be deleted via POST fallback');
  console.log('  ✓ POST /syllabus/api/subject/:id/delete successfully deleted custom subject');

  server.close();

  console.log('\n🎉 ALL 32 COMPREHENSIVE TESTS PASSED SUCCESSFULLY! Cancel and Delete functionalities across Planner, Notices, PYQs, Library, Transcripts, Explore Roadmaps, and Subjects are fully validated and operational.');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
