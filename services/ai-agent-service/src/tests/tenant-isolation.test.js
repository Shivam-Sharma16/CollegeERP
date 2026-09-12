process.env.PORT = '4009';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test_ai_agent';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.INTERNAL_SERVICE_KEY = 'test_internal_key';

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const agentRoutes = require('../routes/agent.route');
const AgentReviewItem = require('../models/AgentReviewItem.model');

describe('Phase 68: AI Agent Service Tenant Isolation Tests', () => {
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
    app.use('/api/agents', agentRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let itemA, itemB;

  beforeEach(async () => {
    await AgentReviewItem.deleteMany({});

    itemA = await AgentReviewItem.create({
      agentName: 'atRiskStudentAgent',
      targetStudentId: new mongoose.Types.ObjectId(),
      summary: 'At-risk attendance in Tenant A',
      suggestedAction: 'Mentorship',
      createdBy: userAId,
      institutionId: tenantAId,
    });

    itemB = await AgentReviewItem.create({
      agentName: 'atRiskStudentAgent',
      targetStudentId: new mongoose.Types.ObjectId(),
      summary: 'At-risk attendance in Tenant B',
      suggestedAction: 'Mentorship',
      createdBy: userBId,
      institutionId: tenantBId,
    });
  });

  test('Tenant A user cannot read Tenant B review item by ID (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/agents/review-items/${itemB._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  test('Tenant A user listing review items only returns Tenant A items', async () => {
    const res = await request(app)
      .get('/api/agents/review-items')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]._id.toString()).toBe(itemA._id.toString());
  });
});
