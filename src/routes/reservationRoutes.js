const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware());

function listReservations(db, userId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, room_name, user_id, start_time, end_time, created_at FROM reservations WHERE user_id = ? ORDER BY start_time ASC',
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows || []);
      }
    );
  });
}

router.get('/', async (req, res) => {
  try {
    const reservations = await listReservations(req.app.locals.db, req.user.id);
    return res.json({ reservations });
  } catch (error) {
    return res.status(500).json({ error: 'Could not load reservations.' });
  }
});

router.post('/', async (req, res) => {
  const { room_name, start_time, end_time } = req.body || {};

  if (!room_name || !start_time || !end_time) {
    return res.status(400).json({ error: 'room_name, start_time, and end_time are required.' });
  }

  const start = new Date(start_time);
  const end = new Date(end_time);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return res.status(400).json({ error: 'Reservation end_time must be later than start_time.' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      req.app.locals.db.run(
        'INSERT INTO reservations (room_name, user_id, start_time, end_time) VALUES (?, ?, ?, ?)',
        [String(room_name).trim(), req.user.id, new Date(start).toISOString(), new Date(end).toISOString()],
        function onInsert(err) {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            id: this.lastID,
            room_name: String(room_name).trim(),
            user_id: req.user.id,
            start_time: new Date(start).toISOString(),
            end_time: new Date(end).toISOString(),
          });
        }
      );
    });

    return res.status(201).json({ message: 'Reservation created successfully.', reservation: result });
  } catch (error) {
    return res.status(500).json({ error: 'Reservation could not be created.' });
  }
});

module.exports = router;
