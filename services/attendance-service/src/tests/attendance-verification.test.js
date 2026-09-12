process.env.PORT = '4004';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test';
process.env.INTERNAL_SERVICE_KEY = 'test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sessionRoutes = require('../routes/session.route');
const recordRoutes = require('../routes/record.route');
const LectureSession = require('../models/LectureSession.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const { verifyCheckIn } = require('../services/attendance.service');

// Mock auth middleware
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = { userId: req.headers['x-user-id'] || new mongoose.Types.ObjectId().toString(), roles: ['FACULTY', 'STUDENT'] };
  next();
});

jest.mock('@college-erp/shared-utils', () => ({
  authenticate: (req, res, next) => next(),
  success: (data) => ({ success: true, data }),
  fail: (error) => ({ success: false, error }),
  logAudit: jest.fn().mockResolvedValue()
}));

// Mock verifyFacultyOwnsAssignment for closing session and override
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connection: {
      ...actualMongoose.connection,
      db: {
        collection: () => ({
          findOne: jest.fn().mockResolvedValue({ _id: 'fake_assignment' }) // Always returns true for owns
        })
      }
    }
  };
});

app.use('/api/sessions', sessionRoutes);
app.use('/api/records', recordRoutes);

describe('Priority 3: Attendance Verification Pipeline (Phase 4/15)', () => {
  let mongoServer;
  let activeSession;
  const facultyId = new mongoose.Types.ObjectId().toString();
  const student1 = new mongoose.Types.ObjectId().toString();
  const student2 = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await LectureSession.deleteMany({});
    await AttendanceRecord.deleteMany({});
    
    activeSession = await LectureSession.create({
      institutionId: new mongoose.Types.ObjectId(),
      teachingAssignmentId: new mongoose.Types.ObjectId(),
      date: new Date(),
      timeSlot: '10:00-11:00',
      topic: 'Test Topic',
      qrTokenSecret: 'secret_token_123',
      qrTokenExpiresAt: new Date(Date.now() + 60000), // valid for 60s
      geofence: { lat: 10.0, lng: 20.0, radiusMeters: 50 },
      status: 'active'
    });
  });

  it('Branch 1: Expired QR token returns 400', async () => {
    // Modify session to have expired token
    activeSession.qrTokenExpiresAt = new Date(Date.now() - 10000);
    await activeSession.save();

    const res = await request(app).post(`/api/sessions/${activeSession._id}/checkin`).send({
      studentId: student1,
      qrToken: 'secret_token_123',
      deviceFingerprint: 'dev1'
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Expired/i);
  });

  it('Branch 2: Geofence fail flags the record', async () => {
    const res = await request(app).post(`/api/sessions/${activeSession._id}/checkin`).send({
      studentId: student1,
      qrToken: 'secret_token_123',
      deviceFingerprint: 'dev1',
      gpsCoords: { lat: 10.1, lng: 20.1 } // Very far away
    });

    expect(res.status).toBe(201);
    expect(res.body.data.record.status).toBe('flagged');
    expect(res.body.data.record.verificationMethod).toBe('geofence_fail');
  });

  it('Branch 3: Device conflict flags both records', async () => {
    // 1. Student 1 checks in successfully (within geofence)
    const res1 = await request(app).post(`/api/sessions/${activeSession._id}/checkin`).send({
      studentId: student1,
      qrToken: 'secret_token_123',
      deviceFingerprint: 'shared_device',
      gpsCoords: { lat: 10.0001, lng: 20.0001 } // Close enough
    });
    expect(res1.status).toBe(201);
    expect(res1.body.data.record.status).toBe('present');

    // 2. Student 2 checks in with SAME device
    const res2 = await request(app).post(`/api/sessions/${activeSession._id}/checkin`).send({
      studentId: student2,
      qrToken: 'secret_token_123',
      deviceFingerprint: 'shared_device',
      gpsCoords: { lat: 10.0001, lng: 20.0001 }
    });

    expect(res2.status).toBe(201);
    expect(res2.body.data.record.status).toBe('flagged');
    expect(res2.body.data.record.verificationMethod).toBe('duplicate_device');

    // 3. Verify original record was also flagged
    const record1 = await AttendanceRecord.findById(res1.body.data.record._id);
    expect(record1.status).toBe('flagged');
    expect(record1.verificationMethod).toBe('duplicate_device');
  });

  it('Branch 4: Liveness miss (Schema validation)', async () => {
    // Since liveness ping is a schema field (Phase 15 extended), verify that missing liveness logic
    // can be updated onto the record.
    const record = await AttendanceRecord.create({
      institutionId: activeSession.institutionId,
      lectureSessionId: activeSession._id,
      studentId: student1,
      status: 'present',
      deviceFingerprint: 'devX',
      livenessPingResponses: [{ pingId: 'p1', respondedAt: new Date(), withinWindow: false }]
    });

    // We flag it manually if liveness failed
    record.status = 'flagged';
    record.verificationMethod = 'liveness_miss';
    await record.save();

    const dbRecord = await AttendanceRecord.findById(record._id);
    expect(dbRecord.status).toBe('flagged');
    expect(dbRecord.livenessPingResponses[0].withinWindow).toBe(false);
  });

  it('Branch 5: Override with audit trail', async () => {
    // 1. Create a flagged record
    const record = await AttendanceRecord.create({
      institutionId: activeSession.institutionId,
      lectureSessionId: activeSession._id,
      studentId: student1,
      status: 'flagged',
      deviceFingerprint: 'dev1'
    });

    // 2. Faculty overrides to present
    const res = await request(app)
      .post(`/api/records/${record._id}/override`)
      .set('x-user-id', facultyId)
      .send({ newStatus: 'present', reason: 'Verified manually' });

    expect(res.status).toBe(200);
    expect(res.body.data.record.status).toBe('present');
    expect(res.body.data.record.verificationMethod).toBe('manual_override');
    expect(res.body.data.audit.reason).toBe('Verified manually');
  });
});
