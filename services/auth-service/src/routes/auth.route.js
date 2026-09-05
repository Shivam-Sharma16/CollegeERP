const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');

// Limiters
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes' }
});

const superadminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: { success: false, error: 'Too many setup attempts from this IP, please try again after an hour' },
  handler: (req, res, next, options) => {
    console.error(`[ALERT] Superadmin signup rate limit exceeded by IP: ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  }
});

// Validation Schemas
const superadminSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  setupKey: Joi.string().required()
});

const studentRegisterSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  departmentId: Joi.string().required(),
  sectionId: Joi.string().required()
}).unknown(true); // Allow other fields like role to be sent (which we will ignore) to test the security constraint

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Routes
router.post('/superadmin/signup', superadminLimiter, validate(superadminSchema), authController.superadminSignup);
router.post('/register/student', standardLimiter, validate(studentRegisterSchema), authController.registerStudent);
router.post('/login', standardLimiter, validate(loginSchema), authController.login);
router.post('/refresh', standardLimiter, authController.refresh);
router.post('/logout', standardLimiter, authController.logout);

module.exports = router;
