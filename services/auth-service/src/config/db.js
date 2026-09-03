const mongoose = require('mongoose');
const env = require('./env');

const connectDB = () => {
  mongoose.connect(env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => {
      console.warn('MongoDB connection error, will retry later:', err.message);
    });
};

module.exports = connectDB;
