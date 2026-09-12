const mongoose = require('mongoose');
const User = require('../models/User.model');
const { success, fail } = require('@college-erp/shared-utils');

const getRecentActivity = async (req, res) => {
  try {
    if (!mongoose.connection.db) {
      return res.status(200).json(success([]));
    }

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const logs = await mongoose.connection.db
      .collection('auditlogs')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    const actorIds = logs
      .map(l => l.actorId)
      .filter(id => id && mongoose.Types.ObjectId.isValid(id));

    const actors = await User.find({ _id: { $in: actorIds } }).select('name email');
    const actorMap = new Map(actors.map(a => [a._id.toString(), a.email || a.name]));

    const formatted = logs.map(l => {
      const actorName = l.actorId ? (actorMap.get(l.actorId.toString()) || 'User') : 'System';
      return {
        id: l._id,
        action: l.action,
        user: actorName,
        actorRole: l.actorRole,
        targetType: l.targetType,
        details: l.details,
        timestamp: l.timestamp
      };
    });

    res.status(200).json(success(formatted));
  } catch (err) {
    console.error('[AuditController] Failed to fetch recent activity:', err);
    res.status(500).json(fail('Internal server error'));
  }
};

module.exports = {
  getRecentActivity
};
