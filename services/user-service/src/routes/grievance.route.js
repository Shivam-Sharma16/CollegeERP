const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const grievanceController = require('../controllers/grievance.controller');

router.use(authenticate);

router.post('/', grievanceController.createGrievance);
router.get('/', grievanceController.listGrievances);
router.get('/:id', grievanceController.getGrievanceById);
router.post('/:id/resolve', grievanceController.resolveGrievance);
router.patch('/:id/resolve', grievanceController.resolveGrievance);
router.patch('/:id/assign', grievanceController.assignGrievance);

module.exports = router;
