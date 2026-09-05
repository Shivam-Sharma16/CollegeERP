const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const { getTranscript } = require('../controllers/transcript.controller');

router.use(authenticate);
router.get('/:id/transcript', getTranscript);

module.exports = router;
