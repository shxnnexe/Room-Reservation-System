const express = require('express');
const { listRooms } = require('../models/Room');

const router = express.Router();

router.get('/', async (req, res) => {
  const query = req.query.q === undefined ? '' : req.query.q;
  if (typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query must be a single string.' });
  }

  try {
    const rooms = await listRooms(req.app.locals.db, query.trim());
    return res.json({ rooms, count: rooms.length });
  } catch (error) {
    return res.status(500).json({ error: 'Could not load rooms.' });
  }
});

module.exports = router;
