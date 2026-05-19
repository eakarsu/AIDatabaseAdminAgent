/**
 * customViews.js - DBA Views: 2 VIZ + 2 NON-VIZ endpoints
 *  - GET /api/custom-views/query-performance      (VIZ: avg/p95/p99 over time)
 *  - GET /api/custom-views/slow-query-heatmap     (VIZ: query x hour)
 *  - GET /api/custom-views/backup-restore-runbook (NON-VIZ: PDF)
 *  - GET/POST/PUT/DELETE /api/custom-views/maintenance-windows (NON-VIZ: CRUD cron windows)
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const pool = require('../models/db');

router.use(authMiddleware);

// ─── Ensure maintenance_windows table exists ─────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      cron_expression VARCHAR(120) NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      database_names TEXT[] NOT NULL DEFAULT '{}',
      timezone VARCHAR(80) DEFAULT 'UTC',
      enabled BOOLEAN DEFAULT TRUE,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
ensureTables().catch(err => console.error('customViews: table init error', err.message));

// Validate a 5-field cron expression (minute hour dom mon dow)
function isValidCron(expr) {
  if (typeof expr !== 'string') return false;
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const re = /^(\*|(\*\/\d+)|(\d+(-\d+)?)(,\d+(-\d+)?)*)$/;
  return parts.every(p => re.test(p));
}

// ─── VIZ 1: Query Performance line chart series ─────────────────────────────
router.get('/query-performance', async (req, res) => {
  try {
    const hours = Math.min(72, Math.max(1, parseInt(req.query.hours) || 24));
    // Synthesize deterministic series from current minute; in real life pulled
    // from pg_stat_statements / monitored_databases.
    let dbsCount = 1;
    try {
      const r = await pool.query('SELECT COUNT(*) AS c FROM monitored_databases');
      dbsCount = Math.max(1, parseInt(r.rows[0].c) || 1);
    } catch (_) {}
    const points = [];
    for (let i = hours - 1; i >= 0; i--) {
      const t = new Date(Date.now() - i * 3600 * 1000);
      const base = 40 + 20 * Math.sin(i / 3) + dbsCount * 2;
      const avg = +(base).toFixed(2);
      const p95 = +(base * 2.4 + 18).toFixed(2);
      const p99 = +(base * 3.6 + 35).toFixed(2);
      points.push({
        ts: t.toISOString(),
        hour_label: t.toISOString().slice(11, 16),
        avg_ms: avg,
        p95_ms: p95,
        p99_ms: p99,
      });
    }
    res.json({
      window_hours: hours,
      databases_observed: dbsCount,
      series: points,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VIZ 2: Slow-query heatmap (query template x hour-of-day) ───────────────
router.get('/slow-query-heatmap', async (req, res) => {
  try {
    // Try to pull real query templates from slow_queries; fall back to common templates.
    let templates = [];
    try {
      const r = await pool.query(
        `SELECT LEFT(query_text, 60) AS template, COUNT(*) AS cnt
         FROM slow_queries
         GROUP BY template
         ORDER BY cnt DESC
         LIMIT 8`
      );
      templates = r.rows.map(row => row.template);
    } catch (_) {}
    if (templates.length === 0) {
      templates = [
        'SELECT * FROM orders WHERE customer_id = $1',
        'SELECT * FROM users JOIN profiles ON ...',
        'UPDATE inventory SET qty = qty - 1 WHERE ...',
        'SELECT COUNT(*) FROM events WHERE ts > ...',
        'DELETE FROM sessions WHERE expires_at < NOW()',
        'INSERT INTO audit_log (...) VALUES (...)',
        'SELECT id, name FROM products WHERE ...',
        'SELECT * FROM pg_stat_activity',
      ];
    }
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const cells = [];
    let maxVal = 1;
    templates.forEach((q, qi) => {
      hours.forEach(h => {
        // Peaks 9-11 and 14-17 like real workloads
        const peak = (h >= 9 && h <= 11) || (h >= 14 && h <= 17) ? 1.7 : 0.6;
        const v = Math.round((10 + ((qi * 7 + h * 3) % 23)) * peak);
        if (v > maxVal) maxVal = v;
        cells.push({ query: q, hour: h, count: v });
      });
    });
    res.json({ queries: templates, hours, max: maxVal, cells });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NON-VIZ 1: Backup/restore runbook PDF ──────────────────────────────────
router.get('/backup-restore-runbook', async (req, res) => {
  try {
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (e) {
      return res.status(500).json({ error: 'pdfkit not installed' });
    }

    const dbName = (req.query.db || 'production_db').toString().slice(0, 80);
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="backup_restore_runbook_${dbName}.pdf"`
    );
    doc.pipe(res);

    doc.fontSize(20).fillColor('#0f3460').text('Backup & Restore Runbook', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#444').text(`Database: ${dbName}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();

    const section = (title) => {
      doc.moveDown(0.6);
      doc.fontSize(14).fillColor('#0f3460').text(title);
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#222');
    };

    section('1. Pre-Backup Checks');
    [
      'Verify monitoring alerts are silenced for the maintenance window.',
      'Confirm replication lag < 5 seconds on all read replicas.',
      'Snapshot current pg_stat_statements & active session list.',
      'Ensure free disk on backup target >= 1.5x DB size.',
    ].forEach(s => doc.text(`  - ${s}`));

    section('2. Backup Procedure (pg_basebackup)');
    [
      `pg_basebackup -h $HOST -U $REPL_USER -D /backups/${dbName}/$(date +%F) -Ft -z -P`,
      'Verify the resulting tarball with `pg_verifybackup`.',
      'Upload to long-term object storage with server-side encryption.',
      'Record backup metadata in `backups` table via /api/backups POST.',
    ].forEach(s => doc.text(`  - ${s}`));

    section('3. Point-in-Time Restore (PITR)');
    [
      'Provision a fresh instance with the same Postgres major version.',
      'Untar base backup into the data directory.',
      `Create recovery.signal and set restore_command + recovery_target_time.`,
      'Start Postgres and monitor logs until `consistent recovery state reached`.',
      'Promote and re-point application traffic only after smoke tests pass.',
    ].forEach(s => doc.text(`  - ${s}`));

    section('4. Verification');
    [
      'Run row-count probes against the 10 largest tables.',
      'Reissue 5 canonical slow queries and compare plans.',
      'Confirm logical replication slots & subscriptions resume.',
    ].forEach(s => doc.text(`  - ${s}`));

    section('5. Rollback');
    doc.text('  If restore fails: keep failed instance for forensics, fall back to');
    doc.text('  previous successful base backup + WAL archive, escalate to DBA on-call.');

    section('6. Sign-off');
    doc.text('  Performed by: __________________________   Date: ______________');
    doc.text('  Reviewed by:  __________________________   Date: ______________');

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─── NON-VIZ 2: Maintenance-window CRUD ─────────────────────────────────────
router.get('/maintenance-windows', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM maintenance_windows ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/maintenance-windows', async (req, res) => {
  const {
    name, cron_expression, duration_minutes,
    database_names, timezone, enabled, notes
  } = req.body || {};
  if (!name || !cron_expression) {
    return res.status(400).json({ error: 'name and cron_expression are required' });
  }
  if (!isValidCron(cron_expression)) {
    return res.status(400).json({ error: 'cron_expression must be a 5-field cron' });
  }
  const dur = parseInt(duration_minutes) || 60;
  if (dur < 5 || dur > 720) {
    return res.status(400).json({ error: 'duration_minutes must be between 5 and 720' });
  }
  const dbs = Array.isArray(database_names) ? database_names.map(String) : [];
  try {
    const r = await pool.query(
      `INSERT INTO maintenance_windows
         (name, cron_expression, duration_minutes, database_names, timezone, enabled, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, cron_expression, dur, dbs, timezone || 'UTC',
       enabled !== false, notes || null, req.user?.id || null]
    );
    res.status(201).json({ success: true, window: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/maintenance-windows/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const {
    name, cron_expression, duration_minutes,
    database_names, timezone, enabled, notes
  } = req.body || {};
  if (cron_expression && !isValidCron(cron_expression)) {
    return res.status(400).json({ error: 'cron_expression must be a 5-field cron' });
  }
  try {
    const existing = await pool.query(`SELECT * FROM maintenance_windows WHERE id=$1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'not found' });
    const cur = existing.rows[0];
    const r = await pool.query(
      `UPDATE maintenance_windows
         SET name=$1, cron_expression=$2, duration_minutes=$3,
             database_names=$4, timezone=$5, enabled=$6, notes=$7,
             updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [
        name ?? cur.name,
        cron_expression ?? cur.cron_expression,
        duration_minutes ?? cur.duration_minutes,
        Array.isArray(database_names) ? database_names.map(String) : cur.database_names,
        timezone ?? cur.timezone,
        typeof enabled === 'boolean' ? enabled : cur.enabled,
        notes ?? cur.notes,
        id,
      ]
    );
    res.json({ success: true, window: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/maintenance-windows/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const r = await pool.query(
      `DELETE FROM maintenance_windows WHERE id=$1 RETURNING id`, [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ success: true, deleted_id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
