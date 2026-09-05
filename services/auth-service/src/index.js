require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const connectDB = require('./config/db');

const healthRoute = require('./routes/health.route');
const authRoute = require('./routes/auth.route');

const { setupSecurity } = require('@college-erp/shared-utils');

const app = express();

// 1. Core security (Helmet + CORS)
setupSecurity(app);

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Mount health route
app.use('/', healthRoute);

// Mount auth routes
app.use('/auth', authRoute);

connectDB();

app.listen(env.PORT, () => {
  console.log(`[${env.PORT}] ${'auth-service'} started`);
});
