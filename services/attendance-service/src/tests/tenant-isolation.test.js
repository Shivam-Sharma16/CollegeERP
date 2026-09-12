process.env.PORT = '4004';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test';
process.env.INTERNAL_SERVICE_KEY = 'test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('@college-erp/shared-utils', () => ({
  authenticate: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  success: (data) => ({ success: true, data }),
  fail: (error) => ({ success: false, error }),
  logAudit: jest.fn().mockResolvedValue()
}));

const sessionRoutes = require('../routes/session.route');
const recordRoutes = require('../routes/record.route');
const LectureSession = require('../models/LectureSession.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');

describe('Phase 68: Attendance Service Tenant Isolation Tests', () => {
  let mongoServer;
  let app;
  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader === 'Bearer TENANT_A_FACULTY') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['FACULTY'], institutionId: tenantAId };
        req.tenantId = tenantAId.toString();
      } else if (authHeader === 'Bearer TENANT_B_FACULTY') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['FACULTY'], institutionId: tenantBId };
        req.tenantId = tenantBId.toString();
      }
      next();
    });

    app.use('/api/sessions', sessionRoutes);
    app.use('/api/attendance', recordRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let sessionA, sessionB, recordA, recordB;

  beforeEach(async () => {
    await LectureSession.deleteMany({});
    await AttendanceRecord.deleteMany({});

    sessionA = await LectureSession.create({
      teachingAssignmentId: new mongoose.Types.ObjectId(),
      date: new Date(),
      timeSlot: '09:00 - 10:00',
      status: 'active',
      qrTokenSecret: 'secretA',
      qrTokenExpiresAt: new Date(Date.now() + 60000),
      geofence: { lat: 26.9, lng: 75.8, radiusMeters: 50 },
      institutionId: tenantAId,
    });

    sessionB = await LectureSession.create({
      teachingAssignmentId: new mongoose.Types.ObjectId(),
      date: new Date(),
      timeSlot: '09:00 - 10:00',
      status: 'active',
      qrTokenSecret: 'secretB',
      qrTokenExpiresAt: new Date(Date.now() + 60000),
      geofence: { lat: 26.9, lng: 75.8, radiusMeters: 50 },
      institutionId: tenantBId,
    });

    recordA = await AttendanceRecord.create({
      lectureSessionId: sessionA._id,
      studentId: new mongoose.Types.ObjectId(),
      status: 'present',
      deviceFingerprint: 'fpA',
      institutionId: tenantAId,
    });

    recordB = await AttendanceRecord.create({
      lectureSessionId: sessionB._id,
      studentId: new mongoose.Types.ObjectId(),
      status: 'present',
      deviceFingerprint: 'fpB',
      institutionId: tenantBId,
    });
  });

  test('Tenant A faculty cannot read Tenant B session by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/sessions/${sessionB._id}`)
      .set('Authorization', 'Bearer TENANT_A_FACULTY');

    expect(res.status).toBe(404);
  });

  test('Tenant A faculty cannot close Tenant B session (returns 404)', async () => {
    const res = await request(app)
      .patch(`/api/sessions/${sessionB._id}/close`)
      .set('Authorization', 'Bearer TENANT_A_FACULTY');

    expect(res.status).toBe(404);
    const untouched = await LectureSession.findById(sessionB._id);
    expect(untouched.status).toBe('active');
  });

  test('Tenant A cannot read Tenant B attendance record by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/attendance/records/${recordB._id}`)
      .set('Authorization', 'Bearer TENANT_A_FACULTY');

    expect(res.status).toBe(404);
  });

  test('Tenant A cannot override Tenant B attendance record (returns 404)', async () => {
    const res = await request(app)
      .patch(`/api/attendance/records/${recordB._id}/override`)
      .set('Authorization', 'Bearer TENANT_A_FACULTY')
      .send({ status: 'absent', reason: 'Malicious override attempt' });

    expect(res.status).toBe(404);
    const untouched = await AttendanceRecord.findById(recordB._id);
    expect(untouched.status).toBe('present');
  });
});
