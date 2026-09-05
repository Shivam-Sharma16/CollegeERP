require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const sessionRoute = require('./routes/session.route');
const recordRoute  = require('./routes/record.route');

const LectureSession  = require('./models/LectureSession.model');
const AttendanceRecord = require('./models/AttendanceRecord.model');

const JWT_SECRET = 'test_attendance_secret_p15';
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
        body: body !== undefined ? JSON.stringify(body) : undefined
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
  app.use('/sessions', sessionRoute);
  app.use('/records',  recordRoute);
  return app;
};

const GEOFENCE = { lat: 12.9716, lng: 77.5946, radiusMeters: 100 };

async function run() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college-erp-dev')
    .replace('mongodb://mongo:', 'mongodb://127.0.0.1:');
  await mongoose.connect(uri);
  console.log('✔ Connected to MongoDB\n');

  await LectureSession.deleteMany({});
  await AttendanceRecord.deleteMany({});
  await mongoose.connection.db.collection('teachingassignments').deleteMany({});
  await mongoose.connection.db.collection('auditlogs').deleteMany({ action: /ATTENDANCE|SESSION/ });

  // Seed two faculty users and their teaching assignments
  const faculty1Id = new mongoose.Types.ObjectId();
  const faculty2Id = new mongoose.Types.ObjectId();
  const sectionId  = new mongoose.Types.ObjectId();
  const subjectId  = new mongoose.Types.ObjectId();
  const studentId  = new mongoose.Types.ObjectId();

  const ta = await mongoose.connection.db.collection('teachingassignments').insertOne({
    facultyId: faculty1Id,
    subjectId,
    sectionId,
    academicYearLabel: '2024-25'
  });
  const taId = ta.insertedId.toString();

  const f1Token = makeToken(faculty1Id, ['FACULTY']);
  const f2Token = makeToken(faculty2Id, ['FACULTY']);
  const stToken = makeToken(studentId,  ['STUDENT']);

  const app = buildApp();
  let passed = 0, failed = 0;

  const assert = (label, condition) => {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else           { console.error(`  ❌ ${label}`); failed++; }
  };

  // ─── Block 1: Faculty 1 creates a session ──────────────────────────────────
  console.log('--- Block 1: Create Session ---');
  const r1 = await httpReq(app, 'POST', '/sessions', f1Token, {
    teachingAssignmentId: taId,
    date: new Date().toISOString(),
    timeSlot: '09:00-10:00',
    topic: 'Sorting Algorithms',
    geofence: GEOFENCE
  });
  assert('Faculty 1 creates session (201)', r1.status === 201);
  const sessionId = r1.data?.data?.session?._id;
  const firstQR = r1.data?.data?.session?.qrTokenSecret;
  assert('Session is active', r1.data?.data?.session?.status === 'active');
  assert('Initial QR token returned', !!firstQR);

  // ─── Block 2: Faculty 2 cannot create session with Faculty 1's assignment ──
  console.log('\n--- Block 2: Wrong Faculty Creates Session ---');
  const r2 = await httpReq(app, 'POST', '/sessions', f2Token, {
    teachingAssignmentId: taId,
    date: new Date().toISOString(),
    timeSlot: '10:00-11:00',
    geofence: GEOFENCE
  });
  assert('Faculty 2 rejected for Faculty 1\'s teaching assignment (403)', r2.status === 403);

  // ─── Block 3: QR rotation returns a different token each call ───────────────
  console.log('\n--- Block 3: QR Token Rotation ---');
  const r3a = await httpReq(app, 'GET', `/sessions/${sessionId}/qr`, f1Token);
  assert('QR rotation returns 200', r3a.status === 200);
  const rotatedQR1 = r3a.data?.data?.qrToken;

  const r3b = await httpReq(app, 'GET', `/sessions/${sessionId}/qr`, f1Token);
  const rotatedQR2 = r3b.data?.data?.qrToken;
  assert('Consecutive QR calls return different tokens', rotatedQR1 !== rotatedQR2);

  // ─── Block 4: Check-in with valid (latest) QR token → present ───────────────
  console.log('\n--- Block 4: Valid Check-In ---');
  // First rotate to get the latest valid token
  const r4pre = await httpReq(app, 'GET', `/sessions/${sessionId}/qr`, f1Token);
  const currentQR = r4pre.data?.data?.qrToken;

  const r4 = await httpReq(app, 'POST', `/sessions/${sessionId}/checkin`, stToken, {
    studentId: studentId.toString(),
    qrToken: currentQR,
    deviceFingerprint: 'device-abc-123',
    gpsCoords: { lat: 12.9716, lng: 77.5946 } // Within geofence
  });
  assert('Check-in with valid QR returns 201', r4.status === 201);
  assert('Record status is present', r4.data?.data?.record?.status === 'present');
  const recordId = r4.data?.data?.record?._id;

  // ─── Block 5: Check-in with stale/wrong QR token is rejected ────────────────
  console.log('\n--- Block 5: Stale QR Check-In ---');
  // Rotate again to invalidate currentQR
  await httpReq(app, 'GET', `/sessions/${sessionId}/qr`, f1Token);

  const r5 = await httpReq(app, 'POST', `/sessions/${sessionId}/checkin`, stToken, {
    studentId: new mongoose.Types.ObjectId().toString(),
    qrToken: currentQR, // Now stale
    deviceFingerprint: 'device-xyz-456',
    gpsCoords: { lat: 12.9716, lng: 77.5946 }
  });
  assert('Stale QR token rejected (400)', r5.status === 400);

  // ─── Block 6: Override attendance → AuditLog written ────────────────────────
  console.log('\n--- Block 6: Attendance Override with AuditLog ---');
  const r6 = await httpReq(app, 'POST', `/records/${recordId}/override`, f1Token, {
    newStatus: 'absent',
    reason: 'Student left early and re-entered — manual correction'
  });
  assert('Override returns 200', r6.status === 200);
  assert('Record updated to absent', r6.data?.data?.record?.status === 'absent');
  assert('Audit includes oldStatus=present', r6.data?.data?.audit?.oldStatus === 'present');
  assert('Audit includes newStatus=absent', r6.data?.data?.audit?.newStatus === 'absent');

  const auditEntry = await mongoose.connection.db.collection('auditlogs')
    .findOne({ action: 'ATTENDANCE_OVERRIDE' });
  assert('AuditLog written for ATTENDANCE_OVERRIDE', !!auditEntry);
  assert('AuditLog captures oldStatus', auditEntry?.details?.oldStatus === 'present');
  assert('AuditLog captures newStatus', auditEntry?.details?.newStatus === 'absent');
  assert('AuditLog captures overriddenBy faculty', auditEntry?.details?.overriddenBy === faculty1Id.toString());

  // ─── Block 7: Close session — check-ins blocked after ───────────────────────
  console.log('\n--- Block 7: Close Session ---');
  const r7 = await httpReq(app, 'POST', `/sessions/${sessionId}/close`, f1Token);
  assert('Faculty closes session (200)', r7.status === 200);
  assert('Summary includes totalRecords', typeof r7.data?.data?.summary?.totalRecords === 'number');

  const r7b = await httpReq(app, 'POST', `/sessions/${sessionId}/checkin`, stToken, {
    studentId: new mongoose.Types.ObjectId().toString(),
    qrToken: 'any-token',
    deviceFingerprint: 'device-after-close',
    gpsCoords: { lat: 12.9716, lng: 77.5946 }
  });
  assert('Check-in on closed session rejected (400)', r7b.status === 400);

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
