const test = require('node:test');
const assert = require('node:assert/strict');

const Reservation = require('../src/models/Reservation');

test('creates a reservation with linked IDs and normalized dates', () => {
  const reservation = new Reservation({
    userId: 'user-1',
    roomId: 'room-101',
    startDate: '2026-10-10T09:00:00-05:00',
    endDate: '2026-10-10T11:00:00-05:00',
  });

  assert.ok(reservation.id);
  assert.equal(reservation.userId, 'user-1');
  assert.equal(reservation.roomId, 'room-101');
  assert.equal(reservation.status, 'active');
  assert.equal(reservation.startDate, '2026-10-10T14:00:00.000Z');
  assert.equal(reservation.endDate, '2026-10-10T16:00:00.000Z');
  assert.ok(Number.isFinite(Date.parse(reservation.createdAt)));
});

test('allows an explicitly cancelled reservation', () => {
  const reservation = new Reservation({
    userId: 'user-1',
    roomId: 'room-101',
    startDate: '2026-10-10T09:00:00Z',
    endDate: '2026-10-10T11:00:00Z',
    status: 'cancelled',
  });

  assert.equal(reservation.status, 'cancelled');
});

test('rejects missing user or room links', () => {
  const fields = {
    startDate: '2026-10-10T09:00:00Z',
    endDate: '2026-10-10T11:00:00Z',
  };

  assert.throws(() => new Reservation({ ...fields, roomId: 'room-101' }), /userId is required/);
  assert.throws(() => new Reservation({ ...fields, userId: 'user-1' }), /roomId is required/);
});

test('rejects invalid or non-increasing reservation dates', () => {
  const fields = { userId: 'user-1', roomId: 'room-101' };

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
        userId: 'user-1',
        roomId: 'room-101',
        startDate: '2026-10-10T09:00:00Z',
        endDate: '2026-10-10T11:00:00Z',
        status: 'pending',
      }),
    /status must be active or cancelled/
  );
});
