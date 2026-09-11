const request = require('supertest');
const express = require('express');
const feesRoutes = require('../routes/fees.route');

const app = express();
app.use(express.json());

jest.mock('@college-erp/shared-utils', () => {
  const actualUtils = jest.requireActual('@college-erp/shared-utils');
  return {
    ...actualUtils,
    authenticate: (req, res, next) => {
      req.user = { userId: 'student123', roles: ['STUDENT'] };
      req.effectiveRoles = [];
      next();
    }
  };
});

app.use('/api/fees', feesRoutes);

describe('Priority 4: RBAC 403 Cases (Phase 10) - Fees Service', () => {
  it('rejects a STUDENT trying to create a fee structure', async () => {
    // Fee structure creation requires Admin ('write', 'Institution')
    const res = await request(app).post('/api/fees/fee-structures').send({});
    expect(res.status).toBe(403);
  });
});
