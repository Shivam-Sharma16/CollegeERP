require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const { setupSecurity, verifyTenantContext } = require('@college-erp/shared-utils');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health.route');
const institutionRoute = require('./routes/institution.route');

const app = express();

setupSecurity(app);
app.use(morgan('dev'));
app.use(express.json());

// Tenant context verification (from Gateway)
app.use(verifyTenantContext({ required: false }));

// Mount health route
app.use('/', healthRoute);

// Feature routes
app.use('/institutions', institutionRoute);
app.use('/api/institutions', institutionRoute);
app.use('/superadmin/institutions', institutionRoute);
app.use('/api/superadmin/institutions', institutionRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] institution-service started`);
});

module.exports = app;
