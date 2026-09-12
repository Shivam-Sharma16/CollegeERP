const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const userRoutes = require('../routes/user.route');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const Department = require('../models/Department.model');

let mongoServer;
const app = express();
app.use(express.json());

const testInstId = new mongoose.Types.ObjectId();

// Mock authentication middleware to simulate caller role
app.use((req, res, next) => {
  if (req.headers.authorization) {
    const role = req.headers.authorization.split(' ')[1]; // "Bearer ADMIN" -> "ADMIN"
    const isSuperAdmin = role === 'SUPERADMIN';
    req.user = { 
      userId: new mongoose.Types.ObjectId().toString(), 
      roles: [role],
      institutionId: isSuperAdmin ? null : testInstId
    };
    req.effectiveRoles = [{ 
      role, 
      departmentId: req.body.departmentId || new mongoose.Types.ObjectId().toString(), 
      sectionId: new mongoose.Types.ObjectId().toString(),
      institutionId: isSuperAdmin ? null : testInstId
    }];
  } else {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

// Use shared-utils middleware mock (since it's an external module, we inject it via route mounting)
jest.mock('@college-erp/shared-utils', () => ({
  authenticate: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(), // Bypass abstract permissions to test controller hierarchy logic directly
  success: (data) => ({ success: true, data }),
  fail: (error) => ({ success: false, error }),
  logAudit: jest.fn().mockResolvedValue()
}));

app.use('/api/users', userRoutes);

describe('Priority 1: Account-Creation Hierarchy (Phase 12)', () => {
  let testDeptId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    const dept = await Department.create({ 
      name: 'Computer Science', 
      code: 'CS', 
      institutionId: testInstId,
      headId: new mongoose.Types.ObjectId() 
    });
    testDeptId = dept._id;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await RoleAssignment.deleteMany({});
  });

  const payload = { 
    name: 'Test', 
    email: 'test@example.com', 
    password: 'password123', 
    rollNumber: '123',
    institutionId: testInstId 
  };

  it('SUPERADMIN can create ADMIN', async () => {
    const res = await request(app).post('/api/users/admins').set('Authorization', 'Bearer SUPERADMIN').send(payload);
    expect(res.status).toBe(201);
  });

  it('ADMIN can create HOD', async () => {
    const res = await request(app).post('/api/users/hods').set('Authorization', 'Bearer ADMIN').send({ ...payload, departmentId: testDeptId });
    expect(res.status).toBe(201);
  });

  it('HOD can create FACULTY', async () => {
    const res = await request(app).post('/api/users/faculty').set('Authorization', 'Bearer HOD').send(payload);
    expect(res.status).toBe(201);
  });

  it('CC can onboard STUDENT', async () => {
    const res = await request(app).post('/api/users/students').set('Authorization', 'Bearer CC').send(payload);
    expect(res.status).toBe(201);
  });

  it('ADMIN gets 403 when creating ADMIN (only SUPERADMIN can)', async () => {
    const res = await request(app).post('/api/users/admins').set('Authorization', 'Bearer ADMIN').send(payload);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permission/i);
  });

  it('HOD gets 403 when creating ADMIN or CC (HOD creates Faculty/CC... wait, HOD CAN create CC)', async () => {
    const res1 = await request(app).post('/api/users/admins').set('Authorization', 'Bearer HOD').send(payload);
    expect(res1.status).toBe(403);

    // HOD CAN create CC
    const res2 = await request(app).post('/api/users/cc').set('Authorization', 'Bearer HOD').send({ name: 'Test CC', email: 'cc@test.com', password: 'password123', institutionId: testInstId });
    expect(res2.status).toBe(201);
  });

  it('FACULTY and STUDENT get 403 when creating any account', async () => {
    const roles = ['FACULTY', 'STUDENT'];
    for (const role of roles) {
      const endpoints = ['/api/users/admins', '/api/users/hods', '/api/users/faculty', '/api/users/cc', '/api/users/students'];
      for (const endpoint of endpoints) {
        const res = await request(app).post(endpoint).set('Authorization', `Bearer ${role}`).send({ ...payload, email: `${role}_${endpoint}@test.com`, departmentId: testDeptId });
        expect(res.status).toBe(403);
      }
    }
  });
});
