process.env.JWT_ACCESS_SECRET = 'test_access_secret_12345';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_12345';
process.env.INTERNAL_SERVICE_KEY = 'test_internal_key';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.SUPERADMIN_SETUP_KEY = 'test_secret_key';
process.env.PORT = '4001';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authRoutes = require('../routes/auth.route');
const User = require('../models/User.model');
const Institution = require('../models/Institution.model');
const { authenticate } = require('@college-erp/shared-utils');

describe('Phase 66: Auth Retrofit for Multi-Tenancy', () => {
  let mongoServer;
  let app;
  let instA;
  let instB;
  let superadminUser;

  const sharedEmail = 'shared-admin@campus.edu';
  const sharedPassword = 'Password123!';
  const userAEmail = 'exclusive-student@jecrc.edu';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.set('trust proxy', true);

    // Middleware simulating Gateway tenant resolution header injection
    app.use((req, res, next) => {
      const headerTenant = req.headers['x-tenant-id'];
      if (headerTenant) {
        req.tenantId = headerTenant;
      }
      next();
    });

    app.use('/', authRoutes);
    app.use('/api/auth', authRoutes);

    // Protected mock route using shared-utils authenticate middleware
    app.get('/api/protected/data', authenticate, (req, res) => {
      res.json({
        success: true,
        user: req.user,
        institutionId: req.institutionId
      });
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Institution.deleteMany({});

    // 1. Create two separate institutions
    instA = await Institution.create({
      name: 'JECRC Foundation',
      subdomain: 'jecrc',
      slug: 'jecrc',
      isActive: true,
      status: 'ACTIVE'
    });

    instB = await Institution.create({
      name: 'Other College Institute',
      subdomain: 'other-college',
      slug: 'other-college',
      isActive: true,
      status: 'ACTIVE'
    });

    const hash = await bcrypt.hash(sharedPassword, 10);

    // 2. Seed Admin at Institution A with shared email & password
    await User.create({
      name: 'Admin Inst A',
      email: sharedEmail,
      passwordHash: hash,
      roles: ['ADMIN'],
      institutionId: instA._id
    });

    // 3. Seed Admin at Institution B with IDENTICAL shared email & password
    await User.create({
      name: 'Admin Inst B',
      email: sharedEmail,
      passwordHash: hash,
      roles: ['ADMIN'],
      institutionId: instB._id
    });

    // 4. Seed an exclusive user only belonging to Institution A
    await User.create({
      name: 'Student JECRC',
      email: userAEmail,
      passwordHash: hash,
      roles: ['STUDENT'],
      institutionId: instA._id
    });

    // 5. Seed SuperAdmin (Platform level, institutionId: null)
    superadminUser = await User.create({
      name: 'Global SuperAdmin',
      email: 'superadmin@collegeerp.com',
      passwordHash: hash,
      roles: ['SUPERADMIN'],
      institutionId: null
    });
  });

  describe('1. Scoped Email Uniqueness & Isolated Login', () => {
    it('allows two separate users to share the identical email address across different institutions', async () => {
      const users = await User.find({ email: sharedEmail });
      expect(users.length).toBe(2);
      expect(users[0].institutionId.toString()).not.toBe(users[1].institutionId.toString());
    });

    it('rejects duplicate email within the same institution', async () => {
      const hash = await bcrypt.hash('AnotherPass!', 10);
      await expect(
        User.create({
          name: 'Duplicate Admin',
          email: sharedEmail,
          passwordHash: hash,
          roles: ['ADMIN'],
          institutionId: instA._id
        })
      ).rejects.toThrow();
    });

    it('confirms Admin A can log in successfully on their own subdomain context (instA)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-tenant-id', instA._id.toString())
        .send({
          email: sharedEmail,
          password: sharedPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institutionId).toBe(instA._id.toString());
      expect(res.body.user.name).toBe('Admin Inst A');
      expect(res.body.accessToken).toBeTruthy();
    });

    it('confirms Admin B can log in successfully on their own subdomain context (instB)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-tenant-id', instB._id.toString())
        .send({
          email: sharedEmail,
          password: sharedPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institutionId).toBe(instB._id.toString());
      expect(res.body.user.name).toBe('Admin Inst B');
      expect(res.body.accessToken).toBeTruthy();
    });

    it('confirms an account exclusive to Inst A cannot log in on Inst B even with correct password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-tenant-id', instB._id.toString())
        .send({
          email: userAEmail,
          password: sharedPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });

    it('rejects login when tenant context is missing on standard login route', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: sharedEmail,
          password: sharedPassword
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Tenant context is required/i);
    });
  });

  describe('2. SuperAdmin Dedicated Login Route', () => {
    it('successfully logs in SuperAdmin on root domain route without tenantId', async () => {
      const res = await request(app)
        .post('/superadmin/login')
        .send({
          email: 'superadmin@collegeerp.com',
          password: sharedPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institutionId).toBeNull();
      expect(res.body.roles).toContain('SUPERADMIN');
    });

    it('rejects SuperAdmin login when attempted with a tenantId (on tenant subdomain)', async () => {
      const res = await request(app)
        .post('/superadmin/login')
        .set('x-tenant-id', instA._id.toString())
        .send({
          email: 'superadmin@collegeerp.com',
          password: sharedPassword
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/SuperAdmin login is only allowed on the root domain/i);
    });

    it('does not allow tenant admin to log in via SuperAdmin route', async () => {
      const res = await request(app)
        .post('/superadmin/login')
        .send({
          email: sharedEmail,
          password: sharedPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });
  });

  describe('3. Cross-Subdomain JWT Replay Protection', () => {
    let tokenInstA;
    let tokenInstB;

    beforeEach(async () => {
      // Login to get Inst A token
      const resA = await request(app)
        .post('/api/auth/login')
        .set('x-tenant-id', instA._id.toString())
        .send({ email: sharedEmail, password: sharedPassword });
      tokenInstA = resA.body.accessToken;

      // Login to get Inst B token
      const resB = await request(app)
        .post('/api/auth/login')
        .set('x-tenant-id', instB._id.toString())
        .send({ email: sharedEmail, password: sharedPassword });
      tokenInstB = resB.body.accessToken;
    });

    it('allows JWT obtained on jecrc (instA) to access jecrc (instA) protected endpoints', async () => {
      const res = await request(app)
        .get('/api/protected/data')
        .set('Authorization', `Bearer ${tokenInstA}`)
        .set('x-tenant-id', instA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institutionId).toBe(instA._id.toString());
    });

    it('rejects JWT obtained on jecrc (instA) when replayed against other-college (instB) with 401', async () => {
      const res = await request(app)
        .get('/api/protected/data')
        .set('Authorization', `Bearer ${tokenInstA}`)
        .set('x-tenant-id', instB._id.toString());

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Token tenant mismatch/i);
    });

    it('rejects JWT obtained on other-college (instB) when replayed against jecrc (instA) with 401', async () => {
      const res = await request(app)
        .get('/api/protected/data')
        .set('Authorization', `Bearer ${tokenInstB}`)
        .set('x-tenant-id', instA._id.toString());

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Token tenant mismatch/i);
    });
  });
});
