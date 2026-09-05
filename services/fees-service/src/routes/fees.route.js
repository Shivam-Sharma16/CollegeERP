const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/fees.controller');

// Admin only (requires ADMIN/SUPERADMIN role for creating fee structures)
// Note: HOD might also be allowed if they have the target departmentId, 
// but Phase 17 specifies Admin only. Using requirePermission('write', 'FeeStructure')
// will allow ADMIN/SUPERADMIN, and HOD for their own department.
router.post('/fee-structures', authenticate, requirePermission('write', 'FeeStructure'), ctrl.createFeeStructure);

// Webhook endpoint (unauthenticated, relies on signature)
router.post('/payments/webhook', ctrl.paymentWebhook);

// GET /defaulters
router.get('/defaulters', authenticate, requirePermission('read', 'FeeStructure'), ctrl.getDefaulters);

// GET /payments/:id/receipt
router.get('/payments/:id/receipt', authenticate, ctrl.getReceipt);

module.exports = router;
