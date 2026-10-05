const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createRoom, listRooms, RoomValidationError } = require('../models/Room');

const router = express.Router();

router.get('/', async (req, res) => {
  const query = req.query.q === undefined ? '' : req.query.q;
  if (typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query must be a single string.' });
  }

  try {
    const rooms = await listRooms(req.app.locals.db, query.trim());
    const responseRooms = rooms.map((room) => ({
      ...room,
      name: room.room_name,
      location: room.description,
    }));
    return res.json(responseRooms);
  } catch (error) {
    return res.status(500).json({ error: 'Could not load rooms.' });
  }
});

router.post('/', authMiddleware(), async (req, res) => {
  try {
    const room = await createRoom(req.app.locals.db, req.body);
    return res.status(201).json({ message: 'Room created successfully.', room });
  } catch (error) {
    if (error instanceof RoomValidationError) {
      return res.status(400).json({ error: error.message, field: error.field });
    }

    if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('rooms.room_number')) {
      return res.status(409).json({ error: 'A room with this room_number already exists.' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Could not create room.' });
  }
});

module.exports = router;
