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
const institutionRoute = require('./routes/institution.route');
const roleRoute = require('./routes/role.route');
const grievanceRoute = require('./routes/grievance.route');
const certificateRoute = require('./routes/certificate.route');

const app = express();

setupSecurity(app);
app.use(morgan('dev'));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Mount health route
app.use('/', healthRoute);

// Feature routes
app.use('/institutions', institutionRoute);
app.use('/departments', departmentRoute);
app.use('/users', userRoute);
app.use('/roles', roleRoute);
app.use('/custom-roles', roleRoute);
app.use('/permissions', roleRoute);
app.use('/grievances', grievanceRoute);
app.use('/certificates', certificateRoute);
app.use('/audit', auditRoute);
app.use('/reports', reportsRoute);
app.use('/settings', settingsRoute);

app.use('/api/institutions', institutionRoute);
app.use('/api/departments', departmentRoute);
app.use('/api/users', userRoute);
app.use('/api/roles', roleRoute);
app.use('/api/custom-roles', roleRoute);
app.use('/api/permissions', roleRoute);
app.use('/api/grievances', grievanceRoute);
app.use('/api/certificates', certificateRoute);
app.use('/api/audit', auditRoute);
app.use('/api/reports', reportsRoute);
app.use('/api/settings', settingsRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'user-service'} started`);
});
