const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const userController = require('../controllers/user.controller');

router.use(authenticate);

// We attach requirePermission to fetch effectiveRoles so controllers can access req.effectiveRoles.
// We use a generic 'Institution' resourceType for Admins and HODs (since the HOD creation targets a department, the caller Admin has Institution scope).
// We use a 'Department' resourceType for Faculty/CC (HOD creates them, so HOD has Department scope).
// The controllers will enforce the strict downward hierarchy.

router.post('/admins', requirePermission('write', 'Institution'), userController.createAdmin);
router.post('/hods', requirePermission('write', 'Institution'), userController.createHOD);
router.post('/faculty', requirePermission('write', 'Department'), userController.createFaculty);
router.post('/cc', requirePermission('write', 'Department'), userController.createCC);

module.exports = router;
