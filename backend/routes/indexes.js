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
      pool.query('SELECT COUNT(*) FROM suggested_indexes'),
      pool.query(
        `SELECT si.*, md.name AS db_name FROM suggested_indexes si
         LEFT JOIN monitored_databases md ON si.database_id = md.id
         ORDER BY si.impact_score DESC LIMIT $1 OFFSET $2`,
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
    const { database_id, table_name, column_name, index_type, impact_score } = req.body;
    if (!database_id) return res.status(400).json({ error: 'database_id is required' });
    if (!table_name || !column_name) return res.status(400).json({ error: 'table_name and column_name are required' });
    const validTypes = ['btree', 'hash', 'gin', 'gist', 'brin', 'spgist'];
    if (index_type && !validTypes.includes(index_type)) {
      return res.status(400).json({ error: `index_type must be one of: ${validTypes.join(', ')}` });
    }
    const score = parseFloat(impact_score);
    const finalScore = isNaN(score) ? Math.floor(Math.random() * 100) : Math.min(100, Math.max(0, score));
    const r = await pool.query(
      'INSERT INTO suggested_indexes(database_id,table_name,column_name,index_type,impact_score) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [database_id, table_name, column_name, index_type || 'btree', finalScore]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM suggested_indexes WHERE id=$1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
