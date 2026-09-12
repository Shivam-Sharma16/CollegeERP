process.env.PORT = '4010';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_12345';
process.env.INTERNAL_SERVICE_KEY = 'test_internal_key';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const institutionRoutes = require('../routes/institution.route');
const Institution = require('../models/Institution.model');

describe('Phase 70: Per-Institution White-Labeling & Branding Endpoint', () => {
  let mongoServer;
  let app;
  let apexInst;
  let beaconInst;
  let suspendedInst;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());

    // Simulate gateway passing tenant context header
    app.use((req, res, next) => {
      const headerTenant = req.headers['x-tenant-id'];
      if (headerTenant) {
        req.tenantId = headerTenant;
      }
      next();
    });

    app.use('/institutions', institutionRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Institution.deleteMany({});

    apexInst = await Institution.create({
      name: 'Apex Institute of Technology',
      subdomain: 'apex-tech',
      logoUrl: 'https://cdn.example.com/apex-logo.svg',
      themeConfig: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        faviconUrl: 'https://cdn.example.com/apex-favicon.ico',
      },
      isActive: true,
      status: 'ACTIVE',
      createdBy: new mongoose.Types.ObjectId(),
    });

    beaconInst = await Institution.create({
      name: 'Beacon University',
      subdomain: 'beacon-univ',
      logoUrl: 'https://cdn.example.com/beacon-logo.svg',
      themeConfig: {
        primaryColor: '#059669',
        secondaryColor: '#10b981',
        faviconUrl: 'https://cdn.example.com/beacon-favicon.ico',
      },
      isActive: true,
      status: 'ACTIVE',
      createdBy: new mongoose.Types.ObjectId(),
    });

    suspendedInst = await Institution.create({
      name: 'Suspended College',
      subdomain: 'suspended-college',
      isActive: false,
      status: 'SUSPENDED',
      createdBy: new mongoose.Types.ObjectId(),
    });
  });

  it('1. Fetches branding via gateway x-tenant-id without ANY authentication tokens', async () => {
    const res = await request(app)
      .get('/institutions/branding')
      .set('x-tenant-id', apexInst._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      name: 'Apex Institute of Technology',
      logoUrl: 'https://cdn.example.com/apex-logo.svg',
      primaryColor: '#4f46e5',
      secondaryColor: '#06b6d4',
      faviconUrl: 'https://cdn.example.com/apex-favicon.ico',
    });
  });

  it('2. Fetches branding via query parameter ?subdomain=beacon-univ without auth', async () => {
    const res = await request(app)
      .get('/institutions/branding?subdomain=beacon-univ');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Beacon University');
    expect(res.body.data.primaryColor).toBe('#059669');
    expect(res.body.data.secondaryColor).toBe('#10b981');
    expect(res.body.data.logoUrl).toBe('https://cdn.example.com/beacon-logo.svg');
    expect(res.body.data.faviconUrl).toBe('https://cdn.example.com/beacon-favicon.ico');
  });

  it('3. Fetches branding via path parameter /institutions/branding/apex-tech', async () => {
    const res = await request(app)
      .get('/institutions/branding/apex-tech');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Apex Institute of Technology');
    expect(res.body.data.primaryColor).toBe('#4f46e5');
  });

  it('4. Returns visibly distinct branding across two different institutions', async () => {
    const resApex = await request(app).get('/institutions/branding?subdomain=apex-tech');
    const resBeacon = await request(app).get('/institutions/branding?subdomain=beacon-univ');

    expect(resApex.status).toBe(200);
    expect(resBeacon.status).toBe(200);

    // Completely distinct colors and logos
    expect(resApex.body.data.primaryColor).not.toBe(resBeacon.body.data.primaryColor);
    expect(resApex.body.data.logoUrl).not.toBe(resBeacon.body.data.logoUrl);
    expect(resApex.body.data.name).not.toBe(resBeacon.body.data.name);

    expect(resApex.body.data.primaryColor).toBe('#4f46e5');
    expect(resBeacon.body.data.primaryColor).toBe('#059669');
  });

  it('5. Returns 404 when subdomain does not match any institution', async () => {
    const res = await request(app)
      .get('/institutions/branding?subdomain=unknown-college');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('6. Returns 403 when requesting branding for a suspended/inactive institution', async () => {
    const res = await request(app)
      .get('/institutions/branding?subdomain=suspended-college');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
