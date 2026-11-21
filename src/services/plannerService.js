const fs = require('fs');
const path = require('path');
const { getSubjectById, getAllSubjects, getSubjectsBySemester, ROOT_DIR } = require('../config/subjects');
const { StudyPlan, StudyTask, AcademicEvent, UniversityNotice, LectureTranscript } = require('../models');
const pyqService = require('./pyqService');
const progressService = require('./progressService');
const practiceService = require('./practiceService');
const exploreService = require('./exploreService');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const PLANNER_FILE = path.join(DATA_DIR, 'planner.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadPlannerData() {
  if (!fs.existsSync(PLANNER_FILE)) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const examDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const initial = {
      examCountdown: [
        {
          id: 'exam_endsem',
          examName: 'University End-Semester Examination',
          subjectId: 'all',
          date: examDate,
          targetScore: '85%+'
        }
      ],
      dailyGoals: [
        {
          id: 'goal_1',
          text: 'Complete OOPS Unit 3: Dynamic Method Dispatch & Interfaces',
          subjectId: 'oops_java',
          date: todayStr,
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'goal_2',
          text: 'Solve 2 LeetCode problems on Fast & Slow Pointers (DSA)',
          subjectId: 'dsa_java',
          date: todayStr,
          completed: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'goal_3',
          text: 'Review Banker’s Algorithm safety numericals in Operating Systems',
          subjectId: 'operating_systems',
          date: todayStr,
          completed: false,
          createdAt: new Date().toISOString()
        }
      ],
      weeklyTimetable: {
        monday: [
          { id: 'tt_1', time: '09:00 - 11:00 AM', subjectId: 'oops_java', topic: 'Core OOP & Memory Management', type: 'Lecture / Notes' },
          { id: 'tt_2', time: '02:00 - 04:00 PM', subjectId: 'dsa_java', topic: 'Trees & Graph Traversals', type: 'Coding Practice' }
        ],
        tuesday: [
          { id: 'tt_3', time: '09:00 - 11:00 AM', subjectId: 'operating_systems', topic: 'Process Synchronization & Semaphores', type: 'Theory + Numericals' },
          { id: 'tt_4', time: '03:00 - 05:00 PM', subjectId: 'discrete_mathematics', topic: 'Propositional Logic & Proofs', type: 'Problem Solving' }
        ],
        wednesday: [
          { id: 'tt_5', time: '10:00 - 12:00 PM', subjectId: 'digital_electronics', topic: 'K-Map Minimization & Decoders', type: 'Circuits & Tables' },
          { id: 'tt_6', time: '04:00 - 06:00 PM', subjectId: 'dsa_java', topic: 'Dynamic Programming Patterns', type: 'Coding Practice' }
        ],
        thursday: [
          { id: 'tt_7', time: '09:00 - 11:00 AM', subjectId: 'oops_java', topic: 'Multithreading & Collections', type: 'Lab Implementation' },
          { id: 'tt_8', time: '02:00 - 04:00 PM', subjectId: 'operating_systems', topic: 'Deadlocks & Virtual Memory Paging', type: 'Exam PYQs' }
        ],
        friday: [
          { id: 'tt_9', time: '10:00 - 12:00 PM', subjectId: 'discrete_mathematics', topic: 'Graph Theory & Combinatorics', type: 'Formula Practice' },
          { id: 'tt_10', time: '03:00 - 05:00 PM', subjectId: 'digital_electronics', topic: 'Flip-Flops & Counters', type: 'Circuits & FSM' }
        ],
        saturday: [
          { id: 'tt_11', time: '10:00 - 01:00 PM', subjectId: 'all', topic: 'Multi-Subject PYQ Paper Solving', type: 'Mock Exam' },
          { id: 'tt_12', time: '04:00 - 06:00 PM', subjectId: 'all', topic: 'Weekly Spaced Repetition Revision', type: 'Revision' }
        ],
        sunday: [
          { id: 'tt_13', time: '11:00 - 01:00 PM', subjectId: 'all', topic: 'Explore & Learn: AI/ML Roadmap Projects', type: 'Career Track' }
        ]
      },
      revisionSchedule: [
        {
          id: 'rev_1',
          topicName: 'Dynamic Method Dispatch',
          subjectId: 'oops_java',
          unitNumber: 3,
          cycle1Date: todayStr,
          cycle1Done: true,
          cycle2Date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          cycle2Done: false
        },
        {
          id: 'rev_2',
          topicName: 'Banker’s Algorithm Deadlock Avoidance',
          subjectId: 'operating_systems',
          unitNumber: 5,
          cycle1Date: todayStr,
          cycle1Done: false,
          cycle2Date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          cycle2Done: false
        }
      ],
      studyStreak: {
        currentStreak: 5,
        totalStudyHours: 42,
        lastLoggedDate: todayStr
      }
    };
    fs.writeFileSync(PLANNER_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(PLANNER_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function savePlannerData(data) {
  fs.writeFileSync(PLANNER_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getPlannerData() {
  const data = loadPlannerData();

  // Compute countdown in days
  const countdowns = (data.examCountdown || []).map(item => {
    const target = new Date(item.date);
    const diffMs = target.getTime() - new Date().getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const subject = item.subjectId !== 'all' ? getSubjectById(item.subjectId) : null;

    return {
      ...item,
      daysLeft,
      subjectName: subject ? subject.name : 'All Curriculum Subjects'
    };
  });

  // Calculate daily goals progress
  const goals = data.dailyGoals || [];
  const completedGoals = goals.filter(g => g.completed).length;
  const goalPercentage = goals.length > 0 ? Math.round((completedGoals / goals.length) * 100) : 0;

  return {
    ...data,
    examCountdown: countdowns,
    goalStats: {
      total: goals.length,
      completed: completedGoals,
      percentage: goalPercentage
    }
  };
}

function addDailyGoal({ text, subjectId }) {
  const data = loadPlannerData();
  if (!data.dailyGoals) data.dailyGoals = [];

  const newGoal = {
    id: `goal_${Date.now()}`,
    text: text.trim(),
    subjectId: subjectId || 'general',
    date: new Date().toISOString().slice(0, 10),
    completed: false,
    createdAt: new Date().toISOString()
  };

  data.dailyGoals.push(newGoal);
  savePlannerData(data);
  return newGoal;
}

function toggleDailyGoal(goalId) {
  const data = loadPlannerData();
  const goal = (data.dailyGoals || []).find(g => g.id === goalId);
  if (!goal) throw new Error('Goal not found');

  goal.completed = !goal.completed;
  savePlannerData(data);
  return goal;
}

function deleteDailyGoal(goalId) {
  const data = loadPlannerData();
  data.dailyGoals = (data.dailyGoals || []).filter(g => g.id !== goalId);
  savePlannerData(data);
  return true;
}

function addTimetableSlot(day, { time, subjectId, topic, type }) {
  const data = loadPlannerData();
  if (!data.weeklyTimetable) data.weeklyTimetable = {};
  if (!data.weeklyTimetable[day]) data.weeklyTimetable[day] = [];

  const newSlot = {
    id: `tt_${Date.now()}`,
    time: time.trim(),
    subjectId,
    topic: topic.trim(),
    type: type || 'Study Session'
  };

  data.weeklyTimetable[day].push(newSlot);
  savePlannerData(data);
  return newSlot;
}

function deleteTimetableSlot(day, slotId) {
  const data = loadPlannerData();
  if (data.weeklyTimetable && data.weeklyTimetable[day]) {
    data.weeklyTimetable[day] = data.weeklyTimetable[day].filter(s => s.id !== slotId);
    savePlannerData(data);
  }
  return true;
}

function scheduleRevision({ topicName, subjectId, unitNumber }) {
  const data = loadPlannerData();
  if (!data.revisionSchedule) data.revisionSchedule = [];

  const today = Date.now();
  const cycle1 = new Date(today + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cycle2 = new Date(today + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const item = {
    id: `rev_${Date.now()}`,
    topicName: topicName.trim(),
    subjectId,
    unitNumber: parseInt(unitNumber, 10) || 1,
    cycle1Date: cycle1,
    cycle1Done: false,
    cycle2Date: cycle2,
    cycle2Done: false
  };

  data.revisionSchedule.push(item);
  savePlannerData(data);
  return item;
}

function toggleRevisionCycle(revisionId, cycleNumber) {
  const data = loadPlannerData();
  const item = (data.revisionSchedule || []).find(r => r.id === revisionId);
  if (!item) throw new Error('Revision item not found');

  if (cycleNumber === 1) {
    item.cycle1Done = !item.cycle1Done;
  } else if (cycleNumber === 2) {
    item.cycle2Done = !item.cycle2Done;
  }

  savePlannerData(data);
  return item;
}

function setExamCountdown({ examName, subjectId, date, targetScore }) {
  const data = loadPlannerData();
  if (!data.examCountdown) data.examCountdown = [];

  const existing = data.examCountdown[0];
  if (existing) {
    existing.examName = examName || existing.examName;
    existing.subjectId = subjectId || existing.subjectId;
    existing.date = date || existing.date;
    existing.targetScore = targetScore || existing.targetScore;
  } else {
    data.examCountdown.push({
      id: `exam_${Date.now()}`,
      examName: examName || 'Semester Examination',
      subjectId: subjectId || 'all',
      date: date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      targetScore: targetScore || '80%+'
    });
  }

  savePlannerData(data);
  return data.examCountdown[0];
}

// =========================================================================
// ADVANCED AI PERSONAL STUDY PLANNER & UNIVERSITY NOTICE INTEGRATION
// =========================================================================

/**
 * Generates an end-to-end personalized study plan using:
 * - Confirmed university notices & exam dates
 * - Existing semester syllabus
 * - Subject-wise units and topics
 * - PYQ frequency and high-yield topics
 * - Student completed vs pending topics
 * - Weak topic diagnostics
 * - Lecture transcripts and notes
 * - Daily available study hours
 */
async function generatePersonalStudyPlan({
  semester = 3,
  targetExamDate = null,
  dailyAvailableHours = 3,
  studentId = 'default_student',
  regenerate = false
}) {
  const semNum = parseInt(semester, 10) || 3;
  const hoursPerDay = parseFloat(dailyAvailableHours) || 3;

  // 1. Check for confirmed university notices & exam dates
  let examTargetDate = targetExamDate;
  let linkedNoticeId = null;
  let examTitle = `Semester ${semNum} University Examination`;
  let timetableEvents = [];

  const examEvents = await AcademicEvent.find({ studentId, eventType: 'Examination', semester: semNum });
  if (examEvents.length > 0) {
    timetableEvents = examEvents.sort((a, b) => a.date.localeCompare(b.date));
    if (!examTargetDate) {
      examTargetDate = timetableEvents[0].date;
      linkedNoticeId = timetableEvents[0].noticeId;
      examTitle = timetableEvents[0].title || examTitle;
    }
  }

  // Fallback to 30 days if no notice found
  if (!examTargetDate) {
    examTargetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  // 2. Fetch syllabus subjects for this semester
  const semesterSubjects = getSubjectsBySemester(semNum);
  if (semesterSubjects.length === 0) {
    throw new Error(`No curriculum subjects found for Semester ${semNum}. Please upload syllabus or configure subjects.`);
  }

  // 3. Load completed topics and progress
  const progressData = progressService.loadProgress();

  // 4. Load weak topics from practice service
  const weakTopicAnalysis = practiceService.getWeakTopicAnalysis();
  const weakTopicNames = new Set(weakTopicAnalysis.map(w => (w.topicName || '').toLowerCase()));

  // 5. Load transcripts available
  const existingTranscripts = await LectureTranscript.find({ studentId });
  const transcriptTopicMap = new Map();
  existingTranscripts.forEach(t => {
    transcriptTopicMap.set((t.topicTitle || '').toLowerCase(), t._id);
  });

  // 6. Gather all pending and priority topics with PYQ rankings
  const candidateTopics = [];
  for (const sub of semesterSubjects) {
    const subProgress = progressData[sub.id] || { completedTopics: [] };
    const completedSet = new Set((subProgress.completedTopics || []).map(t => t.toLowerCase()));

    // Get PYQ analytics
    let pyqImportanceMap = new Map();
    try {
      const analytics = pyqService.getSubjectPYQAnalytics(sub.id);
      if (analytics && analytics.importanceRanking) {
        analytics.importanceRanking.forEach(rank => {
          pyqImportanceMap.set(rank.topic.toLowerCase(), rank.badge || 'High');
        });
      }
    } catch (e) {}

    // Check individual exam date from timetable if exists
    const matchingExam = timetableEvents.find(e =>
      (e.subjectCode && sub.code && e.subjectCode.toLowerCase() === sub.code.toLowerCase()) ||
      (e.subjectName && sub.name && e.subjectName.toLowerCase().includes(sub.name.toLowerCase()))
    );

    for (const unit of sub.units) {
      for (const topic of unit.topics || []) {
        const isDone = completedSet.has(topic.toLowerCase());
        const isWeak = weakTopicNames.has(topic.toLowerCase());
        const pyqBadge = pyqImportanceMap.get(topic.toLowerCase()) || 'Normal';
        const hasTranscript = transcriptTopicMap.has(topic.toLowerCase());

        candidateTopics.push({
          subjectId: sub.id,
          subjectName: sub.name,
          unitNumber: unit.number,
          unitTitle: unit.title,
          topicTitle: topic,
          isCompleted: isDone,
          isWeak,
          pyqImportance: pyqBadge,
          hasTranscript,
          transcriptId: transcriptTopicMap.get(topic.toLowerCase()) || null,
          examDate: matchingExam ? matchingExam.date : examTargetDate
        });
      }
    }
  }

  // 7. Calculate preparation duration
  const today = new Date();
  const targetDateObj = new Date(examTargetDate);
  const diffDays = Math.max(3, Math.ceil((targetDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // Separate pending vs weak vs completed
  const pendingTopics = candidateTopics.filter(t => !t.isCompleted);
  // Prioritize: Weak topics + High PYQ first, then normal pending
  pendingTopics.sort((a, b) => {
    if (a.isWeak && !b.isWeak) return -1;
    if (!a.isWeak && b.isWeak) return 1;
    if (a.pyqImportance.includes('High') && !b.pyqImportance.includes('High')) return -1;
    if (!a.pyqImportance.includes('High') && b.pyqImportance.includes('High')) return 1;
    return 0;
  });

  // Calculate task allocation: do not overload, max 2-3 topics per day based on dailyAvailableHours
  const topicsPerDay = Math.min(3, Math.max(1, Math.floor(hoursPerDay / 1.2)));

  // 8. Create or update StudyPlan
  let plan = await StudyPlan.findOne({
    studentId,
    planType: 'university_exam',
    targetId: String(semNum)
  });

  if (plan && regenerate) {
    await StudyTask.deleteMany({ planId: plan._id });
    plan.status = 'active';
  } else if (!plan) {
    plan = new StudyPlan({
      studentId,
      title: `Semester ${semNum} Exam Preparation Plan`,
      planType: 'university_exam',
      targetId: String(semNum),
      targetName: `Semester ${semNum} (${semesterSubjects.length} Subjects)`,
      startDate: today.toISOString().slice(0, 10),
      targetDate: examTargetDate,
      dailyAvailableHours: hoursPerDay,
      noticeId: linkedNoticeId,
      status: 'active'
    });
    await plan.save();
  } else {
    plan.status = 'active';
  }

  // 9. Generate Daily Study Tasks across the calendar
  const studyTasks = [];
  let topicIndex = 0;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let dayOffset = 0; dayOffset < diffDays; dayOffset++) {
    const curDate = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = curDate.toISOString().slice(0, 10);
    const dayOfWeek = dayNames[curDate.getDay()];

    // Reserve Saturday for Spaced Revision & Sunday for Practice Test
    if (curDate.getDay() === 6) {
      // Saturday Spaced Revision
      studyTasks.push(new StudyTask({
        studentId,
        planId: plan._id,
        date: dateStr,
        dayOfWeek,
        subjectId: 'all',
        subjectName: 'All Semester Subjects',
        topicTitle: `Weekly Spaced Repetition Revision (Week ${Math.floor(dayOffset / 7) + 1})`,
        taskType: 'revision',
        allocatedHours: Math.min(hoursPerDay, 2.5),
        pyqImportance: 'High',
        isCompleted: false
      }));
      continue;
    }

    if (curDate.getDay() === 0) {
      // Sunday Practice Test & Weak Topic Drill
      studyTasks.push(new StudyTask({
        studentId,
        planId: plan._id,
        date: dateStr,
        dayOfWeek,
        subjectId: semesterSubjects[dayOffset % semesterSubjects.length].id,
        subjectName: semesterSubjects[dayOffset % semesterSubjects.length].name,
        topicTitle: 'PYQ Mock Examination & Weak-Topic Drill Session',
        taskType: 'practice_test',
        allocatedHours: Math.min(hoursPerDay, 2.5),
        pyqImportance: 'High',
        isCompleted: false
      }));
      continue;
    }

    // Check if within 2 days of a specific subject's exam: Dedicated Final Revision Sprint!
    const imminentExam = timetableEvents.find(e => {
      const eDate = new Date(e.date);
      const diffExamDays = Math.ceil((eDate.getTime() - curDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffExamDays >= 0 && diffExamDays <= 2;
    });

    if (imminentExam) {
      studyTasks.push(new StudyTask({
        studentId,
        planId: plan._id,
        date: dateStr,
        dayOfWeek,
        subjectId: imminentExam.subjectCode || 'exam_sprint',
        subjectName: imminentExam.subjectName || 'Exam Target',
        topicTitle: `Final Pre-Exam Sprint: ${imminentExam.title} (Formulas, Diagrams & PYQs)`,
        taskType: 'mock_exam',
        allocatedHours: hoursPerDay,
        pyqImportance: 'High',
        isCompleted: false
      }));
      continue;
    }

    // Schedule 1-2 pending syllabus topics
    for (let slot = 0; slot < topicsPerDay; slot++) {
      if (topicIndex < pendingTopics.length) {
        const item = pendingTopics[topicIndex++];
        studyTasks.push(new StudyTask({
          studentId,
          planId: plan._id,
          date: dateStr,
          dayOfWeek,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          unitNumber: item.unitNumber,
          unitTitle: item.unitTitle,
          topicTitle: item.topicTitle,
          taskType: item.isWeak ? 'weak_topic_drill' : 'syllabus_topic',
          allocatedHours: Number((hoursPerDay / topicsPerDay).toFixed(1)),
          pyqImportance: item.pyqImportance,
          notesTranscriptId: item.transcriptId,
          isCompleted: false
        }));
      } else {
        // All pending covered: schedule extra revision or practice
        const randomSub = semesterSubjects[(dayOffset + slot) % semesterSubjects.length];
        studyTasks.push(new StudyTask({
          studentId,
          planId: plan._id,
          date: dateStr,
          dayOfWeek,
          subjectId: randomSub.id,
          subjectName: randomSub.name,
          topicTitle: `Deep-Dive Mastery & Code Practice (${randomSub.name})`,
          taskType: 'revision',
          allocatedHours: Number((hoursPerDay / topicsPerDay).toFixed(1)),
          pyqImportance: 'Medium',
          isCompleted: false
        }));
        break;
      }
    }
  }

  // Save all tasks in DB
  for (const task of studyTasks) {
    await task.save();
  }

  // Update Plan totals
  plan.totalTasks = studyTasks.length;
  plan.completedTasks = studyTasks.filter(t => t.isCompleted).length;
  plan.progressPercentage = plan.totalTasks > 0 ? Math.round((plan.completedTasks / plan.totalTasks) * 100) : 0;
  plan.weakTopicsCount = candidateTopics.filter(t => t.isWeak).length;
  plan.targetDate = examTargetDate;
  plan.dailyAvailableHours = hoursPerDay;
  await plan.save();

  // Also update examCountdown in planner.json for backward compatibility
  setExamCountdown({
    examName: examTitle,
    subjectId: 'all',
    date: examTargetDate,
    targetScore: '85%+'
  });

  return {
    success: true,
    plan,
    totalTasksScheduled: studyTasks.length,
    preparationDays: diffDays,
    examTargetDate
  };
}

/**
 * Feature 5: Explore & Learn Roadmap Planner
 * Generates structured milestone plan for additional career tracks (DevOps, AI/ML, etc.)
 */
async function generateExploreStudyPlan({
  trackId,
  targetDate,
  dailyAvailableHours = 2,
  studentId = 'default_student'
}) {
  const track = exploreService.getTrackById(trackId);
  if (!track) {
    throw new Error(`Roadmap track "${trackId}" not found.`);
  }

  const hoursPerDay = parseFloat(dailyAvailableHours) || 2;
  const today = new Date();
  const targetDateObj = new Date(targetDate);
  const diffDays = Math.max(3, Math.ceil((targetDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // Gather pending milestones
  const completedSet = new Set((track.completedTopics || []).map(t => t.toLowerCase()));
  const pendingMilestones = [];

  for (const stage of track.stages || []) {
    for (const topic of stage.topics || []) {
      if (!completedSet.has(topic.id.toLowerCase())) {
        pendingMilestones.push({
          stageNumber: stage.stageNumber,
          stageTitle: stage.title,
          topicId: topic.id,
          topicName: topic.name,
          desc: topic.desc
        });
      }
    }
  }

  // 1. Create or retrieve explore plan
  let plan = await StudyPlan.findOne({
    studentId,
    planType: 'explore_roadmap',
    targetId: trackId
  });

  if (plan) {
    await StudyTask.deleteMany({ planId: plan._id });
    plan.status = 'active';
  } else {
    plan = new StudyPlan({
      studentId,
      title: `${track.title} Roadmap Learning Plan`,
      planType: 'explore_roadmap',
      targetId: trackId,
      targetName: track.title,
      startDate: today.toISOString().slice(0, 10),
      targetDate,
      dailyAvailableHours: hoursPerDay,
      status: 'active'
    });
    await plan.save();
  }

  // 2. Schedule milestones
  const tasks = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const milestonesPerDay = Math.max(1, Math.ceil(pendingMilestones.length / diffDays));

  let mIndex = 0;
  for (let d = 0; d < diffDays && mIndex < pendingMilestones.length; d++) {
    const curDate = new Date(today.getTime() + d * 24 * 60 * 60 * 1000);
    const dateStr = curDate.toISOString().slice(0, 10);
    const dayOfWeek = dayNames[curDate.getDay()];

    for (let s = 0; s < milestonesPerDay && mIndex < pendingMilestones.length; s++) {
      const item = pendingMilestones[mIndex++];
      tasks.push(new StudyTask({
        studentId,
        planId: plan._id,
        date: dateStr,
        dayOfWeek,
        subjectId: trackId,
        subjectName: track.shortName,
        unitNumber: item.stageNumber,
        unitTitle: item.stageTitle,
        topicTitle: item.topicName,
        taskType: 'explore_topic',
        allocatedHours: Number((hoursPerDay / milestonesPerDay).toFixed(1)),
        pyqImportance: 'Career Skill',
        isCompleted: false
      }));
    }
  }

  for (const t of tasks) {
    await t.save();
  }

  plan.totalTasks = tasks.length;
  plan.completedTasks = 0;
  plan.progressPercentage = 0;
  plan.targetDate = targetDate;
  plan.dailyAvailableHours = hoursPerDay;
  await plan.save();

  return {
    success: true,
    plan,
    totalMilestonesScheduled: tasks.length,
    targetDate
  };
}

/**
 * Retrieves daily, weekly, and monthly schedule views for a StudyPlan
 */
async function getScheduleViews(planId, baseDateStr = null) {
  const targetDateStr = baseDateStr || new Date().toISOString().slice(0, 10);
  const tasks = await StudyTask.find({ planId });

  // 1. Daily View: tasks for today
  const dailyTasks = tasks.filter(t => t.date === targetDateStr);

  // 2. Weekly View: 7 days starting from baseDate Monday
  const baseDate = new Date(targetDateStr);
  const currentDayOfWeek = baseDate.getDay(); // 0 is Sun
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(baseDate.getTime() + mondayOffset * 24 * 60 * 60 * 1000);

  const weeklySchedule = [];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    const dStr = d.toISOString().slice(0, 10);
    weeklySchedule.push({
      dayName: dayNames[i],
      date: dStr,
      tasks: tasks.filter(t => t.date === dStr)
    });
  }

  // 3. Monthly View: all tasks grouped by date
  const monthlyMap = {};
  tasks.forEach(t => {
    if (!monthlyMap[t.date]) monthlyMap[t.date] = [];
    monthlyMap[t.date].push(t);
  });

  return {
    dailyTasks,
    weeklySchedule,
    monthlyMap,
    allTasks: tasks.sort((a, b) => a.date.localeCompare(b.date))
  };
}

/**
 * Toggles a study task's completion and synchronizes syllabus/explore progress
 */
async function toggleStudyTask(taskId) {
  const task = await StudyTask.findById(taskId);
  if (!task) throw new Error('Task not found');

  task.isCompleted = !task.isCompleted;
  task.completedAt = task.isCompleted ? new Date().toISOString() : null;
  await task.save();

  // Update Plan completion counts
  const plan = await StudyPlan.findById(task.planId);
  if (plan) {
    const allPlanTasks = await StudyTask.find({ planId: plan._id });
    plan.totalTasks = allPlanTasks.length;
    plan.completedTasks = allPlanTasks.filter(t => t.isCompleted).length;
    plan.progressPercentage = plan.totalTasks > 0 ? Math.round((plan.completedTasks / plan.totalTasks) * 100) : 0;
    await plan.save();
  }

  // Synchronize with Curriculum or Explore progress
  if (task.taskType === 'explore_topic') {
    const track = exploreService.getTrackById(task.subjectId);
    if (track) {
      // Find matching milestone id
      for (const st of track.stages || []) {
        for (const tp of st.topics || []) {
          if (tp.name === task.topicTitle) {
            exploreService.toggleMilestone(task.subjectId, tp.id, task.isCompleted);
            break;
          }
        }
      }
    }
  } else if (task.subjectId && task.subjectId !== 'all') {
    // Curriculum progress
    if (task.isCompleted) {
      progressService.toggleTopic(task.subjectId, task.topicTitle);
    }
  }

  return task;
}

/**
 * Reschedules unfinished (overdue) study tasks to future available days
 */
async function rescheduleUnfinishedTasks(planId) {
  const plan = await StudyPlan.findById(planId);
  if (!plan) throw new Error('Study Plan not found');

  const todayStr = new Date().toISOString().slice(0, 10);
  const tasks = await StudyTask.find({ planId });

  // Overdue and incomplete tasks
  const overdue = tasks.filter(t => t.date < todayStr && !t.isCompleted);
  if (overdue.length === 0) {
    return { success: true, rescheduledCount: 0, message: 'No overdue tasks to reschedule.' };
  }

  // Find future days with lighter loads
  let dayOffset = 1;
  for (const task of overdue) {
    const newDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    task.date = newDate;
    task.rescheduledCount = (task.rescheduledCount || 0) + 1;
    await task.save();
    dayOffset++;
  }

  return {
    success: true,
    rescheduledCount: overdue.length,
    message: `Rescheduled ${overdue.length} overdue task(s) to upcoming days.`
  };
}

/**
 * Updates a study task (date, duration, title)
 */
async function updateStudyTask(taskId, { date, allocatedHours, topicTitle }) {
  const task = await StudyTask.findById(taskId);
  if (!task) throw new Error('Task not found');

  if (date) task.date = date;
  if (allocatedHours !== undefined) task.allocatedHours = parseFloat(allocatedHours);
  if (topicTitle) task.topicTitle = topicTitle.trim();

  await task.save();
  return task;
}

/**
 * Cancels an active study plan (changes status to cancelled and removes active tasks)
 */
async function cancelStudyPlan(planId) {
  const plan = await StudyPlan.findById(planId);
  if (!plan) throw new Error('Study plan not found');
  plan.status = 'cancelled';
  plan.updatedAt = new Date().toISOString();
  await plan.save();

  // Clean up scheduled study tasks so they no longer appear
  await StudyTask.deleteMany({ planId: plan._id });
  return plan;
}

/**
 * Permanently deletes a study plan and all associated tasks
 */
async function deleteStudyPlan(planId) {
  const plan = await StudyPlan.findById(planId);
  if (!plan) throw new Error('Study plan not found');
  await StudyTask.deleteMany({ planId: plan._id });
  await StudyPlan.deleteOne({ _id: plan._id });
  return true;
}

/**
 * Cancels/removes an individual scheduled study task and recalculates plan metrics
 */
async function cancelStudyTask(taskId) {
  const task = await StudyTask.findById(taskId);
  if (!task) throw new Error('Study task not found');

  const planId = task.planId;
  await StudyTask.deleteOne({ _id: taskId });

  if (planId) {
    const plan = await StudyPlan.findById(planId);
    if (plan) {
      const remainingTasks = await StudyTask.find({ planId });
      plan.totalTasks = remainingTasks.length;
      plan.completedTasks = remainingTasks.filter(t => t.isCompleted).length;
      plan.progressPercentage = plan.totalTasks > 0 ? Math.round((plan.completedTasks / plan.totalTasks) * 100) : 0;
      await plan.save();
    }
  }

  return { success: true, taskId, planId };
}

/**
 * Retrieves the currently active study plan (University Exam or Explore).
 * Cancelled or archived plans will never be returned as active.
 */
async function getActiveStudyPlan(planType = 'university_exam', targetId = '3', studentId = 'default_student') {
  let plan = await StudyPlan.findOne({
    studentId,
    planType,
    targetId: String(targetId),
    status: 'active'
  });

  if (!plan) {
    return null;
  }

  const views = await getScheduleViews(plan._id);
  return {
    plan,
    views
  };
}

module.exports = {
  getPlannerData,
  addDailyGoal,
  toggleDailyGoal,
  deleteDailyGoal,
  addTimetableSlot,
  deleteTimetableSlot,
  scheduleRevision,
  toggleRevisionCycle,
  setExamCountdown,
  generatePersonalStudyPlan,
  generateExploreStudyPlan,
  getScheduleViews,
  toggleStudyTask,
  rescheduleUnfinishedTasks,
  updateStudyTask,
  cancelStudyPlan,
  deleteStudyPlan,
  cancelStudyTask,
  getActiveStudyPlan
};
