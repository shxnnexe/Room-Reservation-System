const express = require('express');
const { listRooms } = require('../models/Room');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rooms = await listRooms(req.app.locals.db);
    return res.json({ rooms, count: rooms.length });
  } catch (error) {
    return res.status(500).json({ error: 'Could not load rooms.' });
  }
});

module.exports = router;
