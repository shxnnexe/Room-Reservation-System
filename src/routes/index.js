const express = require('express');
const { getRooms, getRoomById } = require('../controllers/roomController');
const { createReservation, listReservations } = require('../controllers/reservationController');
const { authMiddleware } = require('../middleware/auth');
const { errorHandler } = require('../middleware/errorHandler');
const { successResponse } = require('../utils/response');

const router = express.Router();

router.get('/health', (req, res) => successResponse(res, 200, { status: 'ok' }));
router.get('/rooms', getRooms);
router.get('/rooms/:id', getRoomById);
router.get('/reservations', authMiddleware, listReservations);
router.post('/reservations', authMiddleware, createReservation);

router.use(errorHandler);

module.exports = router;
