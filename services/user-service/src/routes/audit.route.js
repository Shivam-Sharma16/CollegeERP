const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const auditController = require('../controllers/audit.controller');

router.use(authenticate);

// Superadmin / Admin can view recent activity audit logs
router.get('/recent', auditController.getRecentActivity);

module.exports = router;
