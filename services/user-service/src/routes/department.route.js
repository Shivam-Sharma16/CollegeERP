const express = require('express');
const router = express.Router();
const { requirePermission, authenticate } = require('@college-erp/shared-utils');
const departmentController = require('../controllers/department.controller');

// Require authentication for all department routes
router.use(authenticate);

// Phase 69: Department Creation Ownership Change
// POST /departments is Admin-only, scoped strictly to req.user.institutionId.
// SuperAdmin is explicitly disallowed from creating departments.
const requireAdminOnly = (req, res, next) => {
  if (req.user?.roles?.includes('SUPERADMIN') || !req.user?.roles?.includes('ADMIN')) {
    return res.status(403).json({ success: false, error: 'Access Denied: Only Admin can create departments' });
  }
  next();
};

router.post('/', requireAdminOnly, departmentController.createDepartment);
router.get('/tree', departmentController.resolveDeptTree);
router.get('/', departmentController.listDepartments);
router.get('/:id', departmentController.getDepartmentById);
router.patch('/:id', requirePermission('write', 'Institution'), departmentController.updateDepartment);
router.delete('/:id', requirePermission('write', 'Institution'), departmentController.deleteDepartment);

module.exports = router;
