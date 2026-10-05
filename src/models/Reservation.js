const { randomUUID } = require('crypto');

const RESERVATION_STATUSES = new Set(['active', 'cancelled']);

class Reservation {
  constructor({
    id = randomUUID(),
    userId,
    roomId,
    startDate,
    endDate,
    status = 'active',
    createdAt = new Date(),
  }) {
    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new TypeError('userId is required');
    }

    if (typeof roomId !== 'string' || roomId.trim() === '') {
      throw new TypeError('roomId is required');
    }

    if (
      startDate === null ||
      startDate === undefined ||
      endDate === null ||
      endDate === undefined ||
      createdAt === null ||
      createdAt === undefined
    ) {
      throw new RangeError('Reservation dates must be valid');
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    const parsedCreatedAt = new Date(createdAt);

    if (
      Number.isNaN(parsedStartDate.getTime()) ||
      Number.isNaN(parsedEndDate.getTime()) ||
      Number.isNaN(parsedCreatedAt.getTime())
    ) {
      throw new RangeError('Reservation dates must be valid');
    }

    if (parsedStartDate >= parsedEndDate) {
      throw new RangeError('endDate must be after startDate');
    }

    if (!RESERVATION_STATUSES.has(status)) {
      throw new TypeError('status must be active or cancelled');
    }

    this.id = id;
    this.userId = userId;
    this.roomId = roomId;
    this.status = status;
    this.startDate = parsedStartDate.toISOString();
    this.endDate = parsedEndDate.toISOString();
    this.createdAt = parsedCreatedAt.toISOString();
  }
}

module.exports = Reservation;
