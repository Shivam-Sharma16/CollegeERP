const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/superadmin/signup', authController.superadminSignup);
router.post('/register/student', authController.registerStudent);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
