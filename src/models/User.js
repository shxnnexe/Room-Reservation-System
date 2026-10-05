function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function createUser(db, { name, email, passwordHash }) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
      function onInsert(err) {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          id: this.lastID,
          name,
          email,
          password_hash: passwordHash,
        });
      }
    );
  });
}

function findUserByEmail(db, email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row || null);
    });
  });
}

function findUserById(db, id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row || null);
    });
  });
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  sanitizeUser,
};
