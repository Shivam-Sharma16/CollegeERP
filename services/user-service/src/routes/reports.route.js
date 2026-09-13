const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const reportsController = require('../controllers/reports.controller');

router.use(authenticate);

// Phase 77: Institution Analytics & Reporting
router.get('/overview', requirePermission('reports.view.institution'), reportsController.getOverview);
router.get('/attendance-trend', requirePermission('reports.view.institution'), reportsController.getAttendanceTrend);
router.get('/academic-performance', requirePermission('reports.view.institution'), reportsController.getAcademicPerformance);
router.get('/faculty-workload', requirePermission('reports.view.institution'), reportsController.getFacultyWorkload);

// Legacy dashboard stats
router.get('/dashboard-stats', reportsController.getDashboardStats);
router.get('/hod-stats', reportsController.getHodDashboardStats);

module.exports = router;

