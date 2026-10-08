const ROOM_FIELDS = `
  id,
  room_name,
  room_number,
  capacity,
  description,
  availability_status,
  created_at
`;

function createRoom(db, { room_name, room_number, capacity, description, availability_status = 'available' }) {
  validateCapacity(capacity);

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO rooms (room_name, room_number, capacity, description, availability_status)
       VALUES (?, ?, ?, ?, ?)`,
      [room_name, room_number, capacity, description, availability_status],
      function onInsert(err) {
        if (err) {
          reject(err);
          return;
        }

        db.get(`SELECT ${ROOM_FIELDS} FROM rooms WHERE id = ?`, [this.lastID], (selectError, room) => {
          if (selectError) {
            reject(selectError);
            return;
          }

          resolve(room);
        });
      }
    );
  });
}

function validateCapacity(capacity) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError('Capacity must be a positive integer.');
  }
}

function listRooms(db, searchTerm = '') {
  const escapedSearchTerm = searchTerm.replace(/[\\%_]/g, '\\$&');
  const pattern = `%${escapedSearchTerm}%`;

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT ${ROOM_FIELDS}
       FROM rooms
       WHERE (? = '' OR room_name LIKE ? ESCAPE '\\' OR room_number LIKE ? ESCAPE '\\')
       ORDER BY room_number ASC`,
      [searchTerm, pattern, pattern],
      (err, rooms) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rooms || []);
      }
    );
  });
}

module.exports = {
  createRoom,
  listRooms,
  validateCapacity,
};
