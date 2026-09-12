const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
  res.status(200).json({
    status: 'UP',
    service: 'institution-service',
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
