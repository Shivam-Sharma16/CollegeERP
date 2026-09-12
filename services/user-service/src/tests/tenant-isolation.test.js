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

const departmentRoutes = require('../routes/department.route');
const userRoutes = require('../routes/user.route');
const Department = require('../models/Department.model');
const User = require('../models/User.model');

describe('Phase 68: User Service Tenant Isolation Tests', () => {
  let mongoServer;
  let app;
  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    // Middleware simulating Gateway / Auth header injection
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization; // "Bearer TENANT_A_ADMIN" or "Bearer TENANT_B_ADMIN"
      if (authHeader === 'Bearer TENANT_A_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantAId };
        req.tenantId = tenantAId.toString();
      } else if (authHeader === 'Bearer TENANT_B_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantBId };
        req.tenantId = tenantBId.toString();
      }
      next();
    });

    app.use('/api/departments', departmentRoutes);
    app.use('/api/users', userRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let deptA, deptB, userA, userB;

  beforeEach(async () => {
    await Department.deleteMany({});
    await User.deleteMany({});

    deptA = await Department.create({
      name: 'Computer Science',
      code: 'CS',
      institutionId: tenantAId,
    });

    deptB = await Department.create({
      name: 'Computer Science', // identical name & code allowed across different tenants
      code: 'CS',
      institutionId: tenantBId,
    });

    userA = await User.create({
      name: 'Student Tenant A',
      email: 'student@campus.edu',
      passwordHash: 'hashA',
      institutionId: tenantAId,
      roles: ['STUDENT'],
    });

    userB = await User.create({
      name: 'Student Tenant B',
      email: 'student@campus.edu', // identical email allowed across different tenants
      passwordHash: 'hashB',
      institutionId: tenantBId,
      roles: ['STUDENT'],
    });
  });

  test('Tenant A cannot read Tenant B department by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/departments/${deptB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('Tenant A cannot update Tenant B department (returns 404)', async () => {
    const res = await request(app)
      .patch(`/api/departments/${deptB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN')
      .send({ name: 'Hacked Department' });

    expect(res.status).toBe(404);
    const untouchedDeptB = await Department.findById(deptB._id);
    expect(untouchedDeptB.name).toBe('Computer Science');
  });

  test('Tenant A listing departments only returns Tenant A departments', async () => {
    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(deptA._id.toString());
  });

  test('Tenant A cannot read Tenant B user by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/users/${userB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('Tenant A cannot delete Tenant B user (returns 404)', async () => {
    const res = await request(app)
      .delete(`/api/users/${userB._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(404);
    const untouchedUserB = await User.findById(userB._id);
    expect(untouchedUserB).not.toBeNull();
  });

  test('Tenant A listing users only returns Tenant A users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(userA._id.toString());
  });
});
