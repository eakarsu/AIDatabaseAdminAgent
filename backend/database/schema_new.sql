-- schema_new.sql
-- New tables added for agent analysis logging, backup scheduling, and backup history.
-- Run with: psql -U <user> -d <database> -f schema_new.sql

-- ─── Backup Schedules ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup_schedules (
  id              SERIAL PRIMARY KEY,
  db_name         VARCHAR(255) NOT NULL,
  frequency       VARCHAR(50)  NOT NULL
                    CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
  retention_days  INTEGER      NOT NULL DEFAULT 30,
  enabled         BOOLEAN      DEFAULT TRUE,
  last_run_at     TIMESTAMP,
  next_run_at     TIMESTAMP,
  created_by      INTEGER,
  created_at      TIMESTAMP    DEFAULT NOW(),
  updated_at      TIMESTAMP    DEFAULT NOW()
);

-- ─── Backup History ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup_history (
  id               SERIAL PRIMARY KEY,
  schedule_id      INTEGER REFERENCES backup_schedules(id) ON DELETE SET NULL,
  db_name          VARCHAR(255) NOT NULL,
  status           VARCHAR(50)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'running', 'success', 'failed')),
  size_mb          DECIMAL(10, 2),
  duration_seconds INTEGER,
  storage_path     TEXT,
  error_message    TEXT,
  started_at       TIMESTAMP    DEFAULT NOW(),
  completed_at     TIMESTAMP
);

-- ─── Agent Analysis Log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_analysis_log (
  id              SERIAL PRIMARY KEY,
  agent_type      VARCHAR(100) NOT NULL,  -- e.g. 'query-analyze', 'index-advisor', etc.
  input_payload   JSONB,
  output_payload  JSONB,
  user_id         INTEGER,
  created_at      TIMESTAMP    DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_backup_history_db_name   ON backup_history (db_name);
CREATE INDEX IF NOT EXISTS idx_backup_history_status    ON backup_history (status);
CREATE INDEX IF NOT EXISTS idx_backup_history_started   ON backup_history (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_log_agent_type     ON agent_analysis_log (agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_log_created        ON agent_analysis_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_db      ON backup_schedules (db_name);
