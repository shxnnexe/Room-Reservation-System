const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const { createApp } = require('../src/app');
const { createRoom } = require('../src/models/Room');

async function withApp(runTests) {
  const dbPath = path.join(
    os.tmpdir(),
    `room-reservation-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  const app = createApp({ dbPath });

  try {
    await app.locals.db.ready;
    await createRoom(app.locals.db, {
      room_name: 'Meeting Room',
      room_number: 'R101',
      capacity: 8,
      description: 'Team meetings',
    });
    await createRoom(app.locals.db, {
      room_name: 'Training Room',
      room_number: 'R202',
      capacity: 12,
      description: 'Training sessions',
    });
    await runTests(app);
  } finally {
    await new Promise((resolve, reject) => {
      app.locals.db.close((error) => (error ? reject(error) : resolve()));
    });
    for (const suffix of ['', '-shm', '-wal']) {
      const filePath = `${dbPath}${suffix}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}

async function registerAndLogin(app, email) {
  const registration = await request(app)
    .post('/api/users/register')
    .send({ name: 'Reservation Tester', email, password: 'secret123' });
  assert.equal(registration.status, 201);
  return registration.body;
}

function createReservation(app, token, payload) {
  return request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
}

async function createLegacyReservationsTable(dbPath) {
  await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      `CREATE TABLE reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_name TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      (schemaError) => {
        if (schemaError) {
          db.close(() => reject(schemaError));
          return;
        }

        db.run(
          `INSERT INTO reservations (room_name, user_id, start_time, end_time)
           VALUES (?, ?, ?, ?)`,
          ['Meeting Room', 999, '2026-10-10T09:00:00.000Z', '2026-10-10T10:00:00.000Z'],
          (insertError) => {
            db.close((closeError) => {
              if (insertError || closeError) {
                reject(insertError || closeError);
                return;
              }
              resolve();
            });
          }
        );
      }
    );
  });
}

test('GET /api/rooms returns the room inventory', async () => {
  await withApp(async (app) => {
    const response = await request(app).get('/api/rooms');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));
    assert.equal(response.body.length, 2);
  });
});

test('database migration preserves existing reservations for conflict checks', async () => {
  const dbPath = path.join(
    os.tmpdir(),
    `room-reservation-legacy-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
  );
  await createLegacyReservationsTable(dbPath);
  const app = createApp({ dbPath });

  try {
    await app.locals.db.ready;
    await createRoom(app.locals.db, {
      room_name: 'Meeting Room',
      room_number: 'R101',
      capacity: 8,
      description: 'Team meetings',
    });
    const { token } = await registerAndLogin(app, 'legacy@example.com');
    const conflict = await createReservation(app, token, {
      roomId: '1',
      startDate: '2026-10-10T09:30:00Z',
      endDate: '2026-10-10T10:30:00Z',
    });
    assert.equal(conflict.status, 409);
  } finally {
    await new Promise((resolve, reject) => {
      app.locals.db.close((error) => (error ? reject(error) : resolve()));
    });
    for (const suffix of ['', '-shm', '-wal']) {
      const filePath = `${dbPath}${suffix}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
});

test('POST /api/reservations validates dates and room IDs', async () => {
  await withApp(async (app) => {
    const { token } = await registerAndLogin(app, 'validation@example.com');

    const invalidDates = await createReservation(app, token, {
      roomId: '1',
      startDate: '2026-10-20',
      endDate: '2026-10-19',
    });
    assert.equal(invalidDates.status, 400);
    assert.match(invalidDates.body.error.message, /after startDate/i);

    const unknownRoom = await createReservation(app, token, {
      roomId: 'unknown-room',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
    });
    assert.equal(unknownRoom.status, 404);
    assert.match(unknownRoom.body.error.message, /room not found/i);
  });
});

test('POST /api/reservations creates a persistent reservation linked to its user and room', async () => {
  await withApp(async (app) => {
    const { token, user } = await registerAndLogin(app, 'creator@example.com');
    const response = await createReservation(app, token, {
      roomId: '1',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data.id);
    assert.equal(response.body.data.userId, user.id);
    assert.equal(response.body.data.roomId, '1');
    assert.equal(response.body.data.roomName, 'Meeting Room');
    assert.equal(response.body.data.status, 'active');
    assert.equal(response.body.data.startDate, '2026-10-20T00:00:00.000Z');
    assert.equal(response.body.data.endDate, '2026-10-21T00:00:00.000Z');
    assert.ok(Number.isFinite(Date.parse(response.body.data.createdAt)));
  });
});

test('GET /api/reservations returns only the authenticated user reservations', async () => {
  await withApp(async (app) => {
    const alice = await registerAndLogin(app, 'alice-reservations@example.com');
    const bob = await registerAndLogin(app, 'bob-reservations@example.com');

    const aliceReservation = await createReservation(app, alice.token, {
      roomId: '1',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
    });
    const bobReservation = await createReservation(app, bob.token, {
      roomId: '2',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
    });
    assert.equal(aliceReservation.status, 201);
    assert.equal(bobReservation.status, 201);

    const response = await request(app)
      .get('/api/reservations')
      .set('Authorization', `Bearer ${alice.token}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.deepEqual(response.body.data.map(({ id }) => id), [aliceReservation.body.data.id]);
  });
});

