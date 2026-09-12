const mongoose = require('mongoose');
const Notification = require('../models/Notification.model');
const { getIO } = require('../socket');

/**
 * Create a new notification and push it to the user if connected.
 * 
 * @param {string} userId - The target user's ObjectId string
 * @param {string} type - Notification type (e.g. NEW_NOTICE, FEE_REMINDER)
 * @param {Object} payload - Details about the notification
 * @param {string|ObjectId} [institutionId] - The tenant institutionId
 * @returns {Promise<Object>} The created notification document
 */
const createNotification = async (userId, type, payload, institutionId = null) => {
  let resolvedInstId = institutionId || payload?.institutionId;

  if (!resolvedInstId && mongoose.connection.db) {
    const user = await mongoose.connection.db.collection('users').findOne({
      _id: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId
    });
    if (user?.institutionId) {
      resolvedInstId = user.institutionId;
    }
  }

  // 1. Persist the notification in the DB
  const notification = await Notification.create({
    institutionId: resolvedInstId,
    userId,
    type,
    payload
  });

  // 2. Try to emit to the user's specific room
  try {
    const io = getIO();
    // Emit event 'notification' to anyone in room `userId`
    io.to(userId.toString()).emit('notification', notification);
  } catch (err) {
    console.error(`[Notification Service] Failed to emit to socket for user ${userId}:`, err.message);
  }

  return notification;
};

module.exports = {
  createNotification
};
