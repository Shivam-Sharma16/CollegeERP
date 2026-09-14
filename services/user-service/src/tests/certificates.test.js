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

jest.setTimeout(30000);

const certificateRoutes = require('../routes/certificate.route');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const Department = require('../models/Department.model');
const Institution = require('../models/Institution.model');

let mongoServer;
const app = express();
app.use(express.json());

const testInstId = new mongoose.Types.ObjectId();

let currentMockUser = null;
app.use((req, res, next) => {
  if (currentMockUser) {
    req.user = currentMockUser;
    req.tenantId = currentMockUser.institutionId || testInstId;
  }
  next();
});

app.use('/certificates', certificateRoutes);
app.use('/api/certificates', certificateRoutes);

describe('PHASE 79 — Certificates (Bonafide & Transfer)', () => {
  let testStudent, testDept, testInst;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    testInst = await Institution.create({
      _id: testInstId,
      name: 'Apex Institute of Technology',
      subdomain: 'apex-tech',
      branding: {
        primaryColor: '#0284c7',
        secondaryColor: '#38bdf8'
      }
    });

    testDept = await Department.create({
      name: 'Information Technology',
      code: 'IT',
      institutionId: testInstId
    });

    testStudent = await User.create({
      name: 'Priya Sharma',
      email: 'priya@example.com',
      rollNumber: 'IT202401',
      passwordHash: 'hash',
      institutionId: testInstId
    });

    await RoleAssignment.create({
      userId: testStudent._id,
      role: 'STUDENT',
      departmentId: testDept._id,
      institutionId: testInstId
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('generates a Bonafide Certificate PDF with institution branding', async () => {
    currentMockUser = {
      userId: testStudent._id.toString(),
      id: testStudent._id.toString(),
      roles: ['STUDENT'],
      institutionId: testInstId
    };

    const res = await request(app)
      .post('/certificates/bonafide')
      .send({ studentId: testStudent._id.toString() });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/bonafide-IT202401\.pdf/);

    // Verify PDF header magic bytes %PDF
    const pdfHeader = res.body.slice(0, 4).toString('utf-8');
    expect(pdfHeader).toBe('%PDF');
  });

  it('generates a Transfer Certificate PDF with institution branding', async () => {
    currentMockUser = {
      userId: testStudent._id.toString(),
      id: testStudent._id.toString(),
      roles: ['STUDENT'],
      institutionId: testInstId
    };

    const res = await request(app)
      .post('/certificates/transfer')
      .send({ studentId: testStudent._id.toString() });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/transfer-IT202401\.pdf/);

    // Verify PDF magic bytes
    const pdfHeader = res.body.slice(0, 4).toString('utf-8');
    expect(pdfHeader).toBe('%PDF');
  });
});
