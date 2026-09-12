process.env.PORT = '4010';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_12345';
process.env.INTERNAL_SERVICE_KEY = 'test_internal_key';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const institutionRoutes = require('../routes/institution.route');
const Institution = require('../models/Institution.model');
const redisModule = require('../config/redis');

class MockRedis {
  constructor() {
    this.store = new Map();
    this.status = 'ready';
  }
  async get(key) {
    return this.store.get(key) || null;
  }
  async set(key, val) {
    this.store.set(key, val);
    return 'OK';
  }
  async del(...keys) {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }
}

describe('Phase 67: SuperAdmin Institution Management Backend', () => {
  let mongoServer;
  let app;
  let superAdminToken;
  let tenantAdminToken;
  let superAdminId;
  let mockRedis;
  let seededInst;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    mockRedis = new MockRedis();
    redisModule.setRedisClient(mockRedis);
    jest.spyOn(redisModule, 'getRedisClient').mockReturnValue(mockRedis);

    app = express();
    app.use(express.json());

    // Middleware to simulate gateway tenant header injection
    app.use((req, res, next) => {
      const headerTenant = req.headers['x-tenant-id'];
      if (headerTenant) {
        req.tenantId = headerTenant;
      }
      next();
    });

    app.use('/superadmin/institutions', institutionRoutes);
    app.use('/api/superadmin/institutions', institutionRoutes);
    app.use('/institutions', institutionRoutes);

    superAdminId = new mongoose.Types.ObjectId();
    superAdminToken = jwt.sign(
      { userId: superAdminId.toString(), institutionId: null, roles: ['SUPERADMIN'] },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Institution.deleteMany({});
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('users').deleteMany({});
      await mongoose.connection.db.collection('departments').deleteMany({});
      await mongoose.connection.db.collection('roleassignments').deleteMany({});
    }

    // Seed SuperAdmin user in users collection
    await mongoose.connection.db.collection('users').insertOne({
      _id: superAdminId,
      name: 'SuperAdmin Global',
      email: 'superadmin@collegeerp.com',
      roles: ['SUPERADMIN'],
      institutionId: null,
      isActive: true
    });

    // Seed one active institution
    seededInst = await Institution.create({
      name: 'Apex Institute of Technology',
      subdomain: 'apex-tech',
      slug: 'apex-tech',
      code: 'APEX',
      isActive: true,
      status: 'ACTIVE'
    });

    // Seed tenant admin user
    const tenantAdminId = new mongoose.Types.ObjectId();
    await mongoose.connection.db.collection('users').insertOne({
      _id: tenantAdminId,
      name: 'Admin Apex',
      email: 'admin@apex.edu',
      roles: ['ADMIN'],
      institutionId: seededInst._id,
      isActive: true
    });

    tenantAdminToken = jwt.sign(
      { userId: tenantAdminId.toString(), institutionId: seededInst._id.toString(), roles: ['ADMIN'] },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('1. Pre-Write Conflict & Validation Checks', () => {
    it('rejects creation with a 409 Conflict if subdomain is already taken before any DB write', async () => {
      const usersCountBefore = await mongoose.connection.db.collection('users').countDocuments();
      const instCountBefore = await Institution.countDocuments();

      const res = await request(app)
        .post('/superadmin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Duplicate Campus',
          subdomain: 'apex-tech', // already exists
          admin: {
            name: 'New Admin',
            email: 'newadmin@dup.edu',
            password: 'Password123!'
          }
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/subdomain already exists/i);

      // Verify no records written
      expect(await Institution.countDocuments()).toBe(instCountBefore);
      expect(await mongoose.connection.db.collection('users').countDocuments()).toBe(usersCountBefore);
    });

    it('rejects creation if subdomain is reserved by platform', async () => {
      const res = await request(app)
        .post('/superadmin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Portal Test',
          subdomain: 'portal',
          admin: {
            name: 'Admin',
            email: 'admin@portal.edu',
            password: 'Password123!'
          }
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/reserved/i);
    });

    it('rejects creation with 400 if subdomain format contains uppercase or illegal characters', async () => {
      const res = await request(app)
        .post('/superadmin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Invalid Subdomain Institute',
          subdomain: 'Invalid_Subdomain!',
          admin: {
            name: 'Admin',
            email: 'admin@invalid.edu',
            password: 'Password123!'
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/only lowercase letters, numbers, and hyphens/i);
    });
  });

  describe('2. Atomic Institution + Admin Creation', () => {
    it('creates Institution and initial Admin with departmentId: null', async () => {
      const res = await request(app)
        .post('/superadmin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Beacon University',
          subdomain: 'beacon-univ',
          admin: {
            name: 'Beacon Dean',
            email: 'dean@beacon.edu',
            password: 'SecurePassword123!'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.institution.subdomain).toBe('beacon-univ');
      expect(res.body.data.admin.email).toBe('dean@beacon.edu');

      // Verify created admin in database
      const adminDoc = await mongoose.connection.db.collection('users').findOne({ email: 'dean@beacon.edu' });
      expect(adminDoc).toBeTruthy();
      expect(adminDoc.roles).toContain('ADMIN');
      expect(adminDoc.institutionId.toString()).toBe(res.body.data.institution._id);

      // Verify role assignment has departmentId: null
      const roleDoc = await mongoose.connection.db.collection('roleassignments').findOne({ userId: adminDoc._id });
      expect(roleDoc).toBeTruthy();
      expect(roleDoc.role).toBe('ADMIN');
      expect(roleDoc.departmentId).toBeNull();
    });

    it('rejects non-SuperAdmin attempting to create institution', async () => {
      const res = await request(app)
        .post('/superadmin/institutions')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send({
          name: 'Unauthorized Uni',
          subdomain: 'unauth-uni',
          admin: {
            name: 'Admin',
            email: 'admin@unauth.edu',
            password: 'Password123!'
          }
        });

      expect([401, 403]).toContain(res.status);
    });

    it('rejects creation when attempted on a tenant subdomain (with req.tenantId)', async () => {
      const res = await request(app)
        .post('/superadmin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-tenant-id', seededInst._id.toString())
        .send({
          name: 'Subdomain Attempt',
          subdomain: 'subdomain-attempt',
          admin: {
            name: 'Admin',
            email: 'admin@sub.edu',
            password: 'Password123!'
          }
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/only allowed on the root domain/i);
    });
  });

  describe('3. Aggregation Counts in List Institutions', () => {
    it('returns student, faculty, and department counts per institution via aggregation', async () => {
      // Seed departments
      await mongoose.connection.db.collection('departments').insertMany([
        { name: 'Computer Science', code: 'CS', institutionId: seededInst._id },
        { name: 'Mechanical Engineering', code: 'ME', institutionId: seededInst._id }
      ]);

      // Seed students and faculty
      await mongoose.connection.db.collection('users').insertMany([
        { name: 'Student 1', email: 's1@apex.edu', roles: ['STUDENT'], institutionId: seededInst._id },
        { name: 'Student 2', email: 's2@apex.edu', roles: ['STUDENT'], institutionId: seededInst._id },
        { name: 'Student 3', email: 's3@apex.edu', roles: ['STUDENT'], institutionId: seededInst._id },
        { name: 'Faculty 1', email: 'f1@apex.edu', roles: ['FACULTY'], institutionId: seededInst._id }
      ]);

      const res = await request(app)
        .get('/superadmin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const apexData = res.body.data.find(inst => inst.subdomain === 'apex-tech');
      expect(apexData).toBeTruthy();
      expect(apexData.studentCount).toBe(3);
      expect(apexData.facultyCount).toBe(1);
      expect(apexData.departmentCount).toBe(2);
      expect(apexData.userCount).toBe(5); // 1 admin + 3 students + 1 faculty
    });
  });

  describe('4. Live Subdomain Availability Check', () => {
    it('returns available: false for an existing subdomain', async () => {
      const res = await request(app)
        .get('/superadmin/institutions/check-subdomain')
        .query({ subdomain: 'apex-tech' });

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.reason).toMatch(/already taken/i);
    });

    it('returns available: true for an untaken valid subdomain', async () => {
      const res = await request(app)
        .get('/superadmin/institutions/check-subdomain')
        .query({ subdomain: 'brand-new-college' });

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
      expect(res.body.data.subdomain).toBe('brand-new-college');
    });

    it('returns available: false for reserved subdomain', async () => {
      const res = await request(app)
        .get('/superadmin/institutions/check-subdomain')
        .query({ subdomain: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.reason).toMatch(/reserved/i);
    });

    it('returns available: false for invalid characters', async () => {
      const res = await request(app)
        .get('/superadmin/institutions/check-subdomain')
        .query({ subdomain: 'bad_subdomain!' });

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.reason).toMatch(/only lowercase letters/i);
    });
  });

  describe('5. Institution Activation / Deactivation & Subdomain Invalidation', () => {
    it('deactivates an institution and invalidates Redis cache', async () => {
      // Warm up cache
      await mockRedis.set('tenant:subdomain:apex-tech', JSON.stringify({ name: 'Apex' }));
      expect(await mockRedis.get('tenant:subdomain:apex-tech')).toBeTruthy();

      const res = await request(app)
        .patch(`/superadmin/institutions/${seededInst._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.data.status).toBe('SUSPENDED');

      // Verify Redis cache key was purged
      const cached = await mockRedis.get('tenant:subdomain:apex-tech');
      expect(cached).toBeNull();
    });

    it('reactivates a suspended institution and invalidates Redis cache', async () => {
      // Suspended first
      await Institution.findByIdAndUpdate(seededInst._id, { isActive: false, status: 'SUSPENDED' });

      const res = await request(app)
        .patch(`/superadmin/institutions/${seededInst._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });
});
