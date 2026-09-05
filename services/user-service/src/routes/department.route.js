const express = require('express');
const router = express.Router();
const { requirePermission, authenticate } = require('@college-erp/shared-utils');
const departmentController = require('../controllers/department.controller');

// Require authentication for all department routes
router.use(authenticate);

// Only SuperAdmin or Admin (who inherently have institution-wide scope) can create departments.
// Note: we can map the 'Institution' resourceType to bypass checks unless they have SUPERADMIN/ADMIN role in RBAC.
router.post('/', requirePermission('write', 'Institution'), departmentController.createDepartment);

module.exports = router;
