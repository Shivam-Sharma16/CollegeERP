const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const ctrl = require('../controllers/notification.controller');

// All routes require a valid user JWT
router.use(authenticate);

// GET  /api/notifications            — list (paginated, optional ?unreadOnly=true)
router.get('/', ctrl.getNotifications);

// GET  /api/notifications/unread-count — total unread notifications count
router.get('/unread-count', ctrl.getUnreadCount);

// PATCH /api/notifications/read-all  — bulk-mark all as read
// Must be registered BEFORE /:id/read so Express doesn't treat "read-all" as an :id
router.patch('/read-all', ctrl.markAllRead);

// PATCH /api/notifications/:id/read  — mark a single notification as read
router.patch('/:id/read', ctrl.markRead);

// GET  /api/notifications/:id        — retrieve notification by id scoped to tenant
router.get('/:id', ctrl.getNotificationById);

module.exports = router;
