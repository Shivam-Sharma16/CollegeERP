require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const assert = require('assert');

const sessionRoute = require('./routes/session.route');
const recordRoute = require('./routes/record.route');

const LectureSession = require('./models/LectureSession.model');
const AttendanceRecord = require('./models/AttendanceRecord.model');

const JWT_SECRET = 'test_attendance_lab_secret_p83';
process.env.JWT_ACCESS_SECRET = JWT_SECRET;

const makeToken = (userId, roles, institutionId) =>
  jwt.sign({ 
    userId: userId.toString(), 
    roles,
    institutionId: institutionId ? institutionId.toString() : undefined
  }, JWT_SECRET, { expiresIn: '1h' });

const httpReq = (app, method, url, token, body, tenantId) =>
  new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      const res = await fetch(`http://localhost:${port}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId.toString() } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      const status = res.status;
      const data = await res.json().catch(() => ({}));
      server.close(() => resolve({ status, data }));
    });
  });

const buildApp = (tenantId) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use((req, res, next) => {
    if (tenantId) req.tenantId = tenantId.toString();
    next();
  });

  app.use('/sessions', sessionRoute);
  app.use('/records', recordRoute);
  return app;
};

const GEOFENCE = { lat: 12.9716, lng: 77.5946, radiusMeters: 100 };

async function run() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB');

  const institutionId = new mongoose.Types.ObjectId();
  const sectionId = new mongoose.Types.ObjectId();
  const labSubjectId = new mongoose.Types.ObjectId();

  const faculty1Id = new mongoose.Types.ObjectId();
  const faculty2Id = new mongoose.Types.ObjectId();

  const studentS1 = new mongoose.Types.ObjectId();
  const studentS2 = new mongoose.Types.ObjectId();
  const studentS3 = new mongoose.Types.ObjectId();
  const studentS4 = new mongoose.Types.ObjectId();

  const faculty1Token = makeToken(faculty1Id, ['FACULTY'], institutionId);
  const faculty2Token = makeToken(faculty2Id, ['FACULTY'], institutionId);
  const student1Token = makeToken(studentS1, ['STUDENT'], institutionId);
  const student3Token = makeToken(studentS3, ['STUDENT'], institutionId);

  // Clean test data
  await LectureSession.deleteMany({ institutionId });
  await AttendanceRecord.deleteMany({ institutionId });
  await mongoose.connection.db.collection('batches').deleteMany({ institutionId });
  await mongoose.connection.db.collection('teachingassignments').deleteMany({ institutionId });

  // 1. Seed Batches
  const batch1Id = new mongoose.Types.ObjectId();
  const batch2Id = new mongoose.Types.ObjectId();

  await mongoose.connection.db.collection('batches').insertMany([
    {
      _id: batch1Id,
      institutionId,
      sectionId,
      name: 'Lab Batch 1',
      studentIds: [studentS1, studentS2],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: batch2Id,
      institutionId,
      sectionId,
      name: 'Lab Batch 2',
      studentIds: [studentS3, studentS4],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  console.log('✔ Seeded Batch 1 (students S1, S2) and Batch 2 (students S3, S4)');

  // 2. Seed TeachingAssignments for both faculty on different batches of the same lab
  const ta1Id = new mongoose.Types.ObjectId();
  const ta2Id = new mongoose.Types.ObjectId();

  await mongoose.connection.db.collection('teachingassignments').insertMany([
    {
      _id: ta1Id,
      institutionId,
      facultyId: faculty1Id,
      subjectId: labSubjectId,
      sectionId,
      batchId: batch1Id,
      academicYearLabel: '2026-2027',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: ta2Id,
      institutionId,
      facultyId: faculty2Id,
      subjectId: labSubjectId,
      sectionId,
      batchId: batch2Id,
      academicYearLabel: '2026-2027',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  console.log('✔ Seeded TeachingAssignments: Faculty 1 -> Batch 1; Faculty 2 -> Batch 2');

  const app = buildApp(institutionId);

  console.log('\n--- 1. Creating Simultaneous Lab Sessions for Different Batches ---');
  // Faculty 1 creates session for Batch 1
  const sess1Res = await httpReq(app, 'POST', '/sessions', faculty1Token, {
    teachingAssignmentId: ta1Id.toString(),
    date: new Date().toISOString(),
    timeSlot: '10:00 - 12:00',
    topic: 'Network Packet Sniffing Lab 1',
    geofence: GEOFENCE
  }, institutionId);
  assert.strictEqual(sess1Res.status, 201, 'Session 1 creation should succeed');
  const session1 = sess1Res.data.data.session;
  assert.strictEqual(session1.batchId, batch1Id.toString(), 'Session 1 must inherit batchId of Batch 1');
  console.log(`✔ Faculty 1 created Session 1 (inheriting Batch 1: ${session1.batchId})`);

  // Faculty 2 creates session for Batch 2 simultaneously
  const sess2Res = await httpReq(app, 'POST', '/sessions', faculty2Token, {
    teachingAssignmentId: ta2Id.toString(),
    date: new Date().toISOString(),
    timeSlot: '10:00 - 12:00',
    topic: 'Network Packet Sniffing Lab 2',
    geofence: GEOFENCE
  }, institutionId);
  assert.strictEqual(sess2Res.status, 201, 'Session 2 creation should succeed');
  const session2 = sess2Res.data.data.session;
  assert.strictEqual(session2.batchId, batch2Id.toString(), 'Session 2 must inherit batchId of Batch 2');
  console.log(`✔ Faculty 2 created Session 2 (inheriting Batch 2: ${session2.batchId})`);

  console.log('\n--- 2. Testing Check-in Pipeline & Strict Batch Isolation ---');
  // Case A: Student S1 (Batch 1) checks into Session 1 (Batch 1) -> SUCCEEDS
  const s1CheckinRes = await httpReq(app, 'POST', `/sessions/${session1._id}/checkin`, student1Token, {
    studentId: studentS1.toString(),
    qrToken: session1.qrTokenSecret,
    deviceFingerprint: 'dev-fp-s1',
    gpsCoords: { lat: 12.9716, lng: 77.5946 }
  }, institutionId);
  assert.strictEqual(s1CheckinRes.status, 201, 'Student S1 must be accepted in Batch 1 session');
  assert.strictEqual(s1CheckinRes.data.data.record.status, 'present');
  console.log('✔ Student S1 successfully checked into Session 1 (Batch 1)');

  // Case B: Student S3 (Batch 2) attempts to check into Session 1 (Batch 1) -> REJECTED with 403
  const s3CrossCheckinRes = await httpReq(app, 'POST', `/sessions/${session1._id}/checkin`, student3Token, {
    studentId: studentS3.toString(),
    qrToken: session1.qrTokenSecret,
    deviceFingerprint: 'dev-fp-s3',
    gpsCoords: { lat: 12.9716, lng: 77.5946 }
  }, institutionId);
  assert.strictEqual(s3CrossCheckinRes.status, 403, 'Cross-batch check-in must be rejected with 403');
  assert.ok(s3CrossCheckinRes.data.error.includes('Student is not eligible for this lab batch session'),
    'Expected ineligibility error message');
  console.log('✔ Cross-batch check-in attempt by Student S3 into Session 1 cleanly rejected with 403');

  // Case C: Student S3 (Batch 2) checks into Session 2 (Batch 2) -> SUCCEEDS
  const s3ValidCheckinRes = await httpReq(app, 'POST', `/sessions/${session2._id}/checkin`, student3Token, {
    studentId: studentS3.toString(),
    qrToken: session2.qrTokenSecret,
    deviceFingerprint: 'dev-fp-s3',
    gpsCoords: { lat: 12.9716, lng: 77.5946 }
  }, institutionId);
  assert.strictEqual(s3ValidCheckinRes.status, 201, 'Student S3 must be accepted in Batch 2 session');
  assert.strictEqual(s3ValidCheckinRes.data.data.record.status, 'present');
  console.log('✔ Student S3 successfully checked into Session 2 (Batch 2)');

  // Case D: Student S1 (Batch 1) attempts to check into Session 2 (Batch 2) -> REJECTED with 403
  const s1CrossCheckinRes = await httpReq(app, 'POST', `/sessions/${session2._id}/checkin`, student1Token, {
    studentId: studentS1.toString(),
    qrToken: session2.qrTokenSecret,
    deviceFingerprint: 'dev-fp-s1',
    gpsCoords: { lat: 12.9716, lng: 77.5946 }
  }, institutionId);
  assert.strictEqual(s1CrossCheckinRes.status, 403, 'Cross-batch check-in must be rejected with 403');
  assert.ok(s1CrossCheckinRes.data.error.includes('Student is not eligible for this lab batch session'));
  console.log('✔ Cross-batch check-in attempt by Student S1 into Session 2 cleanly rejected with 403');

  console.log('\n--- 3. Verifying Zero Cross-Batch Leakage ---');
  const session1Records = await AttendanceRecord.find({ lectureSessionId: session1._id });
  assert.strictEqual(session1Records.length, 1, 'Session 1 should have exactly 1 record');
  assert.strictEqual(session1Records[0].studentId.toString(), studentS1.toString(), 'Session 1 must only contain S1');

  const session2Records = await AttendanceRecord.find({ lectureSessionId: session2._id });
  assert.strictEqual(session2Records.length, 1, 'Session 2 should have exactly 1 record');
  assert.strictEqual(session2Records[0].studentId.toString(), studentS3.toString(), 'Session 2 must only contain S3');
  console.log('✔ Verified: Session 1 records isolated to Batch 1, Session 2 records isolated to Batch 2. Zero cross-batch leakage!');

  // Close sessions
  const close1Res = await httpReq(app, 'POST', `/sessions/${session1._id}/close`, faculty1Token, {}, institutionId);
  assert.strictEqual(close1Res.status, 200);
  assert.strictEqual(close1Res.data.data.summary.presentCount, 1);

  const close2Res = await httpReq(app, 'POST', `/sessions/${session2._id}/close`, faculty2Token, {}, institutionId);
  assert.strictEqual(close2Res.status, 200);
  assert.strictEqual(close2Res.data.data.summary.presentCount, 1);
  console.log('✔ Both lab sessions closed successfully');

  console.log('\n🎉 ALL ATTENDANCE-SERVICE LAB BATCH ISOLATION TESTS PASSED!\n');

  // Cleanup
  await LectureSession.deleteMany({ institutionId });
  await AttendanceRecord.deleteMany({ institutionId });
  await mongoose.connection.db.collection('batches').deleteMany({ institutionId });
  await mongoose.connection.db.collection('teachingassignments').deleteMany({ institutionId });

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
