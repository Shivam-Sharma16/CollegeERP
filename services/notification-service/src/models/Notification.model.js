const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false // Using custom createdAt
});

// Index for efficiently finding unread notifications for a user
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
