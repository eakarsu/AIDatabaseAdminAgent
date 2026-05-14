const express = require('express');
const pool = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const [count, data] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM monitored_databases'),
      pool.query('SELECT * FROM monitored_databases ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset])
    ]);
    const total = parseInt(count.rows[0].count);
    res.json({
      data: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM monitored_databases WHERE id=$1', [req.params.id]);
    r.rows.length ? res.json(r.rows[0]) : res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, host, port, db_name, db_type, status } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    const portNum = parseInt(port) || 5432;
    if (portNum < 1 || portNum > 65535) {
      return res.status(400).json({ error: 'port must be a valid TCP port (1-65535)' });
    }
    const validTypes = ['PostgreSQL', 'MySQL', 'MariaDB', 'MongoDB', 'Redis', 'Other'];
    if (db_type && !validTypes.includes(db_type)) {
      return res.status(400).json({ error: `db_type must be one of: ${validTypes.join(', ')}` });
    }
    const validStatuses = ['healthy', 'warning', 'critical', 'unknown'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }
    const r = await pool.query(
      'INSERT INTO monitored_databases(name,host,port,db_name,db_type,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, host, portNum, db_name, db_type || 'PostgreSQL', status || 'healthy', req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, host, port, db_name, db_type, status } = req.body;
    const r = await pool.query(
      'UPDATE monitored_databases SET name=$1,host=$2,port=$3,db_name=$4,db_type=$5,status=$6,updated_at=NOW() WHERE id=$7 RETURNING *',
      [name, host, port, db_name, db_type, status, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM monitored_databases WHERE id=$1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
