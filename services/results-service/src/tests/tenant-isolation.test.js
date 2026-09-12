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

const examTypeRoutes = require('../routes/examType.route');
const marksRoutes = require('../routes/marks.route');
const ExamType = require('../models/ExamType.model');
const MarksRecord = require('../models/MarksRecord.model');

describe('Phase 68: Results Service Tenant Isolation Tests', () => {
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
      if (authHeader === 'Bearer TENANT_A_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantAId };
        req.tenantId = tenantAId.toString();
      } else if (authHeader === 'Bearer TENANT_B_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantBId };
        req.tenantId = tenantBId.toString();
      }
      next();
    });

    app.use('/api/exam-types', examTypeRoutes);
    app.use('/api/marks', marksRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let examTypeA, examTypeB, marksRecordA, marksRecordB;

  beforeEach(async () => {
    await ExamType.deleteMany({});
    await MarksRecord.deleteMany({});

    const subjectA = new mongoose.Types.ObjectId();
    const subjectB = new mongoose.Types.ObjectId();

    examTypeA = await ExamType.create({
      subjectId: subjectA,
      type: 'midterm',
      maxMarks: 100,
      weightage: 0.3,
      institutionId: tenantAId,
    });

    examTypeB = await ExamType.create({
      subjectId: subjectB,
      type: 'midterm',
      maxMarks: 100,
      weightage: 0.3,
      institutionId: tenantBId,
    });

    marksRecordA = await MarksRecord.create({
      studentId: new mongoose.Types.ObjectId(),
      examTypeId: examTypeA._id,
      marksObtained: 85,
      enteredBy: new mongoose.Types.ObjectId(),
      institutionId: tenantAId,
    });

    marksRecordB = await MarksRecord.create({
      studentId: new mongoose.Types.ObjectId(),
      examTypeId: examTypeB._id,
      marksObtained: 90,
      enteredBy: new mongoose.Types.ObjectId(),
      institutionId: tenantBId,
    });
  });

  test('Tenant A cannot read Tenant B exam type by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/exam-types/${examTypeB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A listing exam types only returns Tenant A exam types', async () => {
    const res = await request(app)
      .get('/api/exam-types')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(examTypeA._id.toString());
  });

  test('Tenant A cannot read Tenant B marks record by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/marks/${marksRecordB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A listing marks records only returns Tenant A marks', async () => {
    const res = await request(app)
      .get('/api/marks')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(marksRecordA._id.toString());
  });
});
