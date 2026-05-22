const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { aiRateLimiter } = require('./middleware/rateLimiter');
const pool = require('./models/db');

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS from env
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3005')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));

app.use('/api/ai', require('./routes/queryOptimize'));

app.use('/api/ai', require('./routes/performanceForecast'));

app.use('/api/ai', require('./routes/anomalyDetect'));

app.use('/api/ai', require('./routes/schemaEvolve'));

app.use('/api/ai', require('./routes/costOptimize'));
app.use('/api/databases', require('./routes/databases'));
app.use('/api/queries', require('./routes/queries'));
app.use('/api/indexes', require('./routes/indexes'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/agents', aiRateLimiter, require('./routes/agents'));
app.use('/api/agents-new', require('./routes/agentsNew'));  // already applies aiRateLimiter inside
app.use('/api/backup-new', require('./routes/backupNew'));

// Stats with auth (was unprotected before)
const auth = require('./middleware/auth');
app.get('/api/stats', auth, async (req, res) => {
  try {
    const [dbs, sq, idx, bk] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM monitored_databases'),
      pool.query('SELECT COALESCE(SUM(slow_queries),0) AS total FROM monitored_databases'),
      pool.query('SELECT COUNT(*) AS total FROM suggested_indexes'),
      pool.query('SELECT COUNT(*) AS total FROM backups'),
    ]);
    res.json({
      databases: +dbs.rows[0].total,
      slowQueries: +sq.rows[0].total || 0,
      indexes: +idx.rows[0].total,
      backups: +bk.rows[0].total,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// DBA custom views (2 VIZ + 2 NON-VIZ) — mounted BEFORE error/404 handlers
app.use('/api/custom-views', require('./routes/customViews'));
app.use('/api/failover-drill', require('./routes/failoverDrill'));

// Error handler — avoid leaking internal stack traces
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3004;
// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-missing-optimize-query-analyze-slow-queries-recommend-indexe', require('./routes/gap_missing_optimize_query_analyze_slow_queries_recommend_indexe'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-connection-pooling-or-driver-management-module', require('./routes/gap_no_connection_pooling_or_driver_management_module'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-real-time-monitoring-alerting-beyond-stubs', require('./routes/gap_no_real_time_monitoring_alerting_beyond_stubs'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-limited-cloud-db-integrations-no-aws-rds-azure-sql-gcp-cloud', require('./routes/gap_limited_cloud_db_integrations_no_aws_rds_azure_sql_gcp_cloud'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-replication-failover-management', require('./routes/gap_no_replication_failover_management'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-encryption-or-security-audit-module', require('./routes/gap_no_encryption_or_security_audit_module'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-notification-system', require('./routes/gap_no_notification_system'));

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  console.log(`CORS origins: ${corsOrigins.join(', ')}`);
});
