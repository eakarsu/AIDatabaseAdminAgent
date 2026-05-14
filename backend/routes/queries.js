const express = require('express');
const pool = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [count, data] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM query_logs'),
      pool.query(
        `SELECT ql.*, md.name AS db_name FROM query_logs ql
         LEFT JOIN monitored_databases md ON ql.database_id = md.id
         ORDER BY ql.execution_time_ms DESC NULLS LAST
         LIMIT $1 OFFSET $2`,
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

router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ql.*, md.name AS db_name FROM query_logs ql
       LEFT JOIN monitored_databases md ON ql.database_id = md.id
       WHERE ql.id = $1`,
      [req.params.id]
    );
    r.rows.length ? res.json(r.rows[0]) : res.status(404).json({ error: 'Not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
