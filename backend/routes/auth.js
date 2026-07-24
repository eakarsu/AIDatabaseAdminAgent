const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!r.rows.length || !await bcrypt.compare(password, r.rows[0].password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: r.rows[0].id, email, name: r.rows[0].name, role: r.rows[0].role, tenant_id: r.rows[0].tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: r.rows[0].id, email, name: r.rows[0].name, role: r.rows[0].role, tenant_id: r.rows[0].tenant_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, and name are required' });
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    const h = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO users (email, password, name, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, tenant_id',
      [email, h, name, 'observer', crypto.randomUUID()]
    );
    const token = jwt.sign(
      { id: r.rows[0].id, email, name, role: r.rows[0].role, tenant_id: r.rows[0].tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.status(201).json({ token, user: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, tenant_id FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
