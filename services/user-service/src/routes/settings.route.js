const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const settingsController = require('../controllers/settings.controller');

// GET /api/settings/theme can be public or authenticated so theme can load on login page
router.get('/theme', settingsController.getThemeConfig);

// PATCH /api/settings/theme requires authentication (SuperAdmin)
router.patch('/theme', authenticate, settingsController.updateThemeConfig);

module.exports = router;
