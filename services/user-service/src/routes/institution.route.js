const express = require('express');
const router = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const institutionController = require('../controllers/institution.controller');

// Public route for whitelabel resolution by slug
router.get('/resolve/:slug', institutionController.resolveInstitutionBySlug);

// Protected routes
router.use(authenticate);

router.post('/', institutionController.createInstitution);
router.get('/', institutionController.listInstitutions);
router.get('/:id', institutionController.getInstitutionById);
router.patch('/:id', institutionController.updateInstitution);

module.exports = router;
