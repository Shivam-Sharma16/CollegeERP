const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institution.controller');
const { authenticate } = require('@college-erp/shared-utils');

// Public tenant resolution by slug or subdomain
router.get('/resolve/:slug', institutionController.resolveInstitutionBySlug);
router.get('/resolve/subdomain/:subdomain', institutionController.resolveInstitutionBySlug);

// Live subdomain availability check
router.get('/check-subdomain', institutionController.checkSubdomainAvailability);
router.get('/check-subdomain/:subdomain', institutionController.checkSubdomainAvailability);
router.get('/:id/check-subdomain', institutionController.checkSubdomainAvailability);

// Authenticated tenant routes
router.use(authenticate);

router.post('/', institutionController.createInstitution);
router.get('/', institutionController.listInstitutions);
router.get('/:id', institutionController.getInstitutionById);
router.patch('/:id', institutionController.updateInstitution);

module.exports = router;
