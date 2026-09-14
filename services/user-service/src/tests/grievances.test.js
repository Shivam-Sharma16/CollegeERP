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

const grievanceRoutes = require('../routes/grievance.route');
const Grievance = require('../models/Grievance.model');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const Department = require('../models/Department.model');

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

app.use('/grievances', grievanceRoutes);
app.use('/api/grievances', grievanceRoutes);

describe('PHASE 79 — Grievances Lifecycle & Scoping', () => {
  let student1, student2, hodUser, adminUser;
  let csDept, ecDept;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    csDept = await Department.create({ name: 'Computer Science', code: 'CS', institutionId: testInstId });
    ecDept = await Department.create({ name: 'Electronics', code: 'EC', institutionId: testInstId });

    student1 = await User.create({
      name: 'Student One',
      email: 's1@test.com',
      passwordHash: 'hash',
      institutionId: testInstId
    });
    await RoleAssignment.create({
      userId: student1._id,
      role: 'STUDENT',
      departmentId: csDept._id,
      institutionId: testInstId
    });

    student2 = await User.create({
      name: 'Student Two',
      email: 's2@test.com',
      passwordHash: 'hash',
      institutionId: testInstId
    });
    await RoleAssignment.create({
      userId: student2._id,
      role: 'STUDENT',
      departmentId: ecDept._id,
      institutionId: testInstId
    });

    hodUser = await User.create({
      name: 'CS HOD',
      email: 'hod.cs@test.com',
      passwordHash: 'hash',
      institutionId: testInstId
    });
    await RoleAssignment.create({
      userId: hodUser._id,
      role: 'HOD',
      departmentId: csDept._id,
      institutionId: testInstId
    });

    adminUser = await User.create({
      name: 'Institute Admin',
      email: 'admin@test.com',
      passwordHash: 'hash',
      institutionId: testInstId
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Grievance.deleteMany({});
  });

  it('student raises grievance and can only view their own grievances', async () => {
    // Student 1 logs in
    currentMockUser = {
      userId: student1._id.toString(),
      id: student1._id.toString(),
      roles: ['STUDENT'],
      institutionId: testInstId
    };

    // Raise grievance
    const createRes = await request(app)
      .post('/grievances')
      .send({
        category: 'academic',
        title: 'Missing Lecture Notes',
        description: 'Need notes for module 3'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.status).toBe('open');
    expect(createRes.body.data.departmentId.toString()).toBe(csDept._id.toString());

    // Student 1 views grievances -> sees 1
    const listRes1 = await request(app).get('/grievances');
    expect(listRes1.status).toBe(200);
    expect(listRes1.body.data).toHaveLength(1);
    expect(listRes1.body.data[0].title).toBe('Missing Lecture Notes');

    // Student 2 logs in -> views grievances -> sees 0
    currentMockUser = {
      userId: student2._id.toString(),
      id: student2._id.toString(),
      roles: ['STUDENT'],
      institutionId: testInstId
    };

    const listRes2 = await request(app).get('/grievances');
    expect(listRes2.status).toBe(200);
    expect(listRes2.body.data).toHaveLength(0);

    // Student 2 tries to view Student 1's grievance by ID -> 403 Forbidden
    const getRes = await request(app).get(`/grievances/${createRes.body.data._id}`);
    expect(getRes.status).toBe(403);
  });

  it('HOD sees grievances within their department scope and can resolve them', async () => {
    // Create grievance under CS department by Student 1
    const gCs = await Grievance.create({
      institutionId: testInstId,
      raisedBy: student1._id,
      departmentId: csDept._id,
      category: 'facility',
      description: 'Lab 2 projector broken',
      status: 'open'
    });

    // Create grievance under EC department by Student 2
    const gEc = await Grievance.create({
      institutionId: testInstId,
      raisedBy: student2._id,
      departmentId: ecDept._id,
      category: 'academic',
      description: 'Exam scheduling conflict',
      status: 'open'
    });

    // CS HOD logs in
    currentMockUser = {
      userId: hodUser._id.toString(),
      id: hodUser._id.toString(),
      roles: ['HOD'],
      institutionId: testInstId
    };

    const listRes = await request(app).get('/grievances');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0]._id.toString()).toBe(gCs._id.toString());

    // Resolve CS grievance
    const resolveRes = await request(app)
      .post(`/grievances/${gCs._id}/resolve`)
      .send({ resolution: 'Projector bulb replaced by IT team' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('resolved');
    expect(resolveRes.body.data.resolution).toBe('Projector bulb replaced by IT team');
    expect(resolveRes.body.data.resolvedBy.toString()).toBe(hodUser._id.toString());
  });

  it('Admin sees all grievances across all departments in the institution', async () => {
    await Grievance.create({
      institutionId: testInstId,
      raisedBy: student1._id,
      departmentId: csDept._id,
      category: 'fee',
      description: 'Payment receipt not generated'
    });

    await Grievance.create({
      institutionId: testInstId,
      raisedBy: student2._id,
      departmentId: ecDept._id,
      category: 'administrative',
      description: 'ID card request delayed'
    });

    // Admin logs in
    currentMockUser = {
      userId: adminUser._id.toString(),
      id: adminUser._id.toString(),
      roles: ['ADMIN'],
      institutionId: testInstId
    };

    const listRes = await request(app).get('/grievances');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
  });
});
