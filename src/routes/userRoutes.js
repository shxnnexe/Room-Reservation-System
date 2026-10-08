const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, findUserByEmail, sanitizeUser } = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function validateEmail(value) {
  return typeof value === 'string' && /\S+@\S+\.\S+/.test(value.trim());
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  const rawName = typeof name === 'string' ? name : String(name || '');
  const rawEmail = typeof email === 'string' ? email : String(email || '');
  const rawPassword = typeof password === 'string' ? password : String(password || '');

  if (!rawName || !rawEmail || !rawPassword) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const trimmedName = rawName.trim();
  const normalizedEmail = rawEmail.trim().toLowerCase();

  if (!trimmedName || !validateEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid name and email address.' });
  }

  if (rawPassword.length < 6) {
    return res.status(400).json({ error: 'Password must contain at least 6 characters.' });
  }

  try {
    const existingUser = await findUserByEmail(req.app.locals.db, normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await createUser(req.app.locals.db, {
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
    });

    const secret = req.app.locals.jwtSecret || process.env.JWT_SECRET || 'room-reservation-secret';
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await findUserByEmail(req.app.locals.db, normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isValidPassword = await bcrypt.compare(String(password), user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const secret = req.app.locals.jwtSecret || process.env.JWT_SECRET || 'room-reservation-secret';
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });

  return res.json({
    message: 'Login successful.',
    token,
    user: sanitizeUser(user),
  });
});

router.get('/me', authMiddleware(), async (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
