const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const {
  createExamTypeHandler,
  listExamTypesHandler,
  getExamTypeByIdHandler,
  updateExamTypeHandler
} = require('../controllers/examType.controller');

router.use(authenticate);
router.post('/', requirePermission('write', 'Department'), createExamTypeHandler);
router.get('/', requirePermission('read', 'Department'), listExamTypesHandler);
router.get('/:id', requirePermission('read', 'Department'), getExamTypeByIdHandler);
router.patch('/:id', requirePermission('write', 'Department'), updateExamTypeHandler);

module.exports = router;
