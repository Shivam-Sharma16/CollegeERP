const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const ctrl = require('../controllers/agent.controller');

// All agent routes require authentication
router.use(authenticate);

/**
 * POST /api/agents/attendance-integrity
 * Body: { sessionId, prompt? }
 * Roles: FACULTY, ADMIN, SUPERADMIN
 */
router.post('/attendance-integrity', ctrl.runAttendanceIntegrity);

/**
 * POST /api/agents/at-risk
 * Body: { studentId, prompt? }
 * Roles: HOD, ADMIN, SUPERADMIN
 */
router.post('/at-risk', ctrl.runAtRisk);

/**
 * POST /api/agents/nl-query
 * Body: { prompt }
 * Roles: ADMIN, SUPERADMIN
 */
router.post('/nl-query', ctrl.runNlQuery);

/**
 * POST /api/agents/notice-draft
 * Body: { prompt }
 * Roles: FACULTY, HOD, ADMIN, SUPERADMIN
 */
router.post('/notice-draft', ctrl.runNoticeDraft);

/**
 * POST /api/agents/student-personal
 * Body: { prompt }
 * Roles: STUDENT (own data only — enforced server-side by tool implementations)
 */
router.post('/student-personal', ctrl.runStudentPersonal);

module.exports = router;
