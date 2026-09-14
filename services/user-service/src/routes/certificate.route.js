const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const certificateController = require('../controllers/certificate.controller');

router.use(authenticate);

router.post('/bonafide', certificateController.generateBonafide);
router.post('/transfer', certificateController.generateTransfer);

module.exports = router;
