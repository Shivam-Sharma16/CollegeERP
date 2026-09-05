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
const subjectRoute = require('./routes/subject.route');

const app = express();

setupSecurity(app);
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/', healthRoute);
app.use('/years', yearRoute);
app.use('/semesters', semesterRoute);
app.use('/sections', sectionRoute);
app.use('/subjects', subjectRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'academic-service'} started`);
});
