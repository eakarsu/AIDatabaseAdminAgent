/**
 * backupNew.js - Readable backup scheduling endpoints
 * Supplements the minified backups.js with scheduling and history management.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const pool = require('../models/db');

router.use(authMiddleware);

// ─── Ensure tables exist on first use ────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backup_schedules (
      id SERIAL PRIMARY KEY,
      db_name VARCHAR(255) NOT NULL,
      frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
      retention_days INTEGER NOT NULL DEFAULT 30,
      enabled BOOLEAN DEFAULT TRUE,
      last_run_at TIMESTAMP,
      next_run_at TIMESTAMP,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS backup_history (
      id SERIAL PRIMARY KEY,
      schedule_id INTEGER REFERENCES backup_schedules(id) ON DELETE SET NULL,
      db_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
      size_mb DECIMAL(10,2),
      duration_seconds INTEGER,
      storage_path TEXT,
      error_message TEXT,
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    );
  `);
}

ensureTables().catch(err => console.error('backupNew: table init error', err.message));

// ─── POST /api/backup-new/schedule ───────────────────────────────────────────
router.post('/schedule', async (req, res) => {
  const { db_name, frequency, retention_days } = req.body;

  if (!db_name || !frequency) {
    return res.status(400).json({ error: 'db_name and frequency are required' });
  }

  const validFrequencies = ['hourly', 'daily', 'weekly', 'monthly'];
  if (!validFrequencies.includes(frequency)) {
    return res.status(400).json({ error: `frequency must be one of: ${validFrequencies.join(', ')}` });
  }

  const retentionDays = parseInt(retention_days) || 30;
  if (retentionDays < 1 || retentionDays > 365) {
    return res.status(400).json({ error: 'retention_days must be between 1 and 365' });
  }

  // Compute next_run_at based on frequency
  const nextRunMap = {
    hourly: "NOW() + INTERVAL '1 hour'",
    daily: "NOW() + INTERVAL '1 day'",
    weekly: "NOW() + INTERVAL '7 days'",
    monthly: "NOW() + INTERVAL '30 days'"
  };

  try {
    const result = await pool.query(
      `INSERT INTO backup_schedules (db_name, frequency, retention_days, created_by, next_run_at)
       VALUES ($1, $2, $3, $4, ${nextRunMap[frequency]})
       RETURNING *`,
      [db_name, frequency, retentionDays, req.user?.id || null]
    );
    res.status(201).json({ success: true, schedule: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/backup-new/schedules ───────────────────────────────────────────
router.get('/schedules', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM backup_schedules ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM backup_schedules')
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/backup-new/history ─────────────────────────────────────────────
router.get('/history', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { db_name, status } = req.query;

  const conditions = [];
  const params = [];

  if (db_name) {
    params.push(db_name);
    conditions.push(`db_name = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    params.push(limit);
    params.push(offset);
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM backup_history ${where} ORDER BY started_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      pool.query(`SELECT COUNT(*) FROM backup_history ${where}`, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
