const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const reportsController = require('../controllers/reports.controller');

router.use(authenticate);

router.get('/dashboard-stats', reportsController.getDashboardStats);
router.get('/hod-stats', reportsController.getHodDashboardStats);

module.exports = router;
