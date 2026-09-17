const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/section.controller');
const batchCtrl = require('../controllers/batch.controller');

router.use(authenticate);

router.post('/',            requirePermission('write', 'Department'), ctrl.createSection);
router.get('/',             requirePermission('read',  'Department'), ctrl.listSections);
router.get('/:id',         requirePermission('read',  'Department'), ctrl.getSectionById);
router.patch('/:id',        requirePermission('write', 'Department'), ctrl.updateSection);
router.delete('/:id',       requirePermission('write', 'Department'), ctrl.deleteSection);

// Phase 84: Section Batches
router.post('/:id/batches', requirePermission('write', 'Department'), batchCtrl.createSectionBatch);
router.get('/:id/batches',  requirePermission('read',  'Department'), batchCtrl.listSectionBatches);

module.exports = router;
