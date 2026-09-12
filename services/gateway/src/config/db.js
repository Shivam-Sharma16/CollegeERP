const mongoose = require('mongoose');
const env = require('./env');

const connectDB = () => {
  mongoose.connect(env.MONGO_URI)
    .then(() => console.log('[Gateway] MongoDB connected for tenant resolution'))
    .catch(err => {
      console.warn('[Gateway] MongoDB connection warning, will retry:', err.message);
    });
};

module.exports = connectDB;
