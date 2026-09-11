require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { setupSecurity } = require('@college-erp/shared-utils');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute  = require('./routes/health.route');
const sessionRoute = require('./routes/session.route');
const recordRoute  = require('./routes/record.route');

const app = express();

setupSecurity(app);
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/', healthRoute);
app.use('/sessions', sessionRoute);
app.use('/records',  recordRoute);
app.use('/summary',  recordRoute);

app.use('/api/attendance/sessions', sessionRoute);
app.use('/api/attendance/records',  recordRoute);
app.use('/api/attendance/summary',  recordRoute);
app.use('/api/attendance',          sessionRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'attendance-service'} started`);
});
