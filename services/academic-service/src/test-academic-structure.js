require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const yearRoute     = require('./routes/year.route');
const semesterRoute = require('./routes/semester.route');
const sectionRoute  = require('./routes/section.route');
const subjectRoute  = require('./routes/subject.route');

const Year     = require('./models/Year.model');
const Semester = require('./models/Semester.model');
const Section  = require('./models/Section.model');
const Subject  = require('./models/Subject.model');

const JWT_SECRET = 'test_academic_secret_p13';
process.env.JWT_ACCESS_SECRET = JWT_SECRET;

const makeToken = (userId, roles) =>
  jwt.sign({ userId: userId.toString(), roles }, JWT_SECRET, { expiresIn: '1h' });

const req = (app, method, url, token, body) =>
  new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const res = await fetch(`http://localhost:${port}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
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
  app.use('/years',     yearRoute);
  app.use('/semesters', semesterRoute);
  app.use('/sections',  sectionRoute);
  app.use('/subjects',  subjectRoute);
  return app;
};

async function run() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB\n');

  // Cleanup
  await Year.deleteMany({});
  await Semester.deleteMany({});
  await Section.deleteMany({});
  await Subject.deleteMany({});
  await mongoose.connection.db.collection('roleassignments').deleteMany({ role: { $in: ['HOD'] } });

  // Seed two HODs with different departments
  const hodAId = new mongoose.Types.ObjectId();
  const hodBId = new mongoose.Types.ObjectId();
  const deptA  = new mongoose.Types.ObjectId();
  const deptB  = new mongoose.Types.ObjectId();

  await mongoose.connection.db.collection('roleassignments').insertMany([
    { userId: hodAId, role: 'HOD', departmentId: deptA, validFrom: new Date() },
    { userId: hodBId, role: 'HOD', departmentId: deptB, validFrom: new Date() }
  ]);

  const hodAToken = makeToken(hodAId, ['HOD']);
  const hodBToken = makeToken(hodBId, ['HOD']);

  const app = buildApp();
  let passed = 0, failed = 0;

  const assert = (label, condition) => {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else           { console.error(`  ❌ ${label}`); failed++; }
  };

  // ─── Block 1: Year CRUD ────────────────────────────────────────────────────
  console.log('--- Block 1: Year CRUD ---');
  const r1 = await req(app, 'POST', '/years', hodAToken, { yearNumber: 1 });
  assert('HOD A creates Year 1 (201)', r1.status === 201);
  const yearAId = r1.data?.data?.year?._id;

  const r1b = await req(app, 'POST', '/years', hodAToken, { yearNumber: 1 });
  assert('Duplicate Year 1 rejected (409)', r1b.status === 409);

  // ─── Block 2: Semester — valid chain ────────────────────────────────────────
  console.log('\n--- Block 2: Semester under own Year ---');
  const r2 = await req(app, 'POST', '/semesters', hodAToken, { yearId: yearAId, semesterNumber: 1 });
  assert('HOD A creates Semester under own Year (201)', r2.status === 201);
  const semAId = r2.data?.data?.semester?._id;
  assert('Semester inherits departmentId from Year', r2.data?.data?.semester?.departmentId === deptA.toString());

  // ─── Block 3: HOD B cannot create Semester under HOD A's Year ──────────────
  console.log('\n--- Block 3: Cross-department Semester (forbidden) ---');
  const r3 = await req(app, 'POST', '/semesters', hodBToken, { yearId: yearAId, semesterNumber: 2 });
  assert('HOD B cannot create Semester under HOD A\'s Year (403)', r3.status === 403);

  // ─── Block 4: Section — valid chain ─────────────────────────────────────────
  console.log('\n--- Block 4: Section under own Semester ---');
  const r4 = await req(app, 'POST', '/sections', hodAToken, { semesterId: semAId, name: 'A' });
  assert('HOD A creates Section A under own Semester (201)', r4.status === 201);
  const sectionAId = r4.data?.data?.section?._id;

  // ─── Block 5: HOD B cannot create Section under HOD A's Semester ────────────
  console.log('\n--- Block 5: Cross-department Section (forbidden) ---');
  const r5 = await req(app, 'POST', '/sections', hodBToken, { semesterId: semAId, name: 'B' });
  assert('HOD B cannot create Section under HOD A\'s Semester (403)', r5.status === 403);

  // ─── Block 6: Delete Semester blocked by active Sections ────────────────────
  console.log('\n--- Block 6: Delete Semester blocked by active sections ---');
  const r6 = await req(app, 'DELETE', `/semesters/${semAId}`, hodAToken);
  assert('Delete Semester with 1 active section returns 409', r6.status === 409);
  assert('Error message names the count', r6.data?.error?.includes('1 section(s) still active'));

  // ─── Block 7: Delete Section first, then Semester succeeds ──────────────────
  console.log('\n--- Block 7: Delete Section → then Semester succeeds ---');
  const r7a = await req(app, 'DELETE', `/sections/${sectionAId}`, hodAToken);
  assert('HOD A deletes own Section (200)', r7a.status === 200);

  const r7b = await req(app, 'DELETE', `/semesters/${semAId}`, hodAToken);
  assert('HOD A deletes Semester after sections cleared (200)', r7b.status === 200);

  // ─── Block 8: Subject — departmentId auto-scoped, never from body ───────────
  console.log('\n--- Block 8: Subject creation auto-scoped ---');
  const r8 = await req(app, 'POST', '/subjects', hodAToken, {
    name: 'Data Structures',
    code: 'CS301',
    credits: 4,
    departmentId: deptB.toString() // Injection attempt — must be ignored
  });
  assert('HOD A creates Subject (201)', r8.status === 201);
  assert('Subject scoped to Dept A, not injected Dept B',
    r8.data?.data?.subject?.departmentId === deptA.toString()
  );

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
