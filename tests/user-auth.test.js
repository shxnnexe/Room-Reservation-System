const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');

function getDbPath() {
  return path.join(__dirname, '..', 'data', `test-room-reservation-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

function closeAndRemoveDb(app, dbPathValue) {
  return new Promise((resolve) => {
    if (app && app.locals && app.locals.db && typeof app.locals.db.close === 'function') {
      app.locals.db.close(() => {
        if (fs.existsSync(dbPathValue)) {
          fs.unlinkSync(dbPathValue);
        }
        resolve();
      });
      return;
    }

    if (fs.existsSync(dbPathValue)) {
      fs.unlinkSync(dbPathValue);
    }
    resolve();
  });
}

test('registers a new user and returns a token', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    const response = await request(app)
      .post('/api/users/register')
      .send({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'password123',
      })
      .expect(201);

    assert.ok(response.body.token);
    assert.equal(response.body.user.email, 'alice@example.com');
    assert.equal(response.body.user.name, 'Alice Johnson');
  } finally {
    await closeAndRemoveDb(app, dbPath);
  }
});

test('logs in an existing user with a valid password', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    await request(app)
      .post('/api/users/register')
      .send({
        name: 'Bob Smith',
        email: 'bob@example.com',
        password: 'password123',
      })
      .expect(201);

    const response = await request(app)
      .post('/api/users/login')
      .send({
        email: 'bob@example.com',
        password: 'password123',
      })
      .expect(200);

    assert.ok(response.body.token);
    assert.equal(response.body.user.email, 'bob@example.com');
  } finally {
    await closeAndRemoveDb(app, dbPath);
  }
});

test('rejects duplicate registration attempts for the same email', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    await request(app)
      .post('/api/users/register')
      .send({
        name: 'Dana Stone',
        email: 'dana@example.com',
        password: 'password123',
      })
      .expect(201);

    await request(app)
      .post('/api/users/register')
      .send({
        name: 'Dana Stone',
        email: 'dana@example.com',
        password: 'password123',
      })
      .expect(409);
  } finally {
    await closeAndRemoveDb(app, dbPath);
  }
});

test('rejects invalid login credentials', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    await request(app)
      .post('/api/users/register')
      .send({
        name: 'Evan Ross',
        email: 'evan@example.com',
        password: 'password123',
      })
      .expect(201);

    await request(app)
      .post('/api/users/login')
      .send({
        email: 'evan@example.com',
        password: 'wrong-password',
      })
      .expect(401);
  } finally {
    await closeAndRemoveDb(app, dbPath);
  }
});

test('rejects reservation access without authentication', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    await request(app)
      .get('/api/reservations')
      .expect(401);
  } finally {
    await closeAndRemoveDb(app, dbPath);
  }
});

test('allows authenticated users to create reservations', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    const registerResponse = await request(app)
      .post('/api/users/register')
      .send({
        name: 'Charlie',
        email: 'charlie@example.com',
        password: 'password123',
      })
      .expect(201);

    const token = registerResponse.body.token;

    const reservationResponse = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        room_name: 'Meeting Room 1',
        start_time: '2026-11-10T09:00:00.000Z',
        end_time: '2026-11-10T10:00:00.000Z',
      })
      .expect(201);

    assert.equal(reservationResponse.body.reservation.room_name, 'Meeting Room 1');
  } finally {
    await closeAndRemoveDb(app, dbPath);
  }
});
