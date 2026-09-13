const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const { enterMarks, enterMarksBulk, getMarksRecordById, listMarks, getReportsDistribution } = require('../controllers/marks.controller');

router.use(authenticate);

// Reports endpoints
router.get('/reports/distribution', getReportsDistribution);
router.get('/reports/grade-distribution', getReportsDistribution);
router.get('/reports/subject-averages', getReportsDistribution);
router.get('/reports/subject-performance', getReportsDistribution);

// Ownership check is inside the controller (against TeachingAssignment DB)
router.post('/', enterMarks);
router.post('/bulk', enterMarksBulk);
router.get('/', listMarks);
router.get('/:id([0-9a-fA-F]{24})', getMarksRecordById);

module.exports = router;
