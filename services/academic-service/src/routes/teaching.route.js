const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/teaching.controller');

router.use(authenticate);

router.post('/',      requirePermission('write', 'Department'), ctrl.createTeachingAssignment);
router.get('/',       requirePermission('read',  'Department'), ctrl.listTeachingAssignments);
router.get('/faculty-load/:facultyId', requirePermission('read', 'Department'), ctrl.getFacultyLoad);
router.patch('/:id',  requirePermission('write', 'Department'), ctrl.updateTeachingAssignment);
router.delete('/:id', requirePermission('write', 'Department'), ctrl.deleteTeachingAssignment);

module.exports = router;
