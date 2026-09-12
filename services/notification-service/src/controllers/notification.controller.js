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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { unreadOnly, page = 1, limit = 20 } = req.query;

    const filter = { userId: new mongoose.Types.ObjectId(userId) };
    if (tenantId) {
      filter.institutionId = new mongoose.Types.ObjectId(tenantId);
    }
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

// ─── Public: GET /api/notifications/:id ──────────────────────────────────────
const getNotificationById = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid notification id' });
    }

    const query = { _id: id, userId: new mongoose.Types.ObjectId(userId) };
    if (tenantId) {
      query.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const notification = await Notification.findOne(query).lean();
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    return res.json({ success: true, data: notification });
  } catch (err) {
    console.error('[notification.controller] getNotificationById:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Public: PATCH /api/notifications/:id/read ───────────────────────────────
const markRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid notification id' });
    }

    const query = { _id: id, userId: new mongoose.Types.ObjectId(userId) };
    if (tenantId) {
      query.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const notification = await Notification.findOneAndUpdate(
      query,
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
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    const query = { userId: new mongoose.Types.ObjectId(userId), read: false };
    if (tenantId) {
      query.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const result = await Notification.updateMany(
      query,
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

// ─── Public: GET /api/notifications/unread-count ─────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId;

    const query = {
      userId: new mongoose.Types.ObjectId(userId),
      read: false
    };
    if (tenantId) {
      query.institutionId = new mongoose.Types.ObjectId(tenantId);
    }

    const count = await Notification.countDocuments(query);
    return res.json({
      success: true,
      data: { count, unreadCount: count }
    });
  } catch (err) {
    console.error('[notification.controller] getUnreadCount:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Internal: POST /internal/events ─────────────────────────────────────────
/**
 * Called by other services (attendance-service, fees-service, …).
 * Body: { userId, type, payload, institutionId }
 * Protected by internalAuth middleware — never exposed to public JWT clients.
 */
const internalCreateEvent = async (req, res) => {
  try {
    const { userId, type, payload, institutionId } = req.body;

    if (!userId || !type || payload === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, type, and payload are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid userId' });
    }

    const resolvedInstId = req.headers['x-tenant-id'] || institutionId || payload?.institutionId || null;
    const notification = await createNotification(userId, type, payload, resolvedInstId);

    return res.status(201).json({ success: true, data: notification });
  } catch (err) {
    console.error('[notification.controller] internalCreateEvent:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  getNotifications,
  getNotificationById,
  markRead,
  markAllRead,
  getUnreadCount,
  internalCreateEvent
};
