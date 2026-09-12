const express = require('express');
const router = express.Router();
const { requirePermission, authenticate } = require('@college-erp/shared-utils');
const departmentController = require('../controllers/department.controller');

// Require authentication for all department routes
router.use(authenticate);

// Only SuperAdmin or Admin (who inherently have institution-wide scope) can create departments.
// Note: we can map the 'Institution' resourceType to bypass checks unless they have SUPERADMIN/ADMIN role in RBAC.
router.post('/', requirePermission('write', 'Institution'), departmentController.createDepartment);
router.get('/tree', departmentController.resolveDeptTree);
router.get('/', departmentController.listDepartments);
router.get('/:id', departmentController.getDepartmentById);
router.patch('/:id', requirePermission('write', 'Institution'), departmentController.updateDepartment);
router.delete('/:id', requirePermission('write', 'Institution'), departmentController.deleteDepartment);

module.exports = router;
