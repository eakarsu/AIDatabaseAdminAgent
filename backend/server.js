const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

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
app.use('/api/governed-workflows', require('./routes/governedWorkflow'));

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

const PORT = process.env.PORT || 3004;
// Error handler — avoid leaking internal stack traces.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  console.log(`CORS origins: ${corsOrigins.join(', ')}`);
});
