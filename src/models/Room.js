const ROOM_FIELDS = `
  id,
  room_name,
  room_number,
  capacity,
  description,
  availability_status,
  created_at
`;

class RoomValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'RoomValidationError';
    this.field = field;
  }
}

function validateRoomInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RoomValidationError('Room data must be a JSON object.', null);
  }

  const room_name = typeof input.room_name === 'string' ? input.room_name.trim() : '';
  if (!room_name) {
    throw new RoomValidationError('room_name must be a non-empty string.', 'room_name');
  }

  const room_number = typeof input.room_number === 'string' ? input.room_number.trim() : '';
  if (!room_number) {
    throw new RoomValidationError('room_number must be a non-empty string.', 'room_number');
  }

  validateCapacity(input.capacity);

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!description) {
    throw new RoomValidationError('description must be a non-empty string.', 'description');
  }

  const availability_status = input.availability_status === undefined ? 'available' : input.availability_status;
  if (!['available', 'unavailable'].includes(availability_status)) {
    throw new RoomValidationError(
      'availability_status must be either "available" or "unavailable".',
      'availability_status'
    );
  }

  return { room_name, room_number, capacity: input.capacity, description, availability_status };
}

async function createRoom(db, input) {
  await db.ready;
  const { room_name, room_number, capacity, description, availability_status } = validateRoomInput(input);

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
    throw new RoomValidationError('capacity must be a positive integer.', 'capacity');
  }
}

async function listRooms(db, searchTerm = '') {
  await db.ready;
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

async function findRoomById(db, roomId) {
  await db.ready;
  const id = Number(roomId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return new Promise((resolve, reject) => {
    db.get(`SELECT ${ROOM_FIELDS} FROM rooms WHERE id = ?`, [id], (error, room) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(room || null);
    });
  });
}

module.exports = {
  createRoom,
  listRooms,
  findRoomById,
  RoomValidationError,
  validateRoomInput,
  validateCapacity,
};
