const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, resetState } = require('../src/app');

function buildAuthToken(agent) {
  return agent
    .post('/api/users/register')
    .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' })
    .then((response) => response.body.data);
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

test('GET /api/rooms supports search and capacity filters', async () => {
  const searchResponse = await request(app).get('/api/rooms?search=Harbor');
  const capacityResponse = await request(app).get('/api/rooms?capacity=6');

  assert.equal(searchResponse.status, 200);
  assert.ok(searchResponse.body.data.some((room) => room.name === 'Harbor Room'));
  assert.equal(capacityResponse.status, 200);
  assert.ok(capacityResponse.body.data.some((room) => room.capacity >= 6));
});

test('POST /api/rooms validates room payloads and stores valid rooms', async () => {
  const register = await request(app)
    .post('/api/users/register')
    .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });

  const token = (await request(app)
    .post('/api/users/login')
    .send({ email: 'alice@example.com', password: 'secret123' })).body.data.token;

  const validResponse = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Sunset Room', location: 'Floor 4', capacity: 10 });

  const invalidResponse = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '', location: 'Floor 5', capacity: 0 });

  assert.equal(validResponse.status, 201);
  assert.equal(validResponse.body.success, true);
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.success, false);
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

test('Reservations can be retrieved and cancelled', async () => {
  const token = (await request(app)
    .post('/api/users/register')
    .send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' }))
    && (await request(app)
    .post('/api/users/login')
    .send({ email: 'alice@example.com', password: 'secret123' })).body.data.token;

  const create = await request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ roomId: 'room-101', startDate: '2026-11-10', endDate: '2026-11-12' });

  const list = await request(app)
    .get('/api/reservations')
    .set('Authorization', `Bearer ${token}`);

  const cancel = await request(app)
    .delete(`/api/reservations/${create.body.data.id}`)
    .set('Authorization', `Bearer ${token}`);

  assert.equal(create.status, 201);
  assert.equal(list.status, 200);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.status, 'cancelled');
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
