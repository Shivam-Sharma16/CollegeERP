const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const { enterMarks, enterMarksBulk, getMarksRecordById, listMarks } = require('../controllers/marks.controller');

router.use(authenticate);

// Ownership check is inside the controller (against TeachingAssignment DB)
router.post('/',       enterMarks);
router.post('/bulk',   enterMarksBulk);
router.get('/',        listMarks);
router.get('/:id',     getMarksRecordById);

module.exports = router;
