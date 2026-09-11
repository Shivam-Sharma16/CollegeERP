const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const noticeRoutes = require('../routes/notice.route');
const Notice = require('../models/Notice.model');

let mongoServer;
const app = express();
app.use(express.json());

jest.mock('@college-erp/shared-utils', () => {
  const actualUtils = jest.requireActual('@college-erp/shared-utils');
  return {
    ...actualUtils,
    authenticate: (req, res, next) => next(), 
    requirePermission: (action, resource) => (req, res, next) => {
      if (req.user.roles.includes('STUDENT')) return res.status(403).json({ error: 'Permission denied' });
      next();
    },
    success: (data) => ({ success: true, data }),
    fail: (error) => ({ success: false, error }),
    logAudit: jest.fn().mockResolvedValue()
  };
});

jest.mock('../middlewares/resolveScope.middleware', () => ({
  resolveScope: (req, res, next) => {
    req.callerScope = req.body._testCallerScope;
    next();
  }
}));

app.use('/api', (req, res, next) => {
  req.user = req.body._testUser;
  req.callerScope = req.body._testCallerScope;
  next();
}, noticeRoutes);

describe('Priority 4 & 5: Notice Service Tests', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('Priority 4: RBAC - rejects a STUDENT trying to create a notice', async () => {
    const res = await request(app).post('/api/notices').send({
      _testUser: { userId: new mongoose.Types.ObjectId().toString(), roles: ['STUDENT'] },
      _testCallerScope: { role: 'STUDENT' },
      title: 'Hello',
      body: 'World'
    });
    expect(res.status).toBe(403);
  });

  it('Priority 5: Notice Targeting Clamp - HOD target is clamped to own department', async () => {
    const deptId = new mongoose.Types.ObjectId().toString();
    const otherDeptId = new mongoose.Types.ObjectId().toString();

    const res = await request(app).post('/api/notices').send({
      _testUser: { userId: new mongoose.Types.ObjectId().toString(), roles: ['HOD'] },
      _testCallerScope: { role: 'HOD', departmentIds: [deptId] },
      title: 'HOD Notice',
      body: 'Content',
      targeting: {
        roles: ['STUDENT'],
        departments: [otherDeptId] // HOD tries to target a different department
      }
    });

    if (res.status !== 201) {
      console.log('Notice creation failed:', res.body);
    }
    expect(res.status).toBe(201);
    const notice = await Notice.findById(res.body.data._id);
    
    // The clamp logic in controller overrides the departments array
    expect(notice.targeting.departments.map(d => d.toString())).toContain(deptId);
    expect(notice.targeting.departments.map(d => d.toString())).not.toContain(otherDeptId);
  });
});
