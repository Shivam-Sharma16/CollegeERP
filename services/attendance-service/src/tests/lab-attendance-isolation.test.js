process.env.PORT = '4004';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test-attendance-lab-batches';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test';
process.env.INTERNAL_SERVICE_KEY = 'test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

jest.mock('@college-erp/shared-utils', () => ({
  authenticate: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  setupSecurity: () => {},
  success: (data) => ({ success: true, data }),
  fail: (error) => ({ success: false, error }),
  logAudit: jest.fn().mockResolvedValue()
}));

jest.setTimeout(30000);

const sessionRoutes = require('../routes/session.route');
const recordRoutes = require('../routes/record.route');

const LectureSession = require('../models/LectureSession.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');

describe('PHASE 83 — Simultaneous Lab Sessions & Zero Cross-Batch Leakage [attendance-service]', () => {
  let app;
  const institutionId = new mongoose.Types.ObjectId();
  const sectionId = new mongoose.Types.ObjectId();
  const labSubjectId = new mongoose.Types.ObjectId();

  const faculty1Id = new mongoose.Types.ObjectId().toString();
  const faculty2Id = new mongoose.Types.ObjectId().toString();

  const studentS1 = new mongoose.Types.ObjectId().toString();
  const studentS2 = new mongoose.Types.ObjectId().toString();
  const studentS3 = new mongoose.Types.ObjectId().toString();
  const studentS4 = new mongoose.Types.ObjectId().toString();

  const batch1Id = new mongoose.Types.ObjectId();
  const batch2Id = new mongoose.Types.ObjectId();

  const ta1Id = new mongoose.Types.ObjectId();
  const ta2Id = new mongoose.Types.ObjectId();

  let session1;
  let session2;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/test-attendance-lab-batches';
    await mongoose.connect(mongoUri);

    // Clean test collections
    await LectureSession.deleteMany({ institutionId });
    await AttendanceRecord.deleteMany({ institutionId });
    await mongoose.connection.db.collection('batches').deleteMany({ institutionId });
    await mongoose.connection.db.collection('teachingassignments').deleteMany({ institutionId });

    // Seed Batches
    await mongoose.connection.db.collection('batches').insertMany([
      {
        _id: batch1Id,
        institutionId,
        sectionId,
        name: 'Lab Batch 1',
        studentIds: [new mongoose.Types.ObjectId(studentS1), new mongoose.Types.ObjectId(studentS2)],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: batch2Id,
        institutionId,
        sectionId,
        name: 'Lab Batch 2',
        studentIds: [new mongoose.Types.ObjectId(studentS3), new mongoose.Types.ObjectId(studentS4)],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Seed TeachingAssignments (Faculty 1 -> Batch 1, Faculty 2 -> Batch 2)
    await mongoose.connection.db.collection('teachingassignments').insertMany([
      {
        _id: ta1Id,
        institutionId,
        facultyId: new mongoose.Types.ObjectId(faculty1Id),
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
        facultyId: new mongoose.Types.ObjectId(faculty2Id),
        subjectId: labSubjectId,
        sectionId,
        batchId: batch2Id,
        academicYearLabel: '2026-2027',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    app = express();
    app.use(express.json());

    // Middleware simulating authentication & tenant
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      const callerId = authHeader ? authHeader.replace('Bearer ', '') : faculty1Id;
      req.user = {
        userId: callerId,
        roles: ['FACULTY', 'STUDENT'],
        institutionId
      };
      req.tenantId = institutionId.toString();
      next();
    });

    app.use('/sessions', sessionRoutes);
    app.use('/records', recordRoutes);
  });

  afterAll(async () => {
    await LectureSession.deleteMany({ institutionId });
    await AttendanceRecord.deleteMany({ institutionId });
    await mongoose.connection.db.collection('batches').deleteMany({ institutionId });
    await mongoose.connection.db.collection('teachingassignments').deleteMany({ institutionId });
    await mongoose.disconnect();
  });

  it('Faculty 1 creates Session 1 for Batch 1 and inherits batchId', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${faculty1Id}`)
      .send({
        teachingAssignmentId: ta1Id.toString(),
        date: new Date().toISOString(),
        timeSlot: '10:00 - 12:00',
        topic: 'Network Lab 1',
        geofence: { lat: 12.9716, lng: 77.5946, radiusMeters: 100 }
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.batchId).toBe(batch1Id.toString());
    session1 = res.body.data.session;
  });

  it('Faculty 2 simultaneously creates Session 2 for Batch 2 and inherits batchId', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${faculty2Id}`)
      .send({
        teachingAssignmentId: ta2Id.toString(),
        date: new Date().toISOString(),
        timeSlot: '10:00 - 12:00',
        topic: 'Network Lab 2',
        geofence: { lat: 12.9716, lng: 77.5946, radiusMeters: 100 }
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.batchId).toBe(batch2Id.toString());
    session2 = res.body.data.session;
  });

  it('Student S1 (Batch 1) checks into Session 1 (Batch 1) successfully', async () => {
    const res = await request(app)
      .post(`/sessions/${session1._id}/checkin`)
      .set('Authorization', `Bearer ${studentS1}`)
      .send({
        studentId: studentS1,
        qrToken: session1.qrTokenSecret,
        deviceFingerprint: 'dev-fp-s1',
        gpsCoords: { lat: 12.9716, lng: 77.5946 }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.record.status).toBe('present');
  });

  it('Student S3 (Batch 2) attempting to check into Session 1 (Batch 1) is rejected with 403', async () => {
    const res = await request(app)
      .post(`/sessions/${session1._id}/checkin`)
      .set('Authorization', `Bearer ${studentS3}`)
      .send({
        studentId: studentS3,
        qrToken: session1.qrTokenSecret,
        deviceFingerprint: 'dev-fp-s3',
        gpsCoords: { lat: 12.9716, lng: 77.5946 }
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Student is not eligible for this lab batch session/i);
  });

  it('Student S3 (Batch 2) checks into Session 2 (Batch 2) successfully', async () => {
    const res = await request(app)
      .post(`/sessions/${session2._id}/checkin`)
      .set('Authorization', `Bearer ${studentS3}`)
      .send({
        studentId: studentS3,
        qrToken: session2.qrTokenSecret,
        deviceFingerprint: 'dev-fp-s3',
        gpsCoords: { lat: 12.9716, lng: 77.5946 }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.record.status).toBe('present');
  });

  it('Student S1 (Batch 1) attempting to check into Session 2 (Batch 2) is rejected with 403', async () => {
    const res = await request(app)
      .post(`/sessions/${session2._id}/checkin`)
      .set('Authorization', `Bearer ${studentS1}`)
      .send({
        studentId: studentS1,
        qrToken: session2.qrTokenSecret,
        deviceFingerprint: 'dev-fp-s1',
        gpsCoords: { lat: 12.9716, lng: 77.5946 }
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Student is not eligible for this lab batch session/i);
  });

  it('Guarantees zero cross-batch leakage between the two simultaneous sessions', async () => {
    const session1Records = await AttendanceRecord.find({ lectureSessionId: session1._id });
    expect(session1Records).toHaveLength(1);
    expect(session1Records[0].studentId.toString()).toBe(studentS1);

    const session2Records = await AttendanceRecord.find({ lectureSessionId: session2._id });
    expect(session2Records).toHaveLength(1);
    expect(session2Records[0].studentId.toString()).toBe(studentS3);
  });
});
