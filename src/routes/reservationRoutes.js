const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Reservation = require('../models/Reservation');
const { findRoomById } = require('../models/Room');

const router = express.Router();
router.use(authMiddleware());

router.get('/', async (req, res) => {
  const reservations = await Reservation.listForUser(req.app.locals.db, req.user.id);
  const legacyReservations = reservations.map((reservation) => ({
    id: reservation.id,
    room_name: reservation.roomName,
    user_id: reservation.userId,
    start_time: reservation.startDate,
    end_time: reservation.endDate,
    status: reservation.status,
    created_at: reservation.createdAt,
  }));
  return res.json({ success: true, data: reservations, reservations: legacyReservations });
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  const legacyPayload = !body.roomId && Boolean(body.room_name);
  const roomId = legacyPayload ? String(body.room_name).trim() : body.roomId;
  const startDate = legacyPayload ? body.start_time : body.startDate;
  const endDate = legacyPayload ? body.end_time : body.endDate;

  if (typeof roomId !== 'string' || !roomId.trim() || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: { message: 'roomId, startDate, and endDate are required.' },
    });
  }

  const room = legacyPayload ? null : await findRoomById(req.app.locals.db, roomId.trim());
  if (!legacyPayload && !room) {
    return res.status(404).json({
      success: false,
      error: { message: 'Room not found.' },
    });
  }

  let reservation;
  try {
    reservation = await Reservation.createIfAvailable(req.app.locals.db, {
      userId: req.user.id,
      roomId: room ? String(room.id) : roomId.trim(),
      roomName: room ? room.room_name : roomId.trim(),
      startDate,
      endDate,
    });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return res.status(400).json({ success: false, error: { message: error.message } });
    }
    throw error;
  }

  if (!reservation) {
    return res.status(409).json({
      success: false,
      error: { message: 'Room is not available for the selected dates.' },
    });
  }

  return res.status(201).json({
    success: true,
    data: reservation,
    reservation: {
      id: reservation.id,
      room_name: reservation.roomName,
      user_id: reservation.userId,
      start_time: reservation.startDate,
      end_time: reservation.endDate,
      status: reservation.status,
      created_at: reservation.createdAt,
    },
  });
});

router.delete('/:id', async (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isSafeInteger(reservationId) || reservationId <= 0) {
    return res.status(404).json({
      success: false,
      error: { message: 'Reservation not found.' },
    });
  }

  const reservation = await Reservation.cancelForUser(
    req.app.locals.db,
    reservationId,
    req.user.id
  );
  if (!reservation) {
    return res.status(404).json({
      success: false,
      error: { message: 'Reservation not found.' },
    });
  }

  return res.json({ success: true, data: reservation });
});

module.exports = router;
