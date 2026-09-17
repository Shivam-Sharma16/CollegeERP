const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/batch.controller');

router.use(authenticate);

router.post('/',       requirePermission('write', 'Department'), ctrl.createBatch);
router.get('/',        requirePermission('read',  'Department'), ctrl.listBatches);
router.get('/:id',    requirePermission('read',  'Department'), ctrl.getBatchById);
router.patch('/:id',   requirePermission('write', 'Department'), ctrl.updateBatch);
router.put('/:id',     requirePermission('write', 'Department'), ctrl.updateBatch);
router.delete('/:id',  requirePermission('write', 'Department'), ctrl.deleteBatch);

module.exports = router;
