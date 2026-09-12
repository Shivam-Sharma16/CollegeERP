const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/record.controller');

router.use(authenticate);

// Student own records & summary
router.get('/me', ctrl.listOwnRecords);
router.get('/summary/me', ctrl.getOwnSummary);
router.get('/:id', ctrl.getRecordById);

// Faculty-only override — ownership verified inside controller
router.post('/:id/override', ctrl.overrideRecord);

module.exports = router;

