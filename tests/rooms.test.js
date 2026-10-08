const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('../src/db');
const { createRoom, listRooms } = require('../src/models/Room');

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
