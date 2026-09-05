const mongoose = require('mongoose');
const Notification = require('../models/Notification.model');
const { createNotification } = require('../services/notification.service');

// ─── Public: GET /api/notifications ──────────────────────────────────────────
/**
 * Returns notifications for the authenticated user, newest-first.
 * Query params:
 *   - unreadOnly=true  → only unread
 *   - page (default 1), limit (default 20)
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const { unreadOnly, page = 1, limit = 20 } = req.query;

    const filter = { userId };
    if (unreadOnly === 'true') filter.read = false;

    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: notifications,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('[notification.controller] getNotifications:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Public: PATCH /api/notifications/:id/read ───────────────────────────────
const markRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid notification id' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },    // ownership check — users can only read their own
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    return res.json({ success: true, data: notification });
  } catch (err) {
    console.error('[notification.controller] markRead:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Public: PATCH /api/notifications/read-all ───────────────────────────────
const markAllRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;

    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    return res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (err) {
    console.error('[notification.controller] markAllRead:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Internal: POST /internal/events ─────────────────────────────────────────
/**
 * Called by other services (attendance-service, fees-service, …).
 * Body: { userId, type, payload }
 * Protected by internalAuth middleware — never exposed to public JWT clients.
 */
const internalCreateEvent = async (req, res) => {
  try {
    const { userId, type, payload } = req.body;

    if (!userId || !type || payload === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, type, and payload are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid userId' });
    }

    const notification = await createNotification(userId, type, payload);

    return res.status(201).json({ success: true, data: notification });
  } catch (err) {
    console.error('[notification.controller] internalCreateEvent:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = { getNotifications, markRead, markAllRead, internalCreateEvent };
