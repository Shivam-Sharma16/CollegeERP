const request = require('supertest');
const express = require('express');
const examTypeRoutes = require('../routes/examType.route');

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

app.use('/api/exam-types', examTypeRoutes);

describe('Priority 4: RBAC 403 Cases (Phase 10) - Results Service', () => {
  it('rejects a STUDENT trying to create an exam type', async () => {
    const res = await request(app).post('/api/exam-types').send({});
    expect(res.status).toBe(403);
  });
});
