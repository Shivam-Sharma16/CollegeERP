const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/session.controller');

router.use(authenticate);

// Faculty-facing (requires TeachingAssignment ownership, validated inside controller)
router.post('/',           ctrl.createSession);
router.get('/:id/qr',     ctrl.rotateQR);
router.post('/:id/close', ctrl.closeSession);

// Student-facing (no role gate — session.status === 'active' is the gate)
router.post('/:id/checkin', ctrl.checkIn);

module.exports = router;
