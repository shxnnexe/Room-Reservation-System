const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, resetState } = require('../src/app');

async function registerAndLogin(email) {
  const registration = await request(app)
    .post('/api/users/register')
    .send({ name: 'Reservation Tester', email, password: 'secret123' });

  assert.equal(registration.status, 201);

  const login = await request(app)
    .post('/api/users/login')
    .send({ email, password: 'secret123' });

  assert.equal(login.status, 200);
  return login.body.data;
}

test.beforeEach(() => {
  resetState();
});

test('GET /api/rooms returns room inventory', async () => {
  const response = await request(app).get('/api/rooms');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
  assert.ok(response.body.data.length > 0);
});

test('POST /api/reservations rejects invalid date ranges', async () => {
  const loginResponse = await request(app)
    .post('/api/users/register')
    .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

  const token = (await request(app)
    .post('/api/users/login')
    .send({ email: 'alice@example.com', password: 'secret123' })).body.data.token;

  const response = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ roomId: 'room-101', startDate: '2026-10-20', endDate: '2026-10-19' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.error.message, /after startDate/i);
});

test('POST /api/reservations prevents overlapping bookings', async () => {
  const loginResponse = await request(app)
    .post('/api/users/register')
    .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

  const token = (await request(app)
    .post('/api/users/login')
    .send({ email: 'alice@example.com', password: 'secret123' })).body.data.token;

  await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ roomId: 'room-101', startDate: '2026-10-10', endDate: '2026-10-12' });

  const conflictResponse = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ roomId: 'room-101', startDate: '2026-10-11', endDate: '2026-10-13' });

  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictResponse.body.success, false);
  assert.match(conflictResponse.body.error.message, /not available/i);
});

test('POST /api/reservations allows adjacent dates and reuses cancelled time slots', async () => {
  const { token } = await registerAndLogin('availability@example.com');
  const auth = { Authorization: `Bearer ${token}` };
  const first = await request(app)
    .post('/api/reservations')
    .set(auth)
    .send({ roomId: 'room-101', startDate: '2026-10-10T09:00:00Z', endDate: '2026-10-10T10:00:00Z' });
  const adjacent = await request(app)
    .post('/api/reservations')
    .set(auth)
    .send({ roomId: 'room-101', startDate: '2026-10-10T10:00:00Z', endDate: '2026-10-10T11:00:00Z' });

  assert.equal(first.status, 201);
  assert.equal(adjacent.status, 201);

  const overlap = await request(app)
    .post('/api/reservations')
    .set(auth)
    .send({ roomId: 'room-101', startDate: '2026-10-10T09:30:00Z', endDate: '2026-10-10T10:30:00Z' });
  assert.equal(overlap.status, 409);

  const otherRoom = await request(app)
    .post('/api/reservations')
    .set(auth)
    .send({ roomId: 'room-102', startDate: '2026-10-10T09:30:00Z', endDate: '2026-10-10T10:30:00Z' });
  assert.equal(otherRoom.status, 201);

  const cancellation = await request(app)
    .delete(`/api/reservations/${first.body.data.id}`)
    .set(auth);
  assert.equal(cancellation.status, 200);

  const rebooked = await request(app)
    .post('/api/reservations')
    .set(auth)
    .send({ roomId: 'room-101', startDate: '2026-10-10T09:00:00Z', endDate: '2026-10-10T10:00:00Z' });
  assert.equal(rebooked.status, 201);
});

test('POST /api/reservations creates a reservation linked to its user and room', async () => {
  const { token, user } = await registerAndLogin('creator@example.com');
  const response = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ roomId: 'room-101', startDate: '2026-10-20T09:00:00Z', endDate: '2026-10-20T10:00:00Z' });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.id);
  assert.equal(response.body.data.userId, user.id);
  assert.equal(response.body.data.roomId, 'room-101');
  assert.equal(response.body.data.status, 'active');
  assert.equal(response.body.data.startDate, '2026-10-20T09:00:00.000Z');
  assert.equal(response.body.data.endDate, '2026-10-20T10:00:00.000Z');
  assert.ok(Number.isFinite(Date.parse(response.body.data.createdAt)));
});

test('GET /api/reservations returns only the authenticated user reservations', async () => {
  const alice = await registerAndLogin('alice-reservations@example.com');
  const bob = await registerAndLogin('bob-reservations@example.com');

  const aliceReservation = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${alice.token}`)
    .send({ roomId: 'room-101', startDate: '2026-10-20T09:00:00Z', endDate: '2026-10-20T10:00:00Z' });
  const bobReservation = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${bob.token}`)
    .send({ roomId: 'room-102', startDate: '2026-10-20T09:00:00Z', endDate: '2026-10-20T10:00:00Z' });

  assert.equal(aliceReservation.status, 201);
  assert.equal(bobReservation.status, 201);

  const response = await request(app)
    .get('/api/reservations')
    .set('Authorization', `Bearer ${alice.token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.map(({ id }) => id), [aliceReservation.body.data.id]);
});

test('DELETE /api/reservations/:id cancels only its owner reservation', async () => {
  const owner = await registerAndLogin('owner@example.com');
  const otherUser = await registerAndLogin('other-owner@example.com');
  const created = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ roomId: 'room-101', startDate: '2026-10-20T09:00:00Z', endDate: '2026-10-20T10:00:00Z' });

  assert.equal(created.status, 201);

  const denied = await request(app)
    .delete(`/api/reservations/${created.body.data.id}`)
    .set('Authorization', `Bearer ${otherUser.token}`);
  assert.equal(denied.status, 404);

  const cancelled = await request(app)
    .delete(`/api/reservations/${created.body.data.id}`)
    .set('Authorization', `Bearer ${owner.token}`);
  assert.equal(cancelled.status, 200);
  assert.deepEqual(cancelled.body.data, { id: created.body.data.id, status: 'cancelled' });

  const reservations = await request(app)
    .get('/api/reservations')
    .set('Authorization', `Bearer ${owner.token}`);
  assert.equal(reservations.body.data[0].status, 'cancelled');

  const repeatedCancellation = await request(app)
    .delete(`/api/reservations/${created.body.data.id}`)
    .set('Authorization', `Bearer ${owner.token}`);
  assert.equal(repeatedCancellation.status, 404);
});

test('Protected reservation routes require authentication', async () => {
  const response = await request(app).get('/api/reservations');

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.match(response.body.error.message, /token/i);
});

test('Users can log in and receive a token', async () => {
  await request(app)
    .post('/api/users/register')
    .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

  const response = await request(app)
    .post('/api/users/login')
    .send({ email: 'alice@example.com', password: 'secret123' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.token);
});
