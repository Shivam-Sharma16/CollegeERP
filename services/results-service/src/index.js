require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { setupSecurity } = require('@college-erp/shared-utils');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute     = require('./routes/health.route');
const examTypeRoute   = require('./routes/examType.route');
const marksRoute      = require('./routes/marks.route');
const transcriptRoute = require('./routes/transcript.route');

const app = express();

setupSecurity(app);
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/', healthRoute);
app.use('/exam-types', examTypeRoute);
app.use('/marks',      marksRoute);
app.use('/students',   transcriptRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'results-service'} started`);
});
