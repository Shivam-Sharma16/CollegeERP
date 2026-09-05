require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const authRoute = require('./routes/auth.route');
const User = require('./models/User.model');
const RoleAssignment = require('./models/RoleAssignment.model');

// Mock request helper
const mockRequest = async (app, method, url, body) => {
  // Using supertest-like approach without installing supertest
  // Instead we'll just test the controller methods directly or use fetch if we spin up a server
  return new Promise((resolve) => {
    // Spin up a quick server
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

  // Setup express app
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRoute);

  // Clear DB
  await User.deleteMany({});
  await RoleAssignment.deleteMany({});

  process.env.JWT_ACCESS_SECRET = 'test_access';
  process.env.JWT_REFRESH_SECRET = 'test_refresh';

  const setupKey = process.env.SUPERADMIN_SETUP_KEY || 'test_setup_key';

  console.log('\\n--- Test 1: First Superadmin Signup ---');
  let res = await mockRequest(app, 'POST', '/auth/superadmin/signup', {
    name: 'Super Admin',
    email: 'admin@college.edu',
    password: 'password123',
    setupKey: setupKey
  });

  if (res.status === 201) {
    console.log('✅ TEST PASSED: First superadmin created successfully.');
  } else {
    console.error(`❌ TEST FAILED: First superadmin signup failed. Status: ${res.status}`);
    console.error(res.data);
  }

  console.log('\\n--- Test 2: Second Superadmin Signup Attempt ---');
  res = await mockRequest(app, 'POST', '/auth/superadmin/signup', {
    name: 'Rogue Admin',
    email: 'rogue@college.edu',
    password: 'password123',
    setupKey: setupKey
  });

  if (res.status === 403) {
    console.log('✅ TEST PASSED: Second superadmin signup properly rejected (403).');
  } else {
    console.error(`❌ TEST FAILED: Second superadmin signup was not rejected properly. Status: ${res.status}`);
  }

  console.log('\\n--- Test 3: Student Self-Registration Privilege Escalation Attempt ---');
  res = await mockRequest(app, 'POST', '/auth/register/student', {
    name: 'Sneaky Student',
    email: 'sneaky@college.edu',
    password: 'password123',
    departmentId: new mongoose.Types.ObjectId().toString(),
    sectionId: new mongoose.Types.ObjectId().toString(),
    role: 'ADMIN', // Try to escalate
    roles: ['SUPERADMIN'] // Try to escalate
  });

  if (res.status === 201) {
    const sneakyUser = await User.findById(res.data.userId);
    if (sneakyUser.roles.length === 1 && sneakyUser.roles[0] === 'STUDENT') {
      console.log('✅ TEST PASSED: Student registration strictly enforced the STUDENT role, ignoring payload overrides.');
    } else {
      console.error('❌ TEST FAILED: Student registration accepted elevated roles!');
      console.error(sneakyUser.roles);
    }
  } else {
    console.error(`❌ TEST FAILED: Student registration failed. Status: ${res.status}`);
    console.error(res.data);
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
