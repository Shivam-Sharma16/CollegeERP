const mongoose = require('mongoose');
const env = require('./env');

const connectDB = () => {
  mongoose.connection.on('error', (err) => {
    console.error('[Gateway Mongo Connection Error]:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Gateway Mongo Disconnected] Attempting reconnect in 5s...');
    setTimeout(() => {
      if (mongoose.connection.readyState === 0) {
        mongoose.connect(env.MONGO_URI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        }).catch(err => console.error('[Gateway Mongo Reconnect Failed]:', err.message));
      }
    }, 5000);
  });

  mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
    .then(() => console.log('[Gateway] MongoDB connected for tenant resolution'))
    .catch(err => {
      console.warn('[Gateway] MongoDB initial connection warning, will retry:', err.message);
    });
};

module.exports = connectDB;
