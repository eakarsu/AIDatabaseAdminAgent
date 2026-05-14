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
      pool.query('SELECT COUNT(*) FROM backups'),
      pool.query(
        `SELECT b.*, md.name AS db_name FROM backups b
         LEFT JOIN monitored_databases md ON b.database_id = md.id
         ORDER BY b.started_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
    ]);
    const total = parseInt(count.rows[0].count);
    res.json({
      data: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { database_id, backup_type } = req.body;
    if (!database_id) return res.status(400).json({ error: 'database_id is required' });
    const validTypes = ['full', 'incremental', 'differential', 'snapshot', 'logical'];
    if (backup_type && !validTypes.includes(backup_type)) {
      return res.status(400).json({ error: `backup_type must be one of: ${validTypes.join(', ')}` });
    }
    const r = await pool.query(
      'INSERT INTO backups(database_id,backup_type,status) VALUES($1,$2,$3) RETURNING *',
      [database_id, backup_type || 'full', 'in_progress']
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM backups WHERE id=$1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
