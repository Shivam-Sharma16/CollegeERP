require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { setupSecurity } = require('@college-erp/shared-utils');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health.route');
const departmentRoute = require('./routes/department.route');
const userRoute = require('./routes/user.route');
const auditRoute = require('./routes/audit.route');
const reportsRoute = require('./routes/reports.route');
const settingsRoute = require('./routes/settings.route');

const app = express();

setupSecurity(app);
app.use(morgan('dev'));
app.use(express.json());

// Mount health route
app.use('/', healthRoute);

// Feature routes
app.use('/departments', departmentRoute);
app.use('/users', userRoute);
app.use('/audit', auditRoute);
app.use('/reports', reportsRoute);
app.use('/settings', settingsRoute);

app.use('/api/departments', departmentRoute);
app.use('/api/users', userRoute);
app.use('/api/audit', auditRoute);
app.use('/api/reports', reportsRoute);
app.use('/api/settings', settingsRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'user-service'} started`);
});
