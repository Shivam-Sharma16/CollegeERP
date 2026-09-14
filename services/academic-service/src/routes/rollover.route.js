const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const rolloverController = require('../controllers/rollover.controller');

router.use(authenticate);

router.post('/rollover', rolloverController.rolloverSemester);
router.post('/', rolloverController.rolloverSemester);

module.exports = router;
