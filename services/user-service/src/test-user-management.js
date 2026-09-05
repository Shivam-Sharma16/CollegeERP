require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const departmentRoute = require('./routes/department.route');
const userRoute = require('./routes/user.route');

const User = require('./models/User.model');
const RoleAssignment = require('./models/RoleAssignment.model');
const Department = require('./models/Department.model');

const JWT_SECRET = 'test_access_secret_p12';
process.env.JWT_ACCESS_SECRET = JWT_SECRET;

// --- Test Helpers ---
const makeToken = (userId, roles) =>
  jwt.sign({ userId: userId.toString(), roles }, JWT_SECRET, { expiresIn: '1h' });

const mockRequest = (app, method, url, token, body) =>
  new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const res = await fetch(`http://localhost:${port}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      const status = res.status;
      const data = await res.json().catch(() => ({}));
      server.close(() => resolve({ status, data }));
    });
  });

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/departments', departmentRoute);
  app.use('/users', userRoute);
  return app;
};

async function runTests() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB\n');

  // Cleanup
  await User.deleteMany({});
  await RoleAssignment.deleteMany({});
  await Department.deleteMany({});
  await mongoose.connection.db.collection('auditlogs').deleteMany({});

  // --- Seed identities ---
  const superadminId = new mongoose.Types.ObjectId();
  const adminId      = new mongoose.Types.ObjectId();
  const hodId        = new mongoose.Types.ObjectId();

  const deptA = await Department.create({ name: 'Computer Science', code: 'CS' });
  const deptB = await Department.create({ name: 'Information Technology', code: 'IT' });

  // We don't insert full User docs — only RoleAssignments, since the controller
  // only reads req.user (from JWT) + req.effectiveRoles (from RoleAssignment collection).
  await RoleAssignment.insertMany([
    { userId: superadminId, role: 'SUPERADMIN', validFrom: new Date() },
    { userId: adminId,      role: 'ADMIN',      validFrom: new Date() },
    { userId: hodId,        role: 'HOD',        departmentId: deptA._id, validFrom: new Date() }
  ]);

  const superadminToken = makeToken(superadminId, ['SUPERADMIN']);
  const adminToken      = makeToken(adminId,      ['ADMIN']);
  const hodToken        = makeToken(hodId,        ['HOD']);

  const app = buildApp();
  let passed = 0;
  let failed = 0;

  const assert = (label, condition) => {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else           { console.error(`  ❌ ${label}`); failed++; }
  };

  // =========================================================
  // Block 1: SuperAdmin creates Admin
  // =========================================================
  console.log('--- Block 1: SuperAdmin → Admin ---');
  const r1 = await mockRequest(app, 'POST', '/users/admins', superadminToken, {
    name: 'Admin User', email: 'admin@college.edu', password: 'password123'
  });
  assert('SuperAdmin can create Admin (201)', r1.status === 201);

  const adminLog = await mongoose.connection.db.collection('auditlogs')
    .findOne({ action: 'ADMIN_CREATED' });
  assert('AuditLog written for ADMIN_CREATED', !!adminLog);

  // =========================================================
  // Block 2: Admin CANNOT create another Admin
  // =========================================================
  console.log('\n--- Block 2: Admin → Admin (forbidden) ---');
  const r2 = await mockRequest(app, 'POST', '/users/admins', adminToken, {
    name: 'Admin2', email: 'admin2@college.edu', password: 'password123'
  });
  assert('Admin cannot create Admin (403)', r2.status === 403);

  // =========================================================
  // Block 3: Admin creates HOD with departmentId
  // =========================================================
  console.log('\n--- Block 3: Admin → HOD ---');
  const r3 = await mockRequest(app, 'POST', '/users/hods', adminToken, {
    name: 'HOD User',
    email: 'hod@college.edu',
    password: 'password123',
    departmentId: deptA._id.toString()
  });
  assert('Admin can create HOD (201)', r3.status === 201);

  const hodLog = await mongoose.connection.db.collection('auditlogs')
    .findOne({ action: 'HOD_CREATED' });
  assert('AuditLog written for HOD_CREATED', !!hodLog);

  // =========================================================
  // Block 4: HOD CANNOT create HOD
  // =========================================================
  console.log('\n--- Block 4: HOD → HOD (forbidden) ---');
  const r4 = await mockRequest(app, 'POST', '/users/hods', hodToken, {
    name: 'FakeHOD', email: 'fakehod@college.edu', password: 'password123',
    departmentId: deptA._id.toString()
  });
  assert('HOD cannot create HOD (403)', r4.status === 403);

  // =========================================================
  // Block 5: HOD CANNOT create Admin
  // =========================================================
  console.log('\n--- Block 5: HOD → Admin (forbidden) ---');
  const r5 = await mockRequest(app, 'POST', '/users/admins', hodToken, {
    name: 'FakeAdmin', email: 'fakeadmin@college.edu', password: 'password123'
  });
  assert('HOD cannot create Admin (403)', r5.status === 403);

  // =========================================================
  // Block 6: HOD creates Faculty — departmentId auto-scoped, payload injection ignored
  // =========================================================
  console.log('\n--- Block 6: HOD → Faculty (auto-scoped, payload injection ignored) ---');
  const r6 = await mockRequest(app, 'POST', '/users/faculty', hodToken, {
    name: 'Faculty User',
    email: 'faculty@college.edu',
    password: 'password123',
    departmentId: deptB._id.toString() // Attempt to inject Dept B — should be ignored
  });
  assert('HOD can create Faculty (201)', r6.status === 201);

  // Verify the Faculty is scoped to Dept A (HOD's real department), NOT Dept B
  const facultyRA = await RoleAssignment.findOne({ role: 'FACULTY' });
  assert(
    'Faculty is auto-scoped to HOD\'s real dept (Dept A), not injected Dept B',
    facultyRA && facultyRA.departmentId.toString() === deptA._id.toString()
  );

  const facultyLog = await mongoose.connection.db.collection('auditlogs')
    .findOne({ action: 'FACULTY_CREATED' });
  assert('AuditLog written for FACULTY_CREATED', !!facultyLog);

  // =========================================================
  // Block 7: HOD creates CC — same auto-scoping logic
  // =========================================================
  console.log('\n--- Block 7: HOD → CC (auto-scoped) ---');
  const r7 = await mockRequest(app, 'POST', '/users/cc', hodToken, {
    name: 'CC User', email: 'cc@college.edu', password: 'password123',
    departmentId: deptB._id.toString() // Again, injection attempt
  });
  assert('HOD can create CC (201)', r7.status === 201);

  const ccRA = await RoleAssignment.findOne({ role: 'CC' });
  assert(
    'CC is auto-scoped to HOD\'s real dept (Dept A), not injected Dept B',
    ccRA && ccRA.departmentId.toString() === deptA._id.toString()
  );

  // =========================================================
  // Summary
  // =========================================================
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Unhandled error in tests:', err);
  process.exit(1);
});
