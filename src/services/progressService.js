const fs = require('fs');
const path = require('path');
const { subjects, getAllSubjects, ROOT_DIR } = require('../config/subjects');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const PROGRESS_PATH = path.join(DATA_DIR, 'progress.json');

function loadProgress() {
  const allSubjects = getAllSubjects();

  if (!fs.existsSync(PROGRESS_PATH)) {
    const initial = {};
    allSubjects.forEach(sub => {
      initial[sub.id] = {
        completedTopics: [],
        completedLectures: 0,
        revision1: false,
        revision2: false,
        lastUpdated: new Date().toISOString()
      };
    });
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(PROGRESS_PATH, 'utf-8');
    const data = JSON.parse(raw);

    // Ensure all current subjects exist in the progress data
    let modified = false;
    allSubjects.forEach(sub => {
      if (!data[sub.id]) {
        data[sub.id] = {
          completedTopics: [],
          completedLectures: 0,
          revision1: false,
          revision2: false,
          lastUpdated: new Date().toISOString()
        };
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(data, null, 2), 'utf-8');
    }

    return data;
  } catch (e) {
    return {};
  }
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Toggles a topic's completion status
 */
function toggleTopic(subjectId, topicName) {
  const progress = loadProgress();
  if (!progress[subjectId]) {
    progress[subjectId] = { completedTopics: [], completedLectures: 0, revision1: false, revision2: false };
  }

  const list = progress[subjectId].completedTopics || [];
  const idx = list.indexOf(topicName);

  if (idx > -1) {
    list.splice(idx, 1);
  } else {
    list.push(topicName);
  }

  progress[subjectId].completedTopics = list;
  progress[subjectId].lastUpdated = new Date().toISOString();
  saveProgress(progress);

  return {
    subjectId,
    topicName,
    isCompleted: idx === -1
  };
}

/**
 * Calculates overall, per-semester, and subject-level statistics
 */
function getProgressStats(filterSemester = 'all') {
  const progress = loadProgress();
  const allSubjects = getAllSubjects();

  const targetSemester = filterSemester !== 'all' && filterSemester !== undefined && filterSemester !== null && filterSemester !== ''
    ? parseInt(filterSemester, 10)
    : null;

  const subjectStats = [];

  // Semester level aggregations (Semesters 1 - 8)
  const semesterStats = {};
  for (let s = 1; s <= 8; s++) {
    semesterStats[s] = {
      semester: s,
      totalSubjects: 0,
      totalTopics: 0,
      completedTopics: 0,
      percentage: 0
    };
  }

  let grandTotalTopics = 0;
  let grandCompletedTopics = 0;
  let grandTotalSubjects = 0;

  allSubjects.forEach(sub => {
    let subTotalTopics = 0;
    (sub.units || []).forEach(u => {
      subTotalTopics += (u.topics ? u.topics.length : 0);
    });

    const subData = progress[sub.id] || { completedTopics: [], completedLectures: 0 };
    const completedCount = (subData.completedTopics || []).length;
    const percentage = subTotalTopics > 0 ? Math.round((completedCount / subTotalTopics) * 100) : 0;

    // Track semester aggregations
    const sem = sub.semester || 3;
    if (semesterStats[sem]) {
      semesterStats[sem].totalSubjects += 1;
      semesterStats[sem].totalTopics += subTotalTopics;
      semesterStats[sem].completedTopics += completedCount;
    }

    // Find pending topics for revision
    const pendingTopics = [];
    (sub.units || []).forEach(u => {
      (u.topics || []).forEach(t => {
        if (!(subData.completedTopics || []).includes(t)) {
          pendingTopics.push({ unitNumber: u.number, unitTitle: u.title, topic: t });
        }
      });
    });

    const statItem = {
      subject: sub,
      semester: sem,
      totalTopics: subTotalTopics,
      completedTopicsCount: completedCount,
      completedTopicsList: subData.completedTopics || [],
      pendingTopics,
      percentage,
      completedLectures: subData.completedLectures || 0,
      revision1: subData.revision1 || false,
      revision2: subData.revision2 || false
    };

    // Filter by semester if target is specified
    const matchesSemester = targetSemester === null || sem === targetSemester;
    if (matchesSemester) {
      grandTotalSubjects += 1;
      grandTotalTopics += subTotalTopics;
      grandCompletedTopics += completedCount;
    }

    subjectStats.push(statItem);
  });

  // Calculate percentages for each semester
  for (let s = 1; s <= 8; s++) {
    const st = semesterStats[s];
    st.percentage = st.totalTopics > 0 ? Math.round((st.completedTopics / st.totalTopics) * 100) : 0;
  }

  const overallPercentage = grandTotalTopics > 0
    ? Math.round((grandCompletedTopics / grandTotalTopics) * 100)
    : 0;

  // Filtered subject stats for view
  const filteredSubjects = targetSemester === null
    ? subjectStats
    : subjectStats.filter(s => s.semester === targetSemester);

  return {
    selectedSemester: targetSemester !== null ? targetSemester : 'all',
    grandTotalSubjects,
    grandTotalTopics,
    grandCompletedTopics,
    overallPercentage,
    subjects: filteredSubjects,
    allSubjectStats: subjectStats,
    semesterStats
  };
}

module.exports = {
  loadProgress,
  toggleTopic,
  getProgressStats
};
