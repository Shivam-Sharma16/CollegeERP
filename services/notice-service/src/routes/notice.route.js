const express = require('express');
const router  = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const { resolveScope }  = require('../middlewares/resolveScope.middleware');
const ctrl = require('../controllers/notice.controller');

// POST /notices — Admin can target freely; CC/Faculty clamped to own section
router.post('/notices', authenticate, resolveScope, ctrl.createNotice);

// GET /notices/mine — returns notices visible to the authenticated user
router.get('/notices/mine', authenticate, ctrl.getNoticesMine);

// POST /notes — signed-URL upload; scope clamped to uploader's own section/dept
router.post('/notes', authenticate, resolveScope, ctrl.createNote);

module.exports = router;