test('DELETE /api/reservations/:id enforces ownership and makes the time available again', async () => {
  await withApp(async (app) => {
    const owner = await registerAndLogin(app, 'owner@example.com');
    const otherUser = await registerAndLogin(app, 'other-owner@example.com');
    const created = await createReservation(app, owner.token, {
      roomId: '1',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
    });
    assert.equal(created.status, 201);

    const denied = await request(app)
      .delete(`/api/reservations/${created.body.data.id}`)
      .set('Authorization', `Bearer ${otherUser.token}`);
    assert.equal(denied.status, 404);

    const cancelled = await request(app)
      .delete(`/api/reservations/${created.body.data.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.data.status, 'cancelled');

    const rebooked = await createReservation(app, owner.token, {
      roomId: '1',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
    });
    assert.equal(rebooked.status, 201);

    const repeatedCancellation = await request(app)
      .delete(`/api/reservations/${created.body.data.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    assert.equal(repeatedCancellation.status, 404);
  });
});

test('POST /api/reservations prevents overlaps but allows adjacent reservations', async () => {
  await withApp(async (app) => {
    const { token } = await registerAndLogin(app, 'availability@example.com');

    const first = await createReservation(app, token, {
      roomId: '1',
      startDate: '2026-10-10T09:00:00Z',
      endDate: '2026-10-10T10:00:00Z',
    });
    const adjacent = await createReservation(app, token, {
      roomId: '1',
      startDate: '2026-10-10T10:00:00Z',
      endDate: '2026-10-10T11:00:00Z',
    });
    assert.equal(first.status, 201);
    assert.equal(adjacent.status, 201);

    const overlap = await createReservation(app, token, {
      roomId: '1',
      startDate: '2026-10-10T09:30:00Z',
      endDate: '2026-10-10T10:30:00Z',
    });
    assert.equal(overlap.status, 409);

    const otherRoom = await createReservation(app, token, {
      roomId: '2',
      startDate: '2026-10-10T09:30:00Z',
      endDate: '2026-10-10T10:30:00Z',
    });
    assert.equal(otherRoom.status, 201);
  });
});

test('simultaneous reservations cannot claim the same room and time', async () => {
  await withApp(async (app) => {
    const { token } = await registerAndLogin(app, 'concurrent@example.com');
    const payload = {
      roomId: '1',
      startDate: '2026-10-10T09:00:00Z',
      endDate: '2026-10-10T10:00:00Z',
    };

    const responses = await Promise.all([
      createReservation(app, token, payload),
      createReservation(app, token, payload),
    ]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  });
});

test('reservation routes require authentication', async () => {
  await withApp(async (app) => {
    const list = await request(app).get('/api/reservations');
    const create = await request(app)
      .post('/api/reservations')
      .send({ roomId: '1', startDate: '2026-10-10', endDate: '2026-10-11' });

    assert.equal(list.status, 401);
    assert.equal(create.status, 401);
  });
});
