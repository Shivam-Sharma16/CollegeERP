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

const subjectRoutes = require('../routes/subject.route');
const yearRoutes = require('../routes/year.route');
const semesterRoutes = require('../routes/semester.route');
const sectionRoutes = require('../routes/section.route');

const Subject = require('../models/Subject.model');
const Year = require('../models/Year.model');
const Semester = require('../models/Semester.model');
const Section = require('../models/Section.model');

describe('Phase 68: Academic Service Tenant Isolation Tests', () => {
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

    app.use('/api/subjects', subjectRoutes);
    app.use('/api/years', yearRoutes);
    app.use('/api/semesters', semesterRoutes);
    app.use('/api/sections', sectionRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let subA, subB, yearA, yearB, semA, semB, secA, secB;

  beforeEach(async () => {
    await Subject.deleteMany({});
    await Year.deleteMany({});
    await Semester.deleteMany({});
    await Section.deleteMany({});

    const deptA = new mongoose.Types.ObjectId();
    const deptB = new mongoose.Types.ObjectId();

    subA = await Subject.create({
      code: 'CS101',
      name: 'Intro to CS',
      credits: 4,
      departmentId: deptA,
      institutionId: tenantAId,
    });

    subB = await Subject.create({
      code: 'CS101', // Identical code allowed across tenants
      name: 'Intro to CS',
      credits: 4,
      departmentId: deptB,
      institutionId: tenantBId,
    });

    yearA = await Year.create({
      departmentId: deptA,
      yearNumber: 1,
      institutionId: tenantAId,
    });

    yearB = await Year.create({
      departmentId: deptB,
      yearNumber: 1,
      institutionId: tenantBId,
    });

    semA = await Semester.create({
      yearId: yearA._id,
      departmentId: deptA,
      semesterNumber: 1,
      institutionId: tenantAId,
    });

    semB = await Semester.create({
      yearId: yearB._id,
      departmentId: deptB,
      semesterNumber: 1,
      institutionId: tenantBId,
    });

    secA = await Section.create({
      semesterId: semA._id,
      name: 'Section A',
      institutionId: tenantAId,
    });

    secB = await Section.create({
      semesterId: semB._id,
      name: 'Section A',
      institutionId: tenantBId,
    });
  });

  test('Tenant A cannot read Tenant B subject by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/subjects/${subB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A listing subjects only returns Tenant A subjects', async () => {
    const res = await request(app)
      .get('/api/subjects')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    const subjects = res.body.data.subjects || res.body.data;
    expect(subjects.length).toBe(1);
    expect(subjects[0]._id.toString()).toBe(subA._id.toString());
  });

  test('Tenant A cannot read Tenant B year by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/years/${yearB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A cannot read Tenant B semester by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/semesters/${semB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A cannot read Tenant B section by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/sections/${secB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
  });

  test('Tenant A cannot delete Tenant B section (returns 404)', async () => {
    const res = await request(app)
      .delete(`/api/sections/${secB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
    const untouched = await Section.findById(secB._id);
    expect(untouched).not.toBeNull();
  });
});
