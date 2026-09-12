const mongoose = require('mongoose');
const env = require('./env');

const connectDB = () => {
  mongoose.connect(env.MONGO_URI)
    .then(() => console.log('[institution-service] MongoDB connected'))
    .catch(err => {
      console.warn('[institution-service] MongoDB connection error, will retry later:', err.message);
    });
};

module.exports = connectDB;
