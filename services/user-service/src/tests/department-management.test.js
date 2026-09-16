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
const Department = require('../models/Department.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const User = require('../models/User.model');

describe('College Admin Department Management Tests', () => {
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
      const authHeader = req.headers.authorization;
      if (authHeader === 'Bearer TENANT_A_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantAId };
        req.tenantId = tenantAId.toString();
      } else if (authHeader === 'Bearer TENANT_B_ADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['ADMIN'], institutionId: tenantBId };
        req.tenantId = tenantBId.toString();
      } else if (authHeader === 'Bearer SUPERADMIN') {
        req.user = { userId: new mongoose.Types.ObjectId().toString(), roles: ['SUPERADMIN'] };
      }
      next();
    });

    app.use('/api/departments', departmentRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Department.deleteMany({});
    await RoleAssignment.deleteMany({});
    await User.deleteMany({});
  });

  test('College Admin creates department successfully with full metadata', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', 'Bearer TENANT_A_ADMIN')
      .send({
        name: 'Computer Science and Engineering',
        code: 'cse',
        description: 'Department of Computing',
        contactEmail: 'cse@tenant-a.edu',
        contactPhone: '1234567890'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.department.name).toBe('Computer Science and Engineering');
    expect(res.body.data.department.code).toBe('CSE'); // Uppercase normalization
    expect(res.body.data.department.institutionId.toString()).toBe(tenantAId.toString());
    expect(res.body.data.department.description).toBe('Department of Computing');
    expect(res.body.data.department.contactEmail).toBe('cse@tenant-a.edu');
    expect(res.body.data.department.isActive).toBe(true);
  });

  test('Duplicate department code within same institution is rejected with 409', async () => {
    await Department.create({
      name: 'Computer Science',
      code: 'CSE',
      institutionId: tenantAId
    });

    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', 'Bearer TENANT_A_ADMIN')
      .send({
        name: 'CSE Second',
        code: 'cse'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('SuperAdmin is disallowed from creating departments', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', 'Bearer SUPERADMIN')
      .send({
        name: 'Physics',
        code: 'PHY'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('List departments enriches real-time counts and HOD details', async () => {
    const dept = await Department.create({
      name: 'Mechanical Engineering',
      code: 'ME',
      institutionId: tenantAId
    });

    const hodUser = await User.create({
      name: 'Dr. John Doe',
      email: 'johndoe@tenant-a.edu',
      passwordHash: 'hash',
      roles: ['HOD'],
      institutionId: tenantAId,
      isActive: true
    });

    const facultyUser = await User.create({
      name: 'Prof. Alice',
      email: 'alice@tenant-a.edu',
      passwordHash: 'hash',
      roles: ['FACULTY'],
      institutionId: tenantAId,
      isActive: true
    });

    const studentUser = await User.create({
      name: 'Bob Student',
      email: 'bob@tenant-a.edu',
      passwordHash: 'hash',
      roles: ['STUDENT'],
      institutionId: tenantAId,
      isActive: true
    });

    // Create role assignments
    await RoleAssignment.create({
      userId: hodUser._id,
      role: 'HOD',
      institutionId: tenantAId,
      departmentId: dept._id
    });
    await RoleAssignment.create({
      userId: facultyUser._id,
      role: 'FACULTY',
      institutionId: tenantAId,
      departmentId: dept._id
    });
    await RoleAssignment.create({
      userId: studentUser._id,
      role: 'STUDENT',
      institutionId: tenantAId,
      departmentId: dept._id
    });

    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);

    const resultDept = res.body.data[0];
    expect(resultDept.code).toBe('ME');
    expect(resultDept.hodCount).toBe(1);
    expect(resultDept.hod.name).toBe('Dr. John Doe');
    expect(resultDept.facultyCount).toBe(1);
    expect(resultDept.studentCount).toBe(1);
  });

  test('College Admin can update department details and assign HOD', async () => {
    const dept = await Department.create({
      name: 'Electrical Engineering',
      code: 'EE',
      institutionId: tenantAId
    });

    const newHod = await User.create({
      name: 'Dr. Jane Smith',
      email: 'janesmith@tenant-a.edu',
      passwordHash: 'hash',
      roles: ['FACULTY'],
      institutionId: tenantAId,
      isActive: true
    });

    const res = await request(app)
      .patch(`/api/departments/${dept._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN')
      .send({
        name: 'Electrical & Electronics Engineering',
        code: 'EEE',
        description: 'New Description',
        isActive: false,
        hodId: newHod._id.toString()
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Electrical & Electronics Engineering');
    expect(res.body.data.code).toBe('EEE');
    expect(res.body.data.description).toBe('New Description');
    expect(res.body.data.isActive).toBe(false);

    // Verify HOD role assignment created
    const assignment = await RoleAssignment.findOne({
      departmentId: dept._id,
      role: 'HOD',
      validTo: null
    });
    expect(assignment).not.toBeNull();
    expect(assignment.userId.toString()).toBe(newHod._id.toString());
  });

  test('Delete department is protected when active students/faculty exist', async () => {
    const dept = await Department.create({
      name: 'Civil Engineering',
      code: 'CE',
      institutionId: tenantAId
    });

    const student = await User.create({
      name: 'Civil Student',
      email: 'civil@tenant-a.edu',
      passwordHash: 'hash',
      roles: ['STUDENT'],
      institutionId: tenantAId
    });

    await RoleAssignment.create({
      userId: student._id,
      role: 'STUDENT',
      institutionId: tenantAId,
      departmentId: dept._id
    });

    const deleteRes = await request(app)
      .delete(`/api/departments/${dept._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.success).toBe(false);
    expect(deleteRes.body.error).toContain('Cannot delete department with 1 active students or faculty');

    // Confirm dept was not deleted
    const stillExists = await Department.findById(dept._id);
    expect(stillExists).not.toBeNull();
  });

  test('Delete department succeeds when no active members exist', async () => {
    const dept = await Department.create({
      name: 'Aerospace Engineering',
      code: 'AERO',
      institutionId: tenantAId
    });

    const deleteRes = await request(app)
      .delete(`/api/departments/${dept._id}`)
      .set('Authorization', 'Bearer TENANT_A_ADMIN');

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const deleted = await Department.findById(dept._id);
    expect(deleted).toBeNull();
  });
});
