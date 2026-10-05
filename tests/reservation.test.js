const test = require('node:test');
const assert = require('node:assert/strict');

const Reservation = require('../src/models/Reservation');

test('creates a reservation model with normalized dates and linked records', () => {
  const reservation = new Reservation({
    userId: 17,
    roomId: 'R101',
    roomName: 'Single Room',
    startDate: '2026-10-10T09:00:00-05:00',
    endDate: '2026-10-10T11:00:00-05:00',
  });

  assert.equal(reservation.id, null);
  assert.equal(reservation.userId, 17);
  assert.equal(reservation.roomId, 'R101');
  assert.equal(reservation.roomName, 'Single Room');
  assert.equal(reservation.status, 'active');
  assert.equal(reservation.startDate, '2026-10-10T14:00:00.000Z');
  assert.equal(reservation.endDate, '2026-10-10T16:00:00.000Z');
  assert.ok(Number.isFinite(Date.parse(reservation.createdAt)));
});

test('allows an explicitly cancelled reservation', () => {
  const reservation = new Reservation({
    userId: 1,
    roomId: 'R101',
    startDate: '2026-10-10T09:00:00Z',
    endDate: '2026-10-10T11:00:00Z',
    status: 'cancelled',
  });

  assert.equal(reservation.status, 'cancelled');
});

test('rejects missing or invalid user and room links', () => {
  const dates = {
    startDate: '2026-10-10T09:00:00Z',
    endDate: '2026-10-10T11:00:00Z',
  };

  assert.throws(() => new Reservation({ ...dates, roomId: 'R101' }), /positive integer/);
  assert.throws(() => new Reservation({ ...dates, userId: 1 }), /roomId is required/);
  assert.throws(() => new Reservation({ ...dates, userId: 0, roomId: 'R101' }), /positive integer/);
});

test('rejects invalid or non-increasing reservation dates', () => {
  const fields = { userId: 1, roomId: 'R101' };

  assert.throws(
    () => new Reservation({ ...fields, startDate: 'not-a-date', endDate: '2026-10-10T11:00:00Z' }),
    /dates must be valid/
  );
  assert.throws(
    () => new Reservation({ ...fields, startDate: null, endDate: '2026-10-10T11:00:00Z' }),
    /dates must be valid/
  );
  assert.throws(
    () =>
      new Reservation({
        ...fields,
        startDate: '2026-10-10T11:00:00Z',
        endDate: '2026-10-10T11:00:00Z',
      }),
    /endDate must be after startDate/
  );
});

test('rejects unsupported reservation statuses', () => {
  assert.throws(
    () =>
      new Reservation({
        userId: 1,
        roomId: 'R101',
        startDate: '2026-10-10T09:00:00Z',
        endDate: '2026-10-10T11:00:00Z',
        status: 'pending',
      }),
    /status must be active or cancelled/
  );
});
