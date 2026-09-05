const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/subject.controller');

router.use(authenticate);

router.post('/',         requirePermission('write', 'Department'), ctrl.createSubject);
router.get('/',          requirePermission('read',  'Department'), ctrl.listSubjects);
router.patch('/:id',     requirePermission('write', 'Department'), ctrl.updateSubject);
router.delete('/:id',    requirePermission('write', 'Department'), ctrl.deleteSubject);

module.exports = router;
