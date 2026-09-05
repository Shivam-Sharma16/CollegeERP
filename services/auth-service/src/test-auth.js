require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const authRoute = require('./routes/auth.route');
const User = require('./models/User.model');
const RoleAssignment = require('./models/RoleAssignment.model');

// We need to disable trustProxy logic in rate-limit if we are running locally without proxy
// Actually, rate-limit uses req.ip which is fine for local tests
const mockRequest = async (app, method, url, body) => {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      
      const response = await fetch(`http://localhost:${port}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const status = response.status;
      const data = await response.json().catch(() => ({}));
      
      server.close(() => {
        resolve({ status, data });
      });
    });
  });
};

async function runTest() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev').replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const app = express();
  // Needed for rate-limiting inside tests since it uses random ports locally over loopback
  app.set('trust proxy', 1); 
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRoute);

  await User.deleteMany({});
  await RoleAssignment.deleteMany({});
  await mongoose.connection.db.collection('auditlogs').deleteMany({});

  process.env.JWT_ACCESS_SECRET = 'test_access';
  process.env.JWT_REFRESH_SECRET = 'test_refresh';
  const setupKey = process.env.SUPERADMIN_SETUP_KEY || 'test_setup_key';

  console.log('\\n--- Test 1: Joi Input Validation ---');
  let res = await mockRequest(app, 'POST', '/auth/superadmin/signup', {
    name: 'Super Admin',
    // Missing email
    password: 'password123',
    setupKey: setupKey
  });

  if (res.status === 400 && res.data.success === false && res.data.error.includes('"email" is required')) {
    console.log('✅ TEST PASSED: Joi validation correctly rejected malformed input (400).');
  } else {
    console.error(`❌ TEST FAILED: Validation did not work properly. Status: ${res.status}`);
    console.error(res.data);
  }

  console.log('\\n--- Test 2: First Superadmin Signup & Audit Logging ---');
  res = await mockRequest(app, 'POST', '/auth/superadmin/signup', {
    name: 'Super Admin',
    email: 'admin@college.edu',
    password: 'password123',
    setupKey: setupKey
  });

  if (res.status === 201) {
    console.log('✅ TEST PASSED: First superadmin created successfully.');
    // Check Audit Log
    const audit = await mongoose.connection.db.collection('auditlogs').findOne({ action: 'SUPERADMIN_CREATED' });
    if (audit && audit.targetType === 'User') {
      console.log('✅ TEST PASSED: Audit log successfully persisted the account creation.');
    } else {
      console.error('❌ TEST FAILED: Audit log missing for Superadmin creation.');
    }
  } else {
    console.error(`❌ TEST FAILED: First superadmin signup failed. Status: ${res.status}`);
    console.error(res.data);
  }

  console.log('\\n--- Test 3: Rate Limiting on Superadmin Signup ---');
  // We already made 2 requests (1 validation fail, 1 success)
  // Let's make 2 more to hit the max of 3.
  await mockRequest(app, 'POST', '/auth/superadmin/signup', {
    name: 'Spam', email: 'spam1@college.edu', password: 'password123', setupKey: setupKey
  });
  const rateLimitRes = await mockRequest(app, 'POST', '/auth/superadmin/signup', {
    name: 'Spam', email: 'spam2@college.edu', password: 'password123', setupKey: setupKey
  });

  if (rateLimitRes.status === 429) {
    console.log('✅ TEST PASSED: Superadmin route properly rate limited (429) after 3 attempts.');
  } else {
    console.error(`❌ TEST FAILED: Rate limiter did not fire. Status: ${rateLimitRes.status}`);
    console.error(rateLimitRes.data);
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
