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
      name: 'RangeError',
      message: 'Capacity must be a positive integer.',
    });
  }

  assert.doesNotThrow(() => validateCapacity(1));
});

test('GET /api/rooms returns an empty collection when no rooms exist', async () => {
  const dbPath = getDbPath();
  const app = createApp({ dbPath });

  try {
    const response = await request(app).get('/api/rooms').expect(200);

    assert.deepEqual(response.body, { rooms: [], count: 0 });
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

    assert.equal(response.body.count, 1);
    assert.equal(response.body.rooms[0].room_name, 'Training Room');
    assert.equal(response.body.rooms[0].room_number, 'T-202');
    assert.equal(response.body.rooms[0].capacity, 20);
  } finally {
    await closeAndRemoveDb(app.locals.db, dbPath);
  }
});
