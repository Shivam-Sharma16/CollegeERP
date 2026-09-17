require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { setupSecurity } = require('@college-erp/shared-utils');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health.route');
const yearRoute = require('./routes/year.route');
const semesterRoute = require('./routes/semester.route');
const sectionRoute = require('./routes/section.route');
const batchRoute = require('./routes/batch.route');
const subjectRoute           = require('./routes/subject.route');
const teachingRoute          = require('./routes/teaching.route');
const sectionAssignmentRoute = require('./routes/sectionAssignment.route');
const rolloverRoute          = require('./routes/rollover.route');

const app = express();

setupSecurity(app);
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/', healthRoute);
app.use('/years', yearRoute);
app.use('/semesters', semesterRoute);
app.use('/sections', sectionRoute);
app.use('/batches',  batchRoute);
app.use('/subjects',           subjectRoute);
app.use('/teaching-assignments', teachingRoute);
app.use('/section-assignments',  sectionAssignmentRoute);
app.use('/academic', rolloverRoute);
app.use('/rollover', rolloverRoute);

app.use('/api/years', yearRoute);
app.use('/api/semesters', semesterRoute);
app.use('/api/sections', sectionRoute);
app.use('/api/batches', batchRoute);
app.use('/api/subjects', subjectRoute);
app.use('/api/teaching-assignments', teachingRoute);
app.use('/api/teaching/assignments', teachingRoute);  // Phase 88: frontend teachingApi uses /api/teaching/assignments
app.use('/api/teaching/section-assignments', sectionAssignmentRoute);  // Phase 88: frontend uses /api/teaching/section-assignments
app.use('/api/teaching',             teachingRoute);  // Phase 88: catch-all for /api/teaching/faculty-load/*
app.use('/api/section-assignments', sectionAssignmentRoute);
app.use('/api/academic', rolloverRoute);
app.use('/api/rollover', rolloverRoute);
app.use('/api/academics/years', yearRoute);
app.use('/api/academics/semesters', semesterRoute);
app.use('/api/academics/sections', sectionRoute);
app.use('/api/academics/batches', batchRoute);
app.use('/api/academics/subjects', subjectRoute);
app.use('/api/academics/teaching-assignments', teachingRoute);
app.use('/api/academics/section-assignments', sectionAssignmentRoute);
app.use('/api/academics/rollover', rolloverRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'academic-service'} started`);
});
