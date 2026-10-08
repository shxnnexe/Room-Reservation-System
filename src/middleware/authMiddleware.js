const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/User');

function authMiddleware(required = true) {
  return async function auth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
      if (!required) {
        return next();
      }

      return res.status(401).json({ error: 'Authentication required.' });
    }

    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    try {
      const secret = req.app.locals.jwtSecret || process.env.JWT_SECRET || 'room-reservation-secret';
      const payload = jwt.verify(token, secret);
      const user = await findUserById(req.app.locals.db, payload.userId);

      if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
      }

      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
}

module.exports = authMiddleware;
