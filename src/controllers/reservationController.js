const { successResponse, errorResponse } = require('../utils/response');

const reservations = [
  { id: 'RES-001', roomId: 'R101', checkIn: '2026-10-15', checkOut: '2026-10-17' },
  { id: 'RES-002', roomId: 'R202', checkIn: '2026-10-18', checkOut: '2026-10-20' },
];

function validateDateRange(checkIn, checkOut) {
  if (!checkIn || !checkOut) {
    return 'checkIn and checkOut are required';
  }

  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid reservation dates';
  }

  if (start >= end) {
    return 'checkOut must be after checkIn';
  }

  return null;
}

function isRoomAvailable(roomId, checkIn, checkOut) {
  return !reservations.some((reservation) => {
    if (reservation.roomId !== roomId) {
      return false;
    }

    const reservationStart = new Date(`${reservation.checkIn}T00:00:00Z`);
    const reservationEnd = new Date(`${reservation.checkOut}T00:00:00Z`);
    const requestedStart = new Date(`${checkIn}T00:00:00Z`);
    const requestedEnd = new Date(`${checkOut}T00:00:00Z`);

    return requestedStart < reservationEnd && requestedEnd > reservationStart;
  });
}

function createReservation(req, res) {
  const { roomId, checkIn, checkOut } = req.body || {};
  const dateError = validateDateRange(checkIn, checkOut);

  if (dateError) {
    return errorResponse(res, 400, dateError, { roomId, checkIn, checkOut });
  }

  if (!roomId) {
    return errorResponse(res, 400, 'roomId is required', { roomId, checkIn, checkOut });
  }

  if (!isRoomAvailable(roomId, checkIn, checkOut)) {
    return errorResponse(res, 409, 'Room is not available for the selected dates', { roomId, checkIn, checkOut });
  }

  const newReservation = {
    id: `RES-${String(reservations.length + 1).padStart(3, '0')}`,
    roomId,
    checkIn,
    checkOut,
  };

  reservations.push(newReservation);
  return successResponse(res, 201, newReservation, { created: true });
}

function listReservations(req, res) {
  return successResponse(res, 200, reservations, { count: reservations.length });
}

module.exports = {
  createReservation,
  listReservations,
  validateDateRange,
  isRoomAvailable,
};
