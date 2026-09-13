const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/record.controller');

router.use(authenticate);

// Institution summary & reports (Admin/Faculty)
router.get('/institution-summary', ctrl.getInstitutionSummary);
router.get('/reports/trend', ctrl.getAttendanceTrend);
router.get('/reports/subject-trend', ctrl.getAttendanceTrend);
router.get('/reports/section-comparison', ctrl.getAttendanceTrend);

// Student own records & summary
router.get('/me', ctrl.listOwnRecords);
router.get('/summary/me', ctrl.getOwnSummary);
router.get('/:id([0-9a-fA-F]{24})', ctrl.getRecordById);

// Faculty-only override — ownership verified inside controller
router.post('/:id([0-9a-fA-F]{24})/override', ctrl.overrideRecord);

module.exports = router;
