const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const passport = require('./config/passport');
const cron = require('node-cron');

const routes = require('./routes');
const { processPendingNotifications } = require('./services/notificationService');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.JWT_SECRET || 'session-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Attach io to requests for real-time features
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cron job: process notifications every minute
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('* * * * *', async () => {
    console.log('Processing pending notifications...');
    try {
      await processPendingNotifications();
    } catch (err) {
      console.error('Notification cron error:', err);
    }
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use((err, req, res, next) => {
  console.error("Express Error Handler:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      stack: err.stack,
      details: err
    }
  });
});

const PORT = process.env.PORT || 5050;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io };
// Trigger restart after clearing port 5050

