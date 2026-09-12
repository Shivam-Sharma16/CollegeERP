process.env.PORT = '4008';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test_notification';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.INTERNAL_SERVICE_KEY = 'test_internal_key';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../models/Notification.model');
const { createNotification } = require('../services/notification.service');

let mongoServer;

describe('Notification Service Unit Tests', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Notification.deleteMany({});
  });

  it('creates and persists a new notification document', async () => {
    const dummyUserId = new mongoose.Types.ObjectId();
    const dummyInstId = new mongoose.Types.ObjectId();
    const notification = await createNotification(dummyUserId, 'TEST_ALERT', { message: 'Hello World' }, dummyInstId);

    expect(notification).toBeDefined();
    expect(notification.type).toBe('TEST_ALERT');
    expect(notification.read).toBe(false);
    expect(notification.payload.message).toBe('Hello World');
    expect(notification.institutionId.toString()).toBe(dummyInstId.toString());

    const found = await Notification.findById(notification._id);
    expect(found).toBeTruthy();
    expect(found.type).toBe('TEST_ALERT');
  });

  it('defaults read status to false', async () => {
    const dummyUserId = new mongoose.Types.ObjectId();
    const notif = await Notification.create({
      institutionId: new mongoose.Types.ObjectId(),
      userId: dummyUserId,
      type: 'INFO',
      payload: { text: 'Information' }
    });

    expect(notif.read).toBe(false);
  });
});
