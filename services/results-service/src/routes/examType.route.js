const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const { createExamTypeHandler } = require('../controllers/examType.controller');

router.use(authenticate);
router.post('/', requirePermission('write', 'Department'), createExamTypeHandler);

module.exports = router;
