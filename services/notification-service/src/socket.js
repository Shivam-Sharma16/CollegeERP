const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('./config/env');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust this for production
      methods: ['GET', 'POST']
    }
  });

  // Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      // In a microservices environment, verify against the shared JWT_SECRET
      const secret = process.env.JWT_SECRET || 'fallback_secret';
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.userId || decoded.id; // Support different standard payloads
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} for User: ${socket.userId}`);
    
    // Join a room exclusively for this user
    socket.join(socket.userId.toString());

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIO };
