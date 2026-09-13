const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const userController = require('../controllers/user.controller');

router.use(authenticate);

// We attach requirePermission to fetch effectiveRoles so controllers can access req.effectiveRoles.
// We use a generic 'Institution' resourceType for Admins and HODs (since the HOD creation targets a department, the caller Admin has Institution scope).
// We use a 'Department' resourceType for Faculty/CC (HOD creates them, so HOD has Department scope).
// The controllers will enforce the strict downward hierarchy.
// Search and Profile
router.get('/search', userController.searchUsers);
router.get('/me', userController.getOwnProfile);
router.patch('/me', userController.updateOwnProfile);

router.post('/admins', requirePermission('write', 'Institution'), userController.createAdmin);
router.get('/admins', userController.listAdmins);

router.post('/hods', requirePermission('write', 'Institution'), userController.createHOD);
router.get('/hods', userController.listHods);

router.post('/faculty', requirePermission('write', 'Department'), userController.createFaculty);
router.get('/faculty', userController.listFaculty);

router.post('/cc', requirePermission('write', 'Department'), userController.createCC);
router.get('/cc', userController.listCC);

router.post('/students', requirePermission('write', 'Section'), userController.onboardStudent);
router.get('/students', requirePermission('read', 'Section'), userController.listStudents);

router.get('/', userController.listUsers);
router.get('/:id', userController.getUserById);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
