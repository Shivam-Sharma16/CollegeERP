require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const assert = require('assert');

const subjectRoute = require('./routes/subject.route');
const batchRoute = require('./routes/batch.route');
const teachingRoute = require('./routes/teaching.route');

const Year = require('./models/Year.model');
const Semester = require('./models/Semester.model');
const Section = require('./models/Section.model');
const Subject = require('./models/Subject.model');
const Batch = require('./models/Batch.model');
const TeachingAssignment = require('./models/TeachingAssignment.model');

const JWT_SECRET = 'test_academic_secret_p83';
process.env.JWT_ACCESS_SECRET = JWT_SECRET;

const makeToken = (userId, roles, institutionId) =>
  jwt.sign({ 
    userId: userId.toString(), 
    roles,
    institutionId: institutionId ? institutionId.toString() : undefined
  }, JWT_SECRET, { expiresIn: '1h' });

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
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      const status = res.status;
      const data = await res.json().catch(() => ({}));
      server.close(() => resolve({ status, data }));
    });
  });

const buildApp = (deptId, institutionId) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Attach effective roles and tenant for HOD permission checks
  app.use((req, res, next) => {
    req.tenantId = institutionId.toString();
    if (req.headers.authorization) {
      req.effectiveRoles = [
        { role: 'HOD', departmentId: deptId.toString() }
      ];
    }
    next();
  });

  app.use('/subjects', subjectRoute);
  app.use('/batches', batchRoute);
  app.use('/teaching-assignments', teachingRoute);
  return app;
};

