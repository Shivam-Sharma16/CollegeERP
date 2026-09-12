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

const noticeRoutes = require('../routes/notice.route');
const Notice = require('../models/Notice.model');
const Note = require('../models/Note.model');

describe('Phase 68: Notice Service Tenant Isolation Tests', () => {
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
        req.callerScope = { role: 'ADMIN', departmentIds: [], sectionIds: [] };
      } else if (authHeader === 'Bearer TENANT_B_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantBId };
        req.tenantId = tenantBId.toString();
        req.callerScope = { role: 'ADMIN', departmentIds: [], sectionIds: [] };
      }
      next();
    });

    app.use('/api', noticeRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let noticeA, noticeB, noteA, noteB;

  beforeEach(async () => {
    await Notice.deleteMany({});
    await Note.deleteMany({});

    noticeA = await Notice.create({
      title: 'Tenant A Notice',
      body: 'Welcome to Tenant A',
      createdBy: new mongoose.Types.ObjectId(),
      institutionId: tenantAId,
    });

    noticeB = await Notice.create({
      title: 'Tenant B Notice',
      body: 'Welcome to Tenant B',
      createdBy: new mongoose.Types.ObjectId(),
      institutionId: tenantBId,
    });

    noteA = await Note.create({
      subjectId: new mongoose.Types.ObjectId(),
      fileUrl: 'https://example.com/noteA.pdf',
      uploadedBy: new mongoose.Types.ObjectId(),
      institutionId: tenantAId,
    });

    noteB = await Note.create({
      subjectId: new mongoose.Types.ObjectId(),
      fileUrl: 'https://example.com/noteB.pdf',
      uploadedBy: new mongoose.Types.ObjectId(),
      institutionId: tenantBId,
    });
  });

  test('Tenant A cannot read Tenant B notice by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/notices/${noticeB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A cannot read Tenant B note by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/notes/${noteB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A listing notes only returns Tenant A notes', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(noteA._id.toString());
  });

  test('Tenant A user only sees Tenant A notices in mine feed', async () => {
    const res = await request(app)
      .get('/api/notices/mine')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(noticeA._id.toString());
  });
});
