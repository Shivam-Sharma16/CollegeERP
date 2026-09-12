const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/year.controller');

router.use(authenticate);

router.post('/',         requirePermission('write', 'Department'), ctrl.createYear);
router.get('/',          requirePermission('read',  'Department'), ctrl.listYears);
router.get('/:id',      requirePermission('read',  'Department'), ctrl.getYearById);
router.patch('/:id',     requirePermission('write', 'Department'), ctrl.updateYear);
router.delete('/:id',    requirePermission('write', 'Department'), ctrl.deleteYear);

module.exports = router;