async function run() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB');

  const institutionId = new mongoose.Types.ObjectId();
  const departmentId = new mongoose.Types.ObjectId();
  const hodUserId = new mongoose.Types.ObjectId();
  const faculty1Id = new mongoose.Types.ObjectId();
  const faculty2Id = new mongoose.Types.ObjectId();
  const student1Id = new mongoose.Types.ObjectId();
  const student2Id = new mongoose.Types.ObjectId();
  const student3Id = new mongoose.Types.ObjectId();
  const student4Id = new mongoose.Types.ObjectId();

  const hodToken = makeToken(hodUserId, ['HOD'], institutionId);

  // Clean test data
  await Subject.deleteMany({ departmentId });
  await Batch.deleteMany({ institutionId });
  await TeachingAssignment.deleteMany({ institutionId });
  await Section.deleteMany({ institutionId });
  await Semester.deleteMany({ departmentId });
  await Year.deleteMany({ departmentId });

  // 1. Seed Academic Structure
  const year = await Year.create({
    institutionId,
    departmentId,
    yearNumber: 2,
    name: 'Second Year'
  });

  const semester = await Semester.create({
    institutionId,
    yearId: year._id,
    departmentId,
    semesterNumber: 3,
    academicYear: '2026-2027',
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-12-15')
  });

  const sectionA = await Section.create({
    institutionId,
    semesterId: semester._id,
    name: 'Section A'
  });

  const app = buildApp(departmentId, institutionId);

  console.log('\n--- 1. Testing Subject Retrofit (type: lecture | lab) ---');
  // Lecture Subject (default type)
  const lecRes = await httpReq(app, 'POST', '/subjects', hodToken, {
    name: 'Data Structures',
    code: 'CS201',
    credits: 4
  });
  assert.strictEqual(lecRes.status, 201, 'Lecture subject creation should succeed');
  assert.strictEqual(lecRes.data.data.subject.type, 'lecture', 'Subject default type must be "lecture"');
  const lectureSubject = lecRes.data.data.subject;
  console.log('✔ Lecture subject created with default type: "lecture"');

  // Lab Subject (explicit type)
  const labRes = await httpReq(app, 'POST', '/subjects', hodToken, {
    name: 'Data Structures Lab',
    code: 'CS201L',
    credits: 2,
    type: 'lab'
  });
  assert.strictEqual(labRes.status, 201, 'Lab subject creation should succeed');
  assert.strictEqual(labRes.data.data.subject.type, 'lab', 'Subject type must be "lab"');
  const labSubject = labRes.data.data.subject;
  console.log('✔ Lab subject created with explicit type: "lab"');

  // Invalid type rejected
  const invRes = await httpReq(app, 'POST', '/subjects', hodToken, {
    name: 'Workshop',
    code: 'CS202',
    credits: 1,
    type: 'workshop'
  });
  assert.strictEqual(invRes.status, 400, 'Invalid subject type must return 400');
  console.log('✔ Invalid subject type correctly rejected with 400');

  console.log('\n--- 2. Testing Batch Schema and Lifecycle ---');
  // Create Batch 1
  const b1Res = await httpReq(app, 'POST', '/batches', hodToken, {
    sectionId: sectionA._id.toString(),
    name: 'Batch 1',
    studentIds: [student1Id.toString(), student2Id.toString()]
  });
  assert.strictEqual(b1Res.status, 201, 'Batch 1 creation should succeed');
  const batch1 = b1Res.data.data.batch;
  assert.strictEqual(batch1.name, 'Batch 1');
  assert.strictEqual(batch1.studentIds.length, 2);
  console.log('✔ Batch 1 created with 2 students');

  // Create Batch 2
  const b2Res = await httpReq(app, 'POST', '/batches', hodToken, {
    sectionId: sectionA._id.toString(),
    name: 'Batch 2',
    studentIds: [student3Id.toString(), student4Id.toString()]
  });
  assert.strictEqual(b2Res.status, 201, 'Batch 2 creation should succeed');
  const batch2 = b2Res.data.data.batch;
  assert.strictEqual(batch2.name, 'Batch 2');
  assert.strictEqual(batch2.studentIds.length, 2);
  console.log('✔ Batch 2 created with 2 students');

  // Reject duplicate batch name within section
  const dupBatchRes = await httpReq(app, 'POST', '/batches', hodToken, {
    sectionId: sectionA._id.toString(),
    name: 'Batch 1'
  });
  assert.strictEqual(dupBatchRes.status, 409, 'Duplicate batch in same section must return 409');
  console.log('✔ Duplicate batch name in same section rejected with 409');

  // List batches
  const listBRes = await httpReq(app, 'GET', `/batches?sectionId=${sectionA._id}`, hodToken);
  assert.strictEqual(listBRes.status, 200);
  assert.strictEqual(listBRes.data.data.batches.length, 2);
  console.log('✔ Listed batches filtered by sectionId');

  console.log('\n--- 3. Testing TeachingAssignment Retrofit ---');
  // Lab without batchId -> rejected
  const noBatchLabRes = await httpReq(app, 'POST', '/teaching-assignments', hodToken, {
    facultyId: faculty1Id.toString(),
    subjectId: labSubject._id.toString(),
    sectionId: sectionA._id.toString(),
    academicYearLabel: '2026-2027'
  });
  assert.strictEqual(noBatchLabRes.status, 400, 'Lab assignment without batchId must return 400');
  assert.ok(noBatchLabRes.data.error.includes('batchId is required for lab subjects'));
  console.log('✔ Lab assignment without batchId rejected with 400');

  // Lecture subject with or without batchId -> batchId forced to null
  const lecAssignRes = await httpReq(app, 'POST', '/teaching-assignments', hodToken, {
    facultyId: faculty1Id.toString(),
    subjectId: lectureSubject._id.toString(),
    sectionId: sectionA._id.toString(),
    batchId: batch1._id.toString(),
    academicYearLabel: '2026-2027'
  });
  assert.strictEqual(lecAssignRes.status, 201);
  assert.strictEqual(lecAssignRes.data.data.assignment.batchId, null, 'Lecture assignment batchId must be null');
  console.log('✔ Lecture assignment batchId strictly set to null');

  // Lab assignment to Faculty 1 for Batch 1
  const labAssign1Res = await httpReq(app, 'POST', '/teaching-assignments', hodToken, {
    facultyId: faculty1Id.toString(),
    subjectId: labSubject._id.toString(),
    sectionId: sectionA._id.toString(),
    batchId: batch1._id.toString(),
    academicYearLabel: '2026-2027'
  });
  assert.strictEqual(labAssign1Res.status, 201);
  assert.strictEqual(labAssign1Res.data.data.assignment.batchId, batch1._id.toString());
  console.log('✔ Faculty 1 assigned to Section A + Lab + Batch 1');

  // Lab assignment to Faculty 2 for Batch 2 (same subject + section, different batch & faculty)
  const labAssign2Res = await httpReq(app, 'POST', '/teaching-assignments', hodToken, {
    facultyId: faculty2Id.toString(),
    subjectId: labSubject._id.toString(),
    sectionId: sectionA._id.toString(),
    batchId: batch2._id.toString(),
    academicYearLabel: '2026-2027'
  });
  assert.strictEqual(labAssign2Res.status, 201);
  assert.strictEqual(labAssign2Res.data.data.assignment.batchId, batch2._id.toString());
  console.log('✔ Faculty 2 assigned to Section A + Lab + Batch 2 (multi-faculty lab support confirmed)');

  // Duplicate assignment check: Faculty 1 cannot be assigned again to Batch 1
  const dupLabAssignRes = await httpReq(app, 'POST', '/teaching-assignments', hodToken, {
    facultyId: faculty1Id.toString(),
    subjectId: labSubject._id.toString(),
    sectionId: sectionA._id.toString(),
    batchId: batch1._id.toString(),
    academicYearLabel: '2026-2027'
  });
  assert.strictEqual(dupLabAssignRes.status, 409, 'Duplicate assignment must return 409');
  console.log('✔ Duplicate assignment for same faculty + lab + batch rejected with 409');

  // Cannot delete batch while assigned
  const delBatchRes = await httpReq(app, 'DELETE', `/batches/${batch1._id}`, hodToken);
  assert.strictEqual(delBatchRes.status, 400, 'Cannot delete batch with active teaching assignments');
  console.log('✔ Cannot delete batch with active teaching assignments');

  console.log('\n🎉 ALL ACADEMIC-SERVICE LAB & BATCH TESTS PASSED!\n');

  // Cleanup
  await Subject.deleteMany({ departmentId });
  await Batch.deleteMany({ institutionId });
  await TeachingAssignment.deleteMany({ institutionId });
  await Section.deleteMany({ institutionId });
  await Semester.deleteMany({ departmentId });
  await Year.deleteMany({ departmentId });

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
