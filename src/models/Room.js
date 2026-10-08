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

function listRooms(db) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT ${ROOM_FIELDS} FROM rooms ORDER BY room_number ASC`, (err, rooms) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rooms || []);
    });
  });
}

module.exports = {
  createRoom,
  listRooms,
};
