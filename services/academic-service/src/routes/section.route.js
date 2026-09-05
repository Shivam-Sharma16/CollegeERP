const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/section.controller');

router.use(authenticate);

router.post('/',         requirePermission('write', 'Department'), ctrl.createSection);
router.get('/',          requirePermission('read',  'Department'), ctrl.listSections);
router.patch('/:id',     requirePermission('write', 'Department'), ctrl.updateSection);
router.delete('/:id',    requirePermission('write', 'Department'), ctrl.deleteSection);

module.exports = router;
