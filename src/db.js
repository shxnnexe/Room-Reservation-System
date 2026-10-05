const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DEFAULT_DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'room_reservation.db');

function ensureDatabaseDirectory(dbPath) {
  const directory = path.dirname(dbPath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function initializeDatabase(dbPath = DEFAULT_DB_PATH) {
  ensureDatabaseDirectory(dbPath);

  const db = new sqlite3.Database(dbPath);

  db.ready = new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `, (usersError) => {
      if (usersError) {
        reject(usersError);
        return;
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS reservations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_name TEXT NOT NULL,
          room_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `, (reservationsError) => {
        if (reservationsError) {
          reject(reservationsError);
          return;
        }

        db.all('PRAGMA table_info(reservations)', (columnsError, columns) => {
          if (columnsError) {
            reject(columnsError);
            return;
          }

          const existingColumns = new Set(columns.map((column) => column.name));
          const migrations = [];
          if (!existingColumns.has('room_id')) {
            migrations.push("ALTER TABLE reservations ADD COLUMN room_id TEXT NOT NULL DEFAULT ''");
          }
          if (!existingColumns.has('status')) {
            migrations.push("ALTER TABLE reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
          }

          const runNextMigration = (index) => {
            if (index === migrations.length) {
              db.run(
                "UPDATE reservations SET room_id = room_name WHERE room_id = ''",
                (backfillError) => {
                  if (backfillError) {
                    reject(backfillError);
                    return;
                  }

                  resolve(db);
                }
              );
              return;
            }

            db.run(migrations[index], (migrationError) => {
              if (migrationError) {
                reject(migrationError);
                return;
              }

              runNextMigration(index + 1);
            });
          };

          runNextMigration(0);
        });
      });
    });
  });

  return db;
}

module.exports = {
  DEFAULT_DB_PATH,
  initializeDatabase,
};
