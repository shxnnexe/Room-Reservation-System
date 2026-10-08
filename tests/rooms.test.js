const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/db');
const { createRoom, listRooms, validateCapacity } = require('../src/models/Room');

function getDbPath() {
  return path.join(__dirname, '..', 'data', `test-rooms-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

function closeAndRemoveDb(db, dbPath) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

test('Room model stores and retrieves room details from SQLite', async () => {
  const dbPath = getDbPath();
  const db = initializeDatabase(dbPath);

  try {
    const created = await createRoom(db, {
      room_name: 'Conference Room',
      room_number: 'C-101',
      capacity: 12,
      description: 'Main meeting space',
    });
    const rooms = await listRooms(db);

    assert.equal(created.room_name, 'Conference Room');
    assert.equal(created.room_number, 'C-101');
    assert.equal(created.capacity, 12);
    assert.equal(created.description, 'Main meeting space');
    assert.equal(created.availability_status, 'available');
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].id, created.id);
  } finally {
    await closeAndRemoveDb(db, dbPath);
  }
});

test('room capacity must be a positive integer', () => {
  for (const capacity of [0, -1, 2.5, '4', null]) {
    assert.throws(() => validateCapacity(capacity), {
      name: 'RoomValidationError',
      message: 'capacity must be a positive integer.',
    });
  }

  assert.doesNotThrow(() => validateCapacity(1));
});

test('GET /api/rooms returns an empty collection when no rooms exist', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    const response = await request(app).get('/api/rooms').expect(200);

    assert.deepEqual(response.body, []);
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});

test('GET /api/rooms returns persisted room details', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    await createRoom(app.locals.db, {
      room_name: 'Training Room',
      room_number: 'T-202',
      capacity: 20,
      description: 'Training and workshop space',
    });

    const response = await request(app).get('/api/rooms').expect(200);

    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].room_name, 'Training Room');
    assert.equal(response.body[0].room_number, 'T-202');
    assert.equal(response.body[0].name, 'Training Room');
    assert.equal(response.body[0].location, 'Training and workshop space');
    assert.equal(response.body[0].capacity, 20);
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});

test('GET /api/rooms searches room names and numbers case-insensitively', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    await createRoom(app.locals.db, {
      room_name: 'Board Meeting Room',
      room_number: 'B-101',
      capacity: 8,
      description: 'Executive meeting room',
    });
    await createRoom(app.locals.db, {
      room_name: 'Workshop Space',
      room_number: 'W-202',
      capacity: 24,
      description: 'Training room',
    });

    const byName = await request(app).get('/api/rooms').query({ q: 'meeting' }).expect(200);
    const byNumber = await request(app).get('/api/rooms').query({ q: 'w-202' }).expect(200);
    const noMatches = await request(app).get('/api/rooms').query({ q: 'nonexistent' }).expect(200);

    assert.equal(byName.body.length, 1);
    assert.equal(byName.body[0].room_number, 'B-101');
    assert.equal(byNumber.body.length, 1);
    assert.equal(byNumber.body[0].room_name, 'Workshop Space');
    assert.deepEqual(noMatches.body, []);
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});

test('GET /api/rooms rejects repeated search query values', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    const response = await request(app).get('/api/rooms').query({ q: ['board', 'workshop'] }).expect(400);

    assert.equal(response.body.error, 'Search query must be a single string.');
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});

test('POST /api/rooms requires authentication', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    await request(app)
      .post('/api/rooms')
      .send({
        room_name: 'Meeting Room',
        room_number: 'M-101',
        capacity: 10,
        description: 'Team meetings',
      })
      .expect(401);
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});

test('POST /api/rooms rejects missing and invalid room values without saving', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });
  const userResponse = await request(app)
    .post('/api/users/register')
    .send({
      name: 'Room Admin',
      email: 'room-admin@example.com',
      password: 'password123',
    })
    .expect(201);

  const invalidRooms = [
    [{}, 'room_name'],
    [{ room_name: '   ' }, 'room_name'],
    [{ room_name: 'Meeting', room_number: '  ' }, 'room_number'],
    [{ room_name: 'Meeting', room_number: 'M-101', capacity: 0 }, 'capacity'],
    [{ room_name: 'Meeting', room_number: 'M-101', capacity: 1.5 }, 'capacity'],
    [{ room_name: 'Meeting', room_number: 'M-101', capacity: '10' }, 'capacity'],
    [{ room_name: 'Meeting', room_number: 'M-101', capacity: 10, description: ' ' }, 'description'],
    [{
      room_name: 'Meeting',
      room_number: 'M-101',
      capacity: 10,
      description: 'Team meetings',
      availability_status: 'booked',
    }, 'availability_status'],
  ];

  try {
    for (const [room, field] of invalidRooms) {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${userResponse.body.token}`)
        .send(room)
        .expect(400);

      assert.equal(response.body.field, field);
      assert.match(response.body.error, new RegExp(field));
    }

    assert.deepEqual((await request(app).get('/api/rooms').expect(200)).body, []);
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});

test('POST /api/rooms saves valid room data and rejects duplicate room numbers', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });
  const userResponse = await request(app)
    .post('/api/users/register')
    .send({
      name: 'Room Manager',
      email: 'room-manager@example.com',
      password: 'password123',
    })
    .expect(201);
  const roomInput = {
    room_name: 'Meeting Room',
    room_number: 'M-101',
    capacity: 10,
    description: 'Team meetings',
  };

  try {
    const response = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${userResponse.body.token}`)
      .send(roomInput)
      .expect(201);

    assert.equal(response.body.room.room_name, roomInput.room_name);
    assert.equal(response.body.room.room_number, roomInput.room_number);
    assert.equal(response.body.room.capacity, roomInput.capacity);
    assert.equal(response.body.room.availability_status, 'available');

    const duplicate = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${userResponse.body.token}`)
      .send(roomInput)
      .expect(409);

    assert.equal(duplicate.body.error, 'A room with this room_number already exists.');
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});
