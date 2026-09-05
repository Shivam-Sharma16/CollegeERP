const express = require('express');
const router = express.Router();
const { internalAuth } = require('../middlewares/internalAuth');
const ctrl = require('../controllers/notification.controller');

// All routes under /internal require the shared service key
router.use(internalAuth);

// POST /internal/events — triggered by attendance-service, fees-service, etc.
router.post('/events', ctrl.internalCreateEvent);

module.exports = router;
