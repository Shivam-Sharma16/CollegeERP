const request = require('supertest');
const express = require('express');
const subjectRoutes = require('../routes/subject.route');

const app = express();
app.use(express.json());

// Mock authenticate to inject a STUDENT user
jest.mock('@college-erp/shared-utils', () => {
  const actualUtils = jest.requireActual('@college-erp/shared-utils');
  return {
    ...actualUtils,
    authenticate: (req, res, next) => {
      req.user = { userId: 'student123', roles: ['STUDENT'] };
      req.effectiveRoles = []; // Students have no department/institution scope write access
      next();
    }
  };
});

app.use('/api/subjects', subjectRoutes);

describe('Priority 4: RBAC 403 Cases (Phase 10) - Academic Service', () => {
  it('rejects a STUDENT trying to create a subject with 403 Forbidden', async () => {
    // Subject creation requires 'write' permission on 'Department' scope
    const res = await request(app).post('/api/subjects').send({ name: 'Math', code: 'MTH101' });
    expect(res.status).toBe(403);

  });
});
