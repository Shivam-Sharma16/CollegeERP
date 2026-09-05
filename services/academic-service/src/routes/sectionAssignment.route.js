const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/sectionAssignment.controller');

router.use(authenticate);

// Create (with optional atomic handover via closeExistingId)
router.post('/',                       requirePermission('write', 'Department'), ctrl.createSectionAssignment);
// Get current active CC for a section (getSectionCC from Phase 3)
router.get('/current/:sectionId',      requirePermission('read',  'Department'), ctrl.getSectionCC);
// Explicitly close an assignment
router.delete('/:id',                  requirePermission('write', 'Department'), ctrl.closeSectionAssignment);

module.exports = router;
