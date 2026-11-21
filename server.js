require('dotenv').config();
const express = require('express');
const path = require('path');

const indexRoutes = require('./src/routes/indexRoutes');
const subjectRoutes = require('./src/routes/subjectRoutes');
const syllabusRoutes = require('./src/routes/syllabusRoutes');
const lectureRoutes = require('./src/routes/lectureRoutes');
const libraryRoutes = require('./src/routes/libraryRoutes');
const pyqRoutes = require('./src/routes/pyqRoutes');
const progressRoutes = require('./src/routes/progressRoutes');
const assistantRoutes = require('./src/routes/assistantRoutes');
const exploreRoutes = require('./src/routes/exploreRoutes');
const practiceRoutes = require('./src/routes/practiceRoutes');
const plannerRoutes = require('./src/routes/plannerRoutes');
const noticeRoutes = require('./src/routes/noticeRoutes');
const transcriptionRoutes = require('./src/routes/transcriptionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

const { getAllSubjects } = require('./src/config/subjects');

// Global template locals (current year, app info, subjects list)
app.use((req, res, next) => {
  res.locals.currentYear = new Date().getFullYear();
  res.locals.activeNav = '';
  res.locals.navSubjects = getAllSubjects();
  next();
});

// Mount Routes
app.use('/', indexRoutes);
app.use('/subject', subjectRoutes);
app.use('/syllabus', syllabusRoutes);
app.use('/', lectureRoutes);
app.use('/library', libraryRoutes);
app.use('/pyqs', pyqRoutes);
app.use('/progress', progressRoutes);
app.use('/assistant', assistantRoutes);
app.use('/explore', exploreRoutes);
app.use('/practice', practiceRoutes);
app.use('/planner', plannerRoutes);
app.use('/notices', noticeRoutes);
app.use('/transcription', transcriptionRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('pages/404', {
    title: 'Page Not Found - CSE Study Hub',
    message: `The requested path "${req.originalUrl}" was not found.`
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  res.status(500).render('pages/error', {
    title: 'Server Error - CSE Study Hub',
    error: err
  });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`🚀 CSE Study Hub is running at: http://0.0.0.0:${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🤖 AI Enabled: ${Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)}`);
    console.log(`===============================================`);
  });
}

module.exports = app;
