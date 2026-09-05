const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/record.controller');

router.use(authenticate);

// Faculty-only override — ownership verified inside controller
router.post('/:id/override', ctrl.overrideRecord);

module.exports = router;
