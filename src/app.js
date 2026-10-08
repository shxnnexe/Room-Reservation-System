const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { initializeDatabase } = require('./db');
const userRoutes = require('./routes/userRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const roomRoutes = require('./routes/roomRoutes');

const SECRET = process.env.JWT_SECRET || 'room-reservation-secret';

const rooms = [
  { id: 'room-101', name: 'Maple Room', capacity: 4, location: 'Floor 1' },
  { id: 'room-102', name: 'Harbor Room', capacity: 6, location: 'Floor 2' },
  { id: 'room-103', name: 'Summit Room', capacity: 8, location: 'Floor 3' },
];

const users = [];
const reservations = [];

function successResponse(data, message = 'Request successful') {
  return { success: true, message, data };
}

function errorResponse(message, status = 400, details = null) {
  return {
    success: false,
    error: {
      message,
      status,
      details,
    },
  };
}

function getDateValue(value, fieldName) {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is not a valid date`);
  }

  return date;
}

function validateReservationPayload(payload) {
  if (!payload || !payload.roomId || !payload.startDate || !payload.endDate) {
    throw new Error('roomId, startDate, and endDate are required');
  }

  const startDate = getDateValue(payload.startDate, 'startDate');
  const endDate = getDateValue(payload.endDate, 'endDate');

  if (startDate >= endDate) {
    throw new Error('endDate must be after startDate');
  }

  if (payload.capacity && Number(payload.capacity) < 1) {
    throw new Error('capacity must be greater than zero when provided');
  }

  return {
    roomId: payload.roomId,
    startDate,
    endDate,
    capacity: payload.capacity ? Number(payload.capacity) : null,
  };
}

function validateRoomPayload(payload) {
  if (!payload || !payload.name || !payload.location || !payload.capacity) {
    throw new Error('name, location, and capacity are required');
  }

  const capacity = Number(payload.capacity);
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error('capacity must be a positive integer');
  }

  return {
    name: String(payload.name).trim(),
    location: String(payload.location).trim(),
    capacity,
  };
}

function hasOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isRoomAvailable(roomId, startDate, endDate, ignoreReservationId = null) {
  return !reservations.some((reservation) => {
    if (reservation.status === 'cancelled') {
      return false;
    }

    if (ignoreReservationId && reservation.id === ignoreReservationId) {
      return false;
    }

    if (reservation.roomId !== roomId) {
      return false;
    }

    const reservationStart = new Date(reservation.startDate);
    const reservationEnd = new Date(reservation.endDate);

    return hasOverlap(startDate, endDate, reservationStart, reservationEnd);
  });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json(errorResponse('Authentication token is required', 401));
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json(errorResponse('Invalid or expired token', 401));
  }
}

function resetState() {
  users.length = 0;
  reservations.length = 0;
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json(successResponse({ ok: true }, 'API is healthy'));
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json(errorResponse('name, email, and password are required', 400));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (users.some((user) => user.email === normalizedEmail)) {
      return res.status(409).json(errorResponse('User already exists', 409));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: randomUUID(),
      name: String(name).trim(),
      email: normalizedEmail,
      password: passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    return res.status(201).json(
      successResponse({ id: user.id, name: user.name, email: user.email }, 'User registered successfully')
    );
  } catch (error) {
    return res.status(500).json(errorResponse('Unable to register user', 500, error.message));
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json(errorResponse('email and password are required', 400));
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.find((entry) => entry.email === normalizedEmail);

    if (!user) {
      return res.status(401).json(errorResponse('Invalid email or password', 401));
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json(errorResponse('Invalid email or password', 401));
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '1h' });

    return res.json(
      successResponse(
        {
          token,
          user: { id: user.id, name: user.name, email: user.email },
        },
        'Login successful'
      )
    );
  } catch (error) {
    return res.status(500).json(errorResponse('Unable to login', 500, error.message));
  }
});

app.get('/api/rooms', (req, res) => {
  const { search = '', capacity } = req.query;
  const normalizedSearch = String(search).trim().toLowerCase();
  const minCapacity = capacity !== undefined ? Number(capacity) : null;

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = !normalizedSearch || room.name.toLowerCase().includes(normalizedSearch) || room.location.toLowerCase().includes(normalizedSearch);
    const matchesCapacity = minCapacity === null || room.capacity >= minCapacity;
    return matchesSearch && matchesCapacity;
  });

  return res.json(successResponse(filteredRooms, 'Available rooms retrieved'));
});

app.post('/api/rooms', requireAuth, (req, res) => {
  try {
    const validatedRoom = validateRoomPayload(req.body);
    const existingRoom = rooms.find((room) => room.name.toLowerCase() === validatedRoom.name.toLowerCase());

    if (existingRoom) {
      return res.status(409).json(errorResponse('Room already exists', 409));
    }

    const room = {
      id: `room-${rooms.length + 101}`,
      ...validatedRoom,
    };

    rooms.push(room);
    return res.status(201).json(successResponse(room, 'Room created successfully'));
  } catch (error) {
    return res.status(400).json(errorResponse(error.message, 400));
  }
});

app.get('/api/reservations', requireAuth, (req, res) => {
  const userReservations = reservations.filter((reservation) => reservation.userId === req.user.sub);
  return res.json(successResponse(userReservations, 'Reservations retrieved'));
});

app.post('/api/reservations', requireAuth, (req, res) => {
  try {
    const payload = validateReservationPayload(req.body);
    const roomExists = rooms.some((room) => room.id === payload.roomId);

    if (!roomExists) {
      return res.status(404).json(errorResponse('Room not found', 404));
    }

    const selectedRoom = rooms.find((room) => room.id === payload.roomId);
    if (selectedRoom && payload.capacity !== null && payload.capacity > selectedRoom.capacity) {
      return res.status(400).json(errorResponse(`Room capacity is ${selectedRoom.capacity}; requested capacity exceeds available space`, 400));
    }

    if (!isRoomAvailable(payload.roomId, payload.startDate, payload.endDate)) {
      return res.status(409).json(errorResponse('Room is not available for the selected dates', 409));
    }

    const reservation = {
      id: randomUUID(),
      userId: req.user.sub,
      roomId: payload.roomId,
      status: 'active',
      startDate: payload.startDate.toISOString(),
      endDate: payload.endDate.toISOString(),
      createdAt: new Date().toISOString(),
    };

    reservations.push(reservation);

    return res.status(201).json(successResponse(reservation, 'Reservation created successfully'));
  } catch (error) {
    return res.status(400).json(errorResponse(error.message, 400));
  }
});

app.delete('/api/reservations/:id', requireAuth, (req, res) => {
  const reservation = reservations.find(
    (entry) => entry.id === req.params.id && entry.userId === req.user.sub && entry.status !== 'cancelled'
  );

  if (!reservation) {
    return res.status(404).json(errorResponse('Reservation not found', 404));
  }

  reservation.status = 'cancelled';
  return res.json(successResponse({ id: reservation.id, status: 'cancelled' }, 'Reservation cancelled successfully'));
});

app.use((req, res) => {
  return res.status(404).json(errorResponse('Route not found', 404));
});

app.use((error, req, res, next) => {
  return res.status(500).json(errorResponse('Internal server error', 500, error.message));
});

function createApp({ dbPath, jwtSecret } = {}) {
  const databaseApp = express();
  const database = initializeDatabase(dbPath);

  databaseApp.locals.db = database;
  databaseApp.locals.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'room-reservation-secret';

  databaseApp.use(express.json());

  databaseApp.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  databaseApp.use('/api/users', userRoutes);
  databaseApp.use('/api/reservations', reservationRoutes);
  databaseApp.use('/api/rooms', roomRoutes);

  databaseApp.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return databaseApp;
}

module.exports = { app, createApp, resetState, users, rooms, reservations };
