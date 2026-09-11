process.env.JWT_ACCESS_SECRET = 'test';
process.env.JWT_REFRESH_SECRET = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.PORT = '4001';
process.env.SUPERADMIN_SETUP_KEY = 'test_secret_key';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authRoutes = require('../routes/auth.route');
const User = require('../models/User.model');
const env = require('../config/env');

let mongoServer;
const app = express();
app.use(express.json());
// Stub req.ip for rate limiter
app.set('trust proxy', true);
app.use('/api/auth', authRoutes);

describe('Priority 2: Superadmin Signup Restriction (Phase 9)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  it('rejects signup with missing/invalid setup key', async () => {
    const res = await request(app)
      .post('/api/auth/superadmin/signup')
      .send({
        name: 'Invalid Admin',
        email: 'invalid@example.com',
        password: 'password123',
        setupKey: 'wrong_key'
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Invalid setup key/i);
    
    const count = await User.countDocuments();
    expect(count).toBe(0);
  });

  it('successfully creates the first superadmin with the valid setup key', async () => {
    const res = await request(app)
      .post('/api/auth/superadmin/signup')
      .send({
        name: 'First Admin',
        email: 'admin1@example.com',
        password: 'password123',
        setupKey: 'test_secret_key'
      });
    expect(res.status).toBe(201);
    
    const user = await User.findOne({ email: 'admin1@example.com' });
    expect(user).toBeTruthy();
    expect(user.roles).toContain('SUPERADMIN');
  });

  it('enforces one-time lock: rejects subsequent superadmin signups even with valid key', async () => {
    // 1. Seed existing superadmin
    await User.create({
      name: 'Existing Admin',
      email: 'admin1@example.com',
      passwordHash: 'hash',
      roles: ['SUPERADMIN']
    });

    // 2. Attempt to create another one
    const res = await request(app)
      .post('/api/auth/superadmin/signup')
      .send({
        name: 'Second Admin',
        email: 'admin2@example.com',
        password: 'password123',
        setupKey: 'test_secret_key'
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Superadmin already exists/i);
    
    const count = await User.countDocuments();
    expect(count).toBe(1); // Still only 1
  });
});
