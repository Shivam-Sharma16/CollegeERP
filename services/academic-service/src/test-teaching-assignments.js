require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const teachingRoute          = require('./routes/teaching.route');
const sectionAssignmentRoute = require('./routes/sectionAssignment.route');

const TeachingAssignment = require('./models/TeachingAssignment.model');
const SectionAssignment  = require('./models/SectionAssignment.model');
const Year               = require('./models/Year.model');
const Semester           = require('./models/Semester.model');
const Section            = require('./models/Section.model');
const Subject            = require('./models/Subject.model');

const JWT_SECRET = 'test_teaching_secret_p14';
process.env.JWT_ACCESS_SECRET = JWT_SECRET;

const makeToken = (userId, roles) =>
  jwt.sign({ userId: userId.toString(), roles }, JWT_SECRET, { expiresIn: '1h' });

const httpReq = (app, method, url, token, body) =>
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
  app.use('/teaching-assignments', teachingRoute);
  app.use('/section-assignments',  sectionAssignmentRoute);
  return app;
};

async function run() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB\n');

  // Cleanup
  await TeachingAssignment.deleteMany({});
  await SectionAssignment.deleteMany({});
  await Year.deleteMany({});
  await Semester.deleteMany({});
  await Section.deleteMany({});
  await Subject.deleteMany({});
  await mongoose.connection.db.collection('roleassignments').deleteMany({ role: 'HOD' });

  // Seed structure
  const hodId   = new mongoose.Types.ObjectId();
  const deptA   = new mongoose.Types.ObjectId();
  const faculty1 = new mongoose.Types.ObjectId();
  const faculty2 = new mongoose.Types.ObjectId();
  const cc1     = new mongoose.Types.ObjectId();
  const cc2     = new mongoose.Types.ObjectId();

  await mongoose.connection.db.collection('roleassignments').insertOne(
    { userId: hodId, role: 'HOD', departmentId: deptA, validFrom: new Date() }
  );

  const year = await Year.create({ departmentId: deptA, yearNumber: 1 });
  const semester = await Semester.create({ departmentId: deptA, yearId: year._id, semesterNumber: 1 });
  const section = await Section.create({ semesterId: semester._id, name: 'A' });
  const subject = await Subject.create({ departmentId: deptA, name: 'DS', code: 'CS301', credits: 4 });

  const hodToken = makeToken(hodId, ['HOD']);
  const app = buildApp();

  let passed = 0, failed = 0;
  const assert = (label, condition) => {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else           { console.error(`  ❌ ${label}`); failed++; }
  };

  // ─── Block 1: Valid TeachingAssignment ─────────────────────────────────────
  console.log('--- Block 1: Valid TeachingAssignment ---');
  const r1 = await httpReq(app, 'POST', '/teaching-assignments', hodToken, {
    facultyId: faculty1.toString(),
    subjectId: subject._id.toString(),
    sectionId: section._id.toString(),
    academicYearLabel: '2024-25'
  });
  assert('Create TeachingAssignment (201)', r1.status === 201);
  const ta1Id = r1.data?.data?.assignment?._id;

  // ─── Block 2: Duplicate TeachingAssignment rejected ────────────────────────
  console.log('\n--- Block 2: Duplicate TeachingAssignment ---');
  const r2 = await httpReq(app, 'POST', '/teaching-assignments', hodToken, {
    facultyId: faculty1.toString(),
    subjectId: subject._id.toString(),
    sectionId: section._id.toString(),
    academicYearLabel: '2024-25'
  });
  assert('Duplicate TeachingAssignment rejected (409)', r2.status === 409);
  assert('409 error names the existing assignment ID', r2.data?.error?.includes(ta1Id));

  // ─── Block 3: First SectionAssignment ─────────────────────────────────────
  console.log('\n--- Block 3: First SectionAssignment ---');
  const validFrom1 = new Date('2024-07-01').toISOString();
  const r3 = await httpReq(app, 'POST', '/section-assignments', hodToken, {
    sectionId: section._id.toString(),
    semesterId: semester._id.toString(),
    ccUserId: cc1.toString(),
    validFrom: validFrom1
  });
  assert('Create first SectionAssignment (201)', r3.status === 201);
  const sa1Id = r3.data?.data?.assignment?._id;

  // ─── Block 4: Second CC without closeExistingId → 409 ─────────────────────
  console.log('\n--- Block 4: Second CC without handover → 409 ---');
  const r4 = await httpReq(app, 'POST', '/section-assignments', hodToken, {
    sectionId: section._id.toString(),
    semesterId: semester._id.toString(),
    ccUserId: cc2.toString(),
    validFrom: new Date('2024-12-01').toISOString()
    // No closeExistingId — should be rejected
  });
  assert('Second CC without closeExistingId rejected (409)', r4.status === 409);
  assert('409 names the active assignment ID', r4.data?.error?.includes(sa1Id));
  assert('409 names the active CC userId', r4.data?.error?.includes(cc1.toString()));

  // ─── Block 5: CC Handover with closeExistingId ────────────────────────────
  console.log('\n--- Block 5: CC Handover with closeExistingId ---');
  const validFrom2 = new Date('2024-12-01').toISOString();
  const r5 = await httpReq(app, 'POST', '/section-assignments', hodToken, {
    sectionId: section._id.toString(),
    semesterId: semester._id.toString(),
    ccUserId: cc2.toString(),
    validFrom: validFrom2,
    closeExistingId: sa1Id
  });
  assert('CC Handover with closeExistingId succeeds (201)', r5.status === 201);
  const sa2Id = r5.data?.data?.assignment?._id;

  // Verify old assignment is now closed (validTo set)
  const closedAssignment = await SectionAssignment.findById(sa1Id);
  assert('Old SectionAssignment now has validTo set', closedAssignment?.validTo !== null);

  // Verify exactly one active assignment for this section
  const activeCount = await SectionAssignment.countDocuments({
    sectionId: section._id, validTo: null
  });
  assert('Exactly one active SectionAssignment after handover', activeCount === 1);

  // ─── Block 6: getSectionCC returns single active CC ───────────────────────
  console.log('\n--- Block 6: getSectionCC returns single active CC ---');
  const r6 = await httpReq(app, 'GET', `/section-assignments/current/${section._id}`, hodToken);
  assert('getSectionCC returns 200', r6.status === 200);
  assert('getSectionCC returns new CC (cc2)', r6.data?.data?.assignment?.ccUserId === cc2.toString());
  assert('getSectionCC returned assignment has validTo null', r6.data?.data?.assignment?.validTo === null);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
