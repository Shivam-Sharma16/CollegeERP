process.env.PORT = '4008';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test_notification';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.INTERNAL_SERVICE_KEY = 'test_internal_key';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const notificationRoutes = require('../routes/notification.route');
const Notification = require('../models/Notification.model');

describe('Phase 68: Notification Service Tenant Isolation Tests', () => {
  let mongoServer;
  let app;
  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  let tokenA;
  let tokenB;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    tokenA = jwt.sign({ userId: userAId.toString(), institutionId: tenantAId.toString() }, process.env.JWT_SECRET);
    tokenB = jwt.sign({ userId: userBId.toString(), institutionId: tenantBId.toString() }, process.env.JWT_SECRET);

    app = express();
    app.use(express.json());
    app.use('/api/notifications', notificationRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let notifA, notifB;

  beforeEach(async () => {
    await Notification.deleteMany({});

    notifA = await Notification.create({
      userId: userAId,
      type: 'ANNOUNCEMENT',
      payload: { msg: 'Notice in Tenant A' },
      institutionId: tenantAId,
    });

    notifB = await Notification.create({
      userId: userBId,
      type: 'ANNOUNCEMENT',
      payload: { msg: 'Notice in Tenant B' },
      institutionId: tenantBId,
    });
  });

  test('Tenant A user cannot read Tenant B notification by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/notifications/${notifB._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  test('Tenant A user listing notifications only returns Tenant A notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(notifA._id.toString());
  });

  test('Tenant A user cannot mark read Tenant B notification (returns 404)', async () => {
    const res = await request(app)
      .patch(`/api/notifications/${notifB._id}/read`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    const untouched = await Notification.findById(notifB._id);
    expect(untouched.read).toBe(false);
  });

  test('Tenant A user unread count is strictly isolated to Tenant A notifications', async () => {
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
  });
});
