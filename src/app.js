const express = require('express');
const { initializeDatabase } = require('./db');
const userRoutes = require('./routes/userRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const roomRoutes = require('./routes/roomRoutes');

function createApp({ dbPath, jwtSecret } = {}) {
  const app = express();
  const database = initializeDatabase(dbPath);

  app.locals.db = database;
  app.locals.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'room-reservation-secret';

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/users', userRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/rooms', roomRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = {
  createApp,
};
