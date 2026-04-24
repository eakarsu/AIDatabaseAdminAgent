const express = require('express'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), pool = require('../models/db'), router = express.Router();
router.post('/login', async (req, res) => {
  try { const { email, password } = req.body; const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!r.rows.length || !await bcrypt.compare(password, r.rows[0].password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: r.rows[0].id, email, name: r.rows[0].name }, process.env.JWT_SECRET || 'supersecretkey123', { expiresIn: '24h' });
    res.json({ token, user: { id: r.rows[0].id, email, name: r.rows[0].name } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/register', async (req, res) => {
  try { const { email, password, name } = req.body; const h = await bcrypt.hash(password, 10);
    const r = await pool.query('INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name', [email, h, name]);
    const token = jwt.sign({ id: r.rows[0].id, email, name }, process.env.JWT_SECRET || 'supersecretkey123', { expiresIn: '24h' });
    res.status(201).json({ token, user: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
