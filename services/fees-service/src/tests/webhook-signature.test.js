process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.JWT_SECRET = 'test';

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const feesRoutes = require('../routes/fees.route');
const Payment = require('../models/Payment.model');

let mongoServer;
const app = express();
app.use(express.json()); // Assuming the webhook uses standard JSON parsing

// Stub out controller to just return 200 for other routes, we only care about the webhook
jest.mock('@college-erp/shared-utils', () => ({
  authenticate: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  success: (data) => ({ success: true, data }),
  fail: (error) => ({ success: false, error }),
  logAudit: jest.fn().mockResolvedValue()
}));

app.use('/api/fees', feesRoutes);

describe('Priority 5: Fee Webhook Signature Verification (Phase 17)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const payload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_123',
          amount: 50000,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_123',
          notes: {
            studentId: new mongoose.Types.ObjectId().toString(),
            feeStructureId: new mongoose.Types.ObjectId().toString()
          }
        }
      }
    }
  };

  it('rejects webhook payload without a signature header', async () => {
    const res = await request(app)
      .post('/api/fees/payments/webhook')
      .send(payload);

    expect(res.status).toBe(400); // Or 401 depending on implementation
    expect(res.body.message).toMatch(/signature/i);
  });

  it('rejects webhook payload with an invalid signature', async () => {
    const res = await request(app)
      .post('/api/fees/payments/webhook')
      .set('x-razorpay-signature', 'invalid_signature_string')
      .send(payload);

    expect(res.status).toBe(400); // Or 401
    expect(res.body.message).toMatch(/signature/i);
  });

  it('successfully processes webhook payload with a valid cryptographic signature', async () => {
    // Seed the order in the DB so it can be fulfilled
    const p = await Payment.create({
      studentId: new mongoose.Types.ObjectId().toString(),
      feeStructureId: new mongoose.Types.ObjectId().toString(),
      installmentIndex: 0,
      amount: 500,
      currency: 'INR',
      status: 'pending',
      gatewayRef: 'old_ref'
    });

    const payload = {
      paymentId: p._id.toString(),
      status: 'paid',
      gatewayRef: 'ref_123'
    };

    // Generate valid signature
    const secret = process.env.GATEWAY_SECRET = 'test_gateway_secret';
    const bodyString = JSON.stringify(payload);
    const expectedSignature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const res = await request(app)
      .post('/api/fees/payments/webhook')
      .set('x-razorpay-signature', expectedSignature) // wait, it's x-signature!
      .set('x-signature', expectedSignature)
      .send(payload);

    expect(res.status).toBe(200);
    
    // Verify it updated the DB
    const payment = await Payment.findById(p._id);
    expect(payment.status).toBe('paid');
  });
});
