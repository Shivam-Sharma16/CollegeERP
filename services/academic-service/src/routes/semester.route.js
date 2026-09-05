const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/semester.controller');

router.use(authenticate);

router.post('/',         requirePermission('write', 'Department'), ctrl.createSemester);
router.get('/',          requirePermission('read',  'Department'), ctrl.listSemesters);
router.patch('/:id',     requirePermission('write', 'Department'), ctrl.updateSemester);
router.delete('/:id',    requirePermission('write', 'Department'), ctrl.deleteSemester);

module.exports = router;
