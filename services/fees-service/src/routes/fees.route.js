const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('@college-erp/shared-utils');
const ctrl = require('../controllers/fees.controller');

// Admin only (requires ADMIN/SUPERADMIN role for creating fee structures)
// Note: HOD might also be allowed if they have the target departmentId, 
// but Phase 17 specifies Admin only. Using requirePermission('write', 'FeeStructure')
// will allow ADMIN/SUPERADMIN, and HOD for their own department.
router.post('/fee-structures', authenticate, requirePermission('write', 'FeeStructure'), ctrl.createFeeStructure);
router.get('/fee-structures', authenticate, requirePermission('read', 'FeeStructure'), ctrl.listFeeStructures);
router.get('/fee-structures/:id', authenticate, requirePermission('read', 'FeeStructure'), ctrl.getFeeStructureById);

// Webhook endpoint (unauthenticated, relies on signature)
router.post('/payments/webhook', ctrl.paymentWebhook);

// Student fee status
router.get('/students/me/status', authenticate, ctrl.getOwnFeeStatus);

// Initiate payment
router.post('/payments/initiate', authenticate, ctrl.initiatePayment);

// GET /defaulters
router.get('/defaulters', authenticate, requirePermission('read', 'FeeStructure'), ctrl.getDefaulters);

// GET /payments/:id/receipt
router.get('/payments/:id/receipt', authenticate, ctrl.getReceipt);

// GET /collection-summary (Admin dashboard metrics)
router.get('/collection-summary', authenticate, ctrl.getCollectionSummary);

// GET /reports/collection-trend (Admin reports)
router.get('/reports/collection-trend', authenticate, ctrl.getCollectionTrend);

module.exports = router;
