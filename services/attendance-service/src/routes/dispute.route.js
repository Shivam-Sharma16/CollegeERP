const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/dispute.controller');

router.use(authenticate);

// HOD-facing routes (ownership verified inside controller)
router.get('/escalated', ctrl.listEscalatedDisputes);
router.post('/:id([0-9a-fA-F]{24})/resolve-escalation', ctrl.resolveEscalation);

module.exports = router;
