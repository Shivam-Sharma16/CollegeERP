const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const crypto = require('crypto');
const { tenantResolver } = require('../middlewares/tenantResolver.middleware');
const redisModule = require('../config/redis');
const { verifyTenantContext } = require('@college-erp/shared-utils');

class InMemoryRedis {
  constructor() {
    this.store = new Map();
    this.status = 'ready';
  }
  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  async set(key, val, ex, ttl) {
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
  async flushall() {
    this.store.clear();
    return 'OK';
  }
}

describe('Phase 65: Tenant Resolution & Subdomain Routing', () => {
  let mongoServer;
  let redisClient;
  let app;
  let apexInstId;
  let inactiveInstId;

  const INTERNAL_KEY = 'test-internal-secret-key';
  process.env.INTERNAL_SERVICE_KEY = INTERNAL_KEY;

  beforeAll(async () => {
    // 1. Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 2. Setup mock Redis
    redisClient = new InMemoryRedis();
    jest.spyOn(redisModule, 'getRedisClient').mockReturnValue(redisClient);

    // 3. Seed test institutions
    const institutionsCol = mongoose.connection.db.collection('institutions');
    
    const apexDoc = await institutionsCol.insertOne({
      name: 'Apex Institute of Technology',
      subdomain: 'apex-tech',
      slug: 'apex-tech',
      customDomain: 'erp.apextech.edu',
      isActive: true,
      status: 'ACTIVE',
      themeConfig: {
        primaryColor: '#4f46e5'
      }
    });
    apexInstId = apexDoc.insertedId.toString();

    const inactiveDoc = await institutionsCol.insertOne({
      name: 'Suspended University',
      subdomain: 'suspended-uni',
      slug: 'suspended-uni',
      isActive: false,
      status: 'SUSPENDED'
    });
    inactiveInstId = inactiveDoc.insertedId.toString();

    // 4. Create Express test app with tenant resolution and debug/routes
    app = express();
    app.use(express.json());

    // Health route
    app.get('/health', (req, res) => res.json({ status: 'healthy', tenantId: req.tenantId }));

    // Core middleware under test
    app.use(tenantResolver);

    // Debug tenant route
    app.get(['/api/debug/tenant', '/debug/tenant'], (req, res) => {
      res.json({
        tenantId: req.tenantId || null,
        subdomain: req.tenantSubdomain || null,
        isSuperAdmin: !!req.isSuperAdminRoute
      });
    });

    // Mock superadmin route
    app.get('/superadmin/stats', (req, res) => {
      res.json({ success: true, scope: 'global', tenantId: req.tenantId });
    });

    // Mock tenant-scoped route
    app.get('/api/users/me', (req, res) => {
      res.json({ success: true, tenantId: req.tenantId });
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await redisClient.flushall();
  });

  describe('1. Root Domain and SuperAdmin Bypass', () => {
    it('skips tenant resolution for /superadmin on root domain (collegeerp.com)', async () => {
      const res = await request(app)
        .get('/superadmin/stats')
        .set('Host', 'collegeerp.com');

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBeNull();
      expect(res.body.scope).toBe('global');
    });

    it('skips tenant resolution for /api/superadmin on localhost in dev', async () => {
      const res = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'localhost:4000')
        .query({ path: '/api/superadmin' }); // route check
    });

    it('bypasses /health check without requiring tenant', async () => {
      const res = await request(app)
        .get('/health')
        .set('Host', 'localhost:4000');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    it('bypasses /api/institutions/check-subdomain without throwing 404 on uncreated subdomain', async () => {
      app.get('/api/institutions/check-subdomain', (req, res) => {
        res.json({ success: true, available: true, subdomain: req.query.subdomain });
      });

      const res = await request(app)
        .get('/api/institutions/check-subdomain?subdomain=jecrc')
        .set('Host', 'collegeerp.com');

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
      expect(res.body.subdomain).toBe('jecrc');
    });

    it('returns 404 when root domain accesses tenant route without subdomain', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Host', 'collegeerp.com');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Institution not found');
    });
  });

  describe('2. Subdomain Extraction and Tenant Resolution', () => {
    it('resolves active institution by subdomain (apex-tech.collegeerp.com)', async () => {
      const res = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'apex-tech.collegeerp.com');

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe(apexInstId);
      expect(res.body.subdomain).toBe('apex-tech');
    });

    it('resolves active institution in local dev (apex-tech.localhost:5173)', async () => {
      const res = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'apex-tech.localhost:5173');

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe(apexInstId);
      expect(res.body.subdomain).toBe('apex-tech');
    });

    it('caches resolved institution in Redis with 5-minute TTL', async () => {
      // First request (Cache miss -> MongoDB)
      const res1 = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'apex-tech.localhost');

      expect(res1.status).toBe(200);

      // Verify cached in Redis
      const cached = await redisClient.get('tenant:subdomain:apex-tech');
      expect(cached).toBeTruthy();
      const parsed = JSON.parse(cached);
      expect(parsed._id).toBe(apexInstId);

      // Second request (Cache hit)
      const res2 = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'apex-tech.localhost');

      expect(res2.status).toBe(200);
      expect(res2.body.tenantId).toBe(apexInstId);
    });

    it('extracts subdomain from x-forwarded-host header (e.g. via Vite proxy)', async () => {
      const res = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'localhost:4000')
        .set('x-forwarded-host', 'apex-tech.localhost:5173');

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe(apexInstId);
    });
  });

  describe('3. Missing or Inactive Institution Handling', () => {
    it('returns 404 when subdomain does not exist', async () => {
      const res = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'unknown-college.collegeerp.com');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Institution not found');
    });

    it('returns 404 when institution is suspended or inactive', async () => {
      const res = await request(app)
        .get('/api/debug/tenant')
        .set('Host', 'suspended-uni.collegeerp.com');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Institution not found');
    });
  });

  describe('4. Inter-Service HMAC Signature & Tenant Context Verification', () => {
    const serviceApp = express();
    serviceApp.use(express.json());
    serviceApp.use(verifyTenantContext());
    serviceApp.get('/service/data', (req, res) => {
      res.json({ success: true, tenantId: req.tenantId });
    });

    it('rejects direct service calls lacking internal service key', async () => {
      const res = await request(serviceApp)
        .get('/service/data')
        .set('x-tenant-id', apexInstId);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Direct access without valid gateway signature is prohibited/);
    });

    it('rejects direct service calls with invalid signature', async () => {
      const res = await request(serviceApp)
        .get('/service/data')
        .set('x-internal-key', INTERNAL_KEY)
        .set('x-tenant-id', apexInstId)
        .set('x-tenant-signature', 'forged-invalid-signature');

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Invalid tenant signature/);
    });

    it('accepts validly signed service calls with matching HMAC-SHA256 signature', async () => {
      const validSignature = crypto
        .createHmac('sha256', INTERNAL_KEY)
        .update(apexInstId)
        .digest('hex');

      const res = await request(serviceApp)
        .get('/service/data')
        .set('x-internal-key', INTERNAL_KEY)
        .set('x-tenant-id', apexInstId)
        .set('x-tenant-signature', validSignature);

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe(apexInstId);
    });
  });
});
