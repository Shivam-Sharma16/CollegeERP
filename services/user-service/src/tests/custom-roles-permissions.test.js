const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { PERMISSION_CATALOG } = require('@college-erp/shared-config');
const { requirePermission, fail, success } = require('@college-erp/shared-utils');

const CustomRole = require('../models/CustomRole.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const User = require('../models/User.model');
const roleController = require('../controllers/role.controller');

describe('Phase 75: Custom Role & Granular Permission System Integration Tests', () => {
  let mongoServer;
  let app;

  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();

  let adminUser;
  let customRoleUser;
  let regularStudentUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    // Middleware simulating authentication & tenant resolution
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader === 'Bearer ADMIN_TOKEN') {
        req.user = {
          userId: adminUser._id.toString(),
          roles: ['ADMIN'],
          institutionId: tenantAId
        };
        req.tenantId = tenantAId.toString();
      } else if (authHeader === 'Bearer CUSTOM_ROLE_USER_TOKEN') {
        req.user = {
          userId: customRoleUser._id.toString(),
          roles: [], // Has NO fixed role!
          institutionId: tenantAId
        };
        req.tenantId = tenantAId.toString();
      } else if (authHeader === 'Bearer STUDENT_TOKEN') {
        req.user = {
          userId: regularStudentUser._id.toString(),
          roles: ['STUDENT'],
          institutionId: tenantAId
        };
        req.tenantId = tenantAId.toString();
      }
      next();
    });

    // Public / semi-public catalog route
    app.get('/api/roles/permissions-catalog', roleController.getPermissionCatalog);
    app.get('/api/roles/my-permissions', roleController.getMyPermissions);

    // Protected by 'role.manage'
    app.post('/api/roles/custom', requirePermission('role.manage'), roleController.createCustomRole);
    app.get('/api/roles/custom', requirePermission('role.manage'), roleController.listCustomRoles);
    app.get('/api/roles/custom/:id', requirePermission('role.manage'), roleController.getCustomRoleById);
    app.patch('/api/roles/custom/:id', requirePermission('role.manage'), roleController.updateCustomRole);
    app.delete('/api/roles/custom/:id', requirePermission('role.manage'), roleController.deleteCustomRole);
    app.post('/api/roles/assign', requirePermission('role.manage'), roleController.assignCustomRole);
    app.post('/api/roles/unassign', requirePermission('role.manage'), roleController.unassignCustomRole);
    app.get('/api/roles/effective-permissions/:userId', requirePermission('role.manage'), roleController.getUserEffectivePermissions);

    // Protected by 'grievance.resolve'
    app.post('/api/grievances/:id/resolve', requirePermission('grievance.resolve'), roleController.resolveGrievance);

    // Protected by 'fees.view_reports' (to simulate fee reports endpoint check)
    app.get('/api/fees/reports/collection-trend', requirePermission('fees.view_reports'), (req, res) => {
      res.json(success({ trend: [] }));
    });
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await CustomRole.deleteMany({});
    await RoleAssignment.deleteMany({});
    await User.deleteMany({});

    adminUser = await User.create({
      name: 'Tenant Admin',
      email: 'admin@collegetest.edu',
      passwordHash: 'hashedpassword',
      roles: ['ADMIN'],
      institutionId: tenantAId
    });

    // An empty user who has no fixed roles
    customRoleUser = await User.create({
      name: 'Grievance Officer',
      email: 'officer@collegetest.edu',
      passwordHash: 'hashedpassword',
      roles: [],
      institutionId: tenantAId
    });

    regularStudentUser = await User.create({
      name: 'John Student',
      email: 'student@collegetest.edu',
      passwordHash: 'hashedpassword',
      roles: ['STUDENT'],
      institutionId: tenantAId
    });
  });

  describe('1. Permission Catalog & Validation', () => {
    it('returns the fixed system permission catalog', async () => {
      const res = await request(app)
        .get('/api/roles/permissions-catalog')
        .set('Authorization', 'Bearer ADMIN_TOKEN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(PERMISSION_CATALOG);
      expect(res.body.data).toContain('notice.create.department');
      expect(res.body.data).toContain('grievance.resolve');
      expect(res.body.data).toContain('role.manage');
    });

    it('rejects custom role creation with invalid permission keys', async () => {
      const res = await request(app)
        .post('/api/roles/custom')
        .set('Authorization', 'Bearer ADMIN_TOKEN')
        .send({
          name: 'Invalid Role',
          description: 'Testing invalid keys',
          permissions: ['notice.create.department', 'hacker.override.everything']
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid permission keys/i);
    });

    it('rejects duplicate custom role names within the same institution', async () => {
      await request(app)
        .post('/api/roles/custom')
        .set('Authorization', 'Bearer ADMIN_TOKEN')
        .send({
          name: 'Exam Officer',
          permissions: ['notice.create.department']
        });

      const res = await request(app)
        .post('/api/roles/custom')
        .set('Authorization', 'Bearer ADMIN_TOKEN')
        .send({
          name: 'Exam Officer',
          permissions: ['notice.create.department']
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('2. Custom Role Creation, Assignment & Acceptance Criteria', () => {
    it('satisfies the flagship acceptance criterion: user with custom role ["notice.create.department", "grievance.resolve"] has exact access', async () => {
      // Step A: Admin creates custom role with only ["notice.create.department", "grievance.resolve"]
      const createRoleRes = await request(app)
        .post('/api/roles/custom')
        .set('Authorization', 'Bearer ADMIN_TOKEN')
        .send({
          name: 'Department Grievance Handler',
          description: 'Can post dept notices and resolve grievances',
          permissions: ['notice.create.department', 'grievance.resolve']
        });

      expect(createRoleRes.status).toBe(201);
      expect(createRoleRes.body.success).toBe(true);
      const customRole = createRoleRes.body.data;
      expect(customRole.permissions).toEqual(['notice.create.department', 'grievance.resolve']);

      // Step B: Admin assigns custom role to customRoleUser (who has no other roles)
      const assignRes = await request(app)
        .post('/api/roles/assign')
        .set('Authorization', 'Bearer ADMIN_TOKEN')
        .send({
          userId: customRoleUser._id.toString(),
          customRoleId: customRole._id.toString()
        });

      expect(assignRes.status).toBe(201);
      expect(assignRes.body.success).toBe(true);

      // Step C: Verify caller gets effective permissions via /api/roles/my-permissions
      const myPermsRes = await request(app)
        .get('/api/roles/my-permissions')
        .set('Authorization', 'Bearer CUSTOM_ROLE_USER_TOKEN');

      expect(myPermsRes.status).toBe(200);
      expect(myPermsRes.body.data.permissions.sort()).toEqual(
        ['notice.create.department', 'grievance.resolve'].sort()
      );

      // Step D: Custom role user CAN resolve grievance (requires 'grievance.resolve')
      const resolveRes = await request(app)
        .post('/api/grievances/g-101/resolve')
        .set('Authorization', 'Bearer CUSTOM_ROLE_USER_TOKEN')
        .send({ comment: 'Resolved by custom role officer' });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.success).toBe(true);
      expect(resolveRes.body.data.message).toMatch(/Grievance resolved successfully/i);

      // Step E: Custom role user is FORBIDDEN from creating/managing roles (requires 'role.manage')
      const manageRoleRes = await request(app)
        .post('/api/roles/custom')
        .set('Authorization', 'Bearer CUSTOM_ROLE_USER_TOKEN')
        .send({
          name: 'Unauthorized Role',
          permissions: ['notice.create.department']
        });

      expect(manageRoleRes.status).toBe(403);
      expect(manageRoleRes.body.success).toBe(false);

      // Step F: Custom role user is FORBIDDEN from viewing fee reports (requires 'fees.view_reports')
      const feeReportRes = await request(app)
        .get('/api/fees/reports/collection-trend')
        .set('Authorization', 'Bearer CUSTOM_ROLE_USER_TOKEN');

      expect(feeReportRes.status).toBe(403);
      expect(feeReportRes.body.success).toBe(false);

      // Step G: Regular student without custom role gets 403 on grievance resolve
      const studentResolveRes = await request(app)
        .post('/api/grievances/g-101/resolve')
        .set('Authorization', 'Bearer STUDENT_TOKEN');

      expect(studentResolveRes.status).toBe(403);
    });

    it('unassigning the custom role revokes permissions immediately', async () => {
      // 1. Create and assign role
      const role = await CustomRole.create({
        institutionId: tenantAId,
        name: 'Grievance Helper',
        permissions: ['grievance.resolve'],
        createdBy: adminUser._id
      });

      await RoleAssignment.create({
        userId: customRoleUser._id,
        customRoleId: role._id,
        institutionId: tenantAId,
        validFrom: new Date()
      });

      // Initially can resolve
      const canResolve = await request(app)
        .post('/api/grievances/g-202/resolve')
        .set('Authorization', 'Bearer CUSTOM_ROLE_USER_TOKEN');
      expect(canResolve.status).toBe(200);

      // 2. Admin unassigns the role
      const unassignRes = await request(app)
        .post('/api/roles/unassign')
        .set('Authorization', 'Bearer ADMIN_TOKEN')
        .send({
          userId: customRoleUser._id.toString(),
          customRoleId: role._id.toString()
        });
      expect(unassignRes.status).toBe(200);

      // 3. User now gets 403
      const nowForbidden = await request(app)
        .post('/api/grievances/g-202/resolve')
        .set('Authorization', 'Bearer CUSTOM_ROLE_USER_TOKEN');
      expect(nowForbidden.status).toBe(403);
    });

    it('deleting a custom role cascades and removes all user assignments', async () => {
      const role = await CustomRole.create({
        institutionId: tenantAId,
        name: 'Temporary Coordinator',
        permissions: ['grievance.resolve'],
        createdBy: adminUser._id
      });

      await RoleAssignment.create({
        userId: customRoleUser._id,
        customRoleId: role._id,
        institutionId: tenantAId,
        validFrom: new Date()
      });

      const deleteRes = await request(app)
        .delete(`/api/roles/custom/${role._id}`)
        .set('Authorization', 'Bearer ADMIN_TOKEN');

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify custom role is gone
      const foundRole = await CustomRole.findById(role._id);
      expect(foundRole).toBeNull();

      // Verify role assignment is deleted
      const foundAssignment = await RoleAssignment.findOne({ customRoleId: role._id });
      expect(foundAssignment).toBeNull();
    });
  });
});
