const express = require('express');
const router  = express.Router();
const { authenticate } = require('@college-erp/shared-utils');
const { resolveScope }  = require('../middlewares/resolveScope.middleware');
const ctrl = require('../controllers/notice.controller');

// POST /notices — Admin can target freely; CC/Faculty clamped to own section
router.post('/notices', authenticate, resolveScope, ctrl.createNotice);

// GET /notices/mine — returns notices visible to the authenticated user
router.get('/notices/mine', authenticate, ctrl.getNoticesMine);

// GET /notices/search — search notices visible to the caller
router.get('/notices/search', authenticate, ctrl.searchNotices);

// GET /notices/:id — retrieve notice by ID scoped to tenant
router.get('/notices/:id', authenticate, ctrl.getNoticeById);

// POST /notes — signed-URL upload; scope clamped to uploader's own section/dept
router.post('/notes', authenticate, resolveScope, ctrl.createNote);

// GET /notes — list notes scoped to tenant
router.get('/notes', authenticate, ctrl.listNotes);

// GET /notes/:id — retrieve note by ID scoped to tenant
router.get('/notes/:id', authenticate, ctrl.getNoteById);

// GET /upload-auth — ImageKit client upload authentication parameters
router.get('/upload-auth', authenticate, ctrl.getImageKitAuth);
router.get('/imagekit-auth', authenticate, ctrl.getImageKitAuth);

module.exports = router;
