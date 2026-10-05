const writeQueues = new WeakMap();
const RESERVATION_STATUSES = new Set(['active', 'cancelled']);

function run(db, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, parameters, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, parameters, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function all(db, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, parameters, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

function serializeWrites(db, operation) {
  const previous = writeQueues.get(db) || Promise.resolve();
  const current = previous.then(operation, operation);
  writeQueues.set(db, current);

  return current.finally(() => {
    if (writeQueues.get(db) === current) {
      writeQueues.delete(db);
    }
  });
}

class Reservation {
  constructor({ id = null, userId, roomId, roomName = roomId, startDate, endDate, status = 'active', createdAt = new Date() }) {
    if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
      throw new TypeError('userId must be a positive integer');
    }

    if (typeof roomId !== 'string' || roomId.trim() === '') {
      throw new TypeError('roomId is required');
    }

    if (typeof roomName !== 'string' || roomName.trim() === '') {
      throw new TypeError('roomName is required');
    }

    if (startDate === null || startDate === undefined || endDate === null || endDate === undefined) {
      throw new RangeError('Reservation dates must be valid');
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    const parsedCreatedAt = new Date(createdAt);

    if (
      Number.isNaN(parsedStartDate.getTime()) ||
      Number.isNaN(parsedEndDate.getTime()) ||
      Number.isNaN(parsedCreatedAt.getTime())
    ) {
      throw new RangeError('Reservation dates must be valid');
    }

    if (parsedStartDate >= parsedEndDate) {
      throw new RangeError('endDate must be after startDate');
    }

    if (!RESERVATION_STATUSES.has(status)) {
      throw new TypeError('status must be active or cancelled');
    }

    if (id !== null && (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
      throw new TypeError('id must be a positive integer');
    }

    this.id = id === null ? null : Number(id);
    this.userId = Number(userId);
    this.roomId = roomId.trim();
    this.roomName = roomName.trim();
    this.status = status;
    this.startDate = parsedStartDate.toISOString();
    this.endDate = parsedEndDate.toISOString();
    this.createdAt = parsedCreatedAt.toISOString();
  }

  static fromRow(row) {
    return new Reservation({
      id: row.id,
      userId: row.user_id,
      roomId: row.room_id || row.room_name,
      roomName: row.room_name,
      startDate: row.start_time,
      endDate: row.end_time,
      status: row.status || 'active',
      createdAt: row.created_at.includes('T')
        ? row.created_at
        : `${row.created_at.replace(' ', 'T')}Z`,
    });
  }

  static async createIfAvailable(db, reservationData) {
    await db.ready;
    const reservation = new Reservation(reservationData);

    return serializeWrites(db, async () => {
      await run(db, 'BEGIN IMMEDIATE');

      try {
        const conflict = await get(
          db,
          `SELECT id FROM reservations
           WHERE room_id = ? AND status = 'active'
             AND start_time < ? AND end_time > ?
           LIMIT 1`,
          [reservation.roomId, reservation.endDate, reservation.startDate]
        );

        if (conflict) {
          await run(db, 'ROLLBACK');
          return null;
        }

        const result = await run(
          db,
          `INSERT INTO reservations
             (room_name, room_id, user_id, start_time, end_time, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            reservation.roomName,
            reservation.roomId,
            reservation.userId,
            reservation.startDate,
            reservation.endDate,
            reservation.status,
            reservation.createdAt,
          ]
        );

        const created = new Reservation({ ...reservation, id: result.lastID });
        await run(db, 'COMMIT');
        return created;
      } catch (error) {
        try {
          await run(db, 'ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            'Reservation transaction failed and could not be rolled back',
            { cause: error }
          );
        }
        throw error;
      }
    });
  }

  static async listForUser(db, userId) {
    await db.ready;
    const rows = await all(
      db,
      `SELECT id, room_name, room_id, user_id, start_time, end_time, status, created_at
       FROM reservations WHERE user_id = ? ORDER BY start_time ASC, id ASC`,
      [userId]
    );
    return rows.map(Reservation.fromRow);
  }

  static async cancelForUser(db, reservationId, userId) {
    await db.ready;
    const result = await run(
      db,
      `UPDATE reservations SET status = 'cancelled'
       WHERE id = ? AND user_id = ? AND status = 'active'`,
      [reservationId, userId]
    );

    if (result.changes === 0) {
      return null;
    }

    const row = await get(
      db,
      `SELECT id, room_name, room_id, user_id, start_time, end_time, status, created_at
       FROM reservations WHERE id = ? AND user_id = ?`,
      [reservationId, userId]
    );
    return row ? Reservation.fromRow(row) : null;
  }
}

module.exports = Reservation;
