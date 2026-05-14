/**
 * agentsNew.js - Readable AI agent endpoints for database analysis
 * Supplements the minified agents.js with full implementations.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const pool = require('../models/db');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Apply auth to all routes
router.use(authMiddleware);
router.use(aiRateLimiter);

// 503 guard when LLM not configured
router.use((req, res, next) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({
      error: 'AI service not configured',
      detail: 'OPENROUTER_API_KEY environment variable is not set'
    });
  }
  next();
});

// Ensure ai_results cache table exists
async function ensureAiResultsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        feature TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        result JSONB NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, feature, cache_key)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_lookup ON ai_results (user_id, feature, cache_key)`);
  } catch (err) {
    console.error('[ai_results] init error:', err.message);
  }
}
ensureAiResultsTable();

async function getCached(userId, feature, payload) {
  try {
    const key = crypto.createHash('md5').update(JSON.stringify(payload || {})).digest('hex');
    const r = await pool.query(
      `SELECT result FROM ai_results WHERE user_id = $1 AND feature = $2 AND cache_key = $3 AND expires_at > NOW() LIMIT 1`,
      [userId || 0, feature, key]
    );
    return r.rows.length ? r.rows[0].result : null;
  } catch { return null; }
}
async function setCached(userId, feature, payload, result, ttlSeconds = 1800) {
  try {
    const key = crypto.createHash('md5').update(JSON.stringify(payload || {})).digest('hex');
    await pool.query(
      `INSERT INTO ai_results (user_id, feature, cache_key, result, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW() + ($5 || ' seconds')::interval)
       ON CONFLICT (user_id, feature, cache_key)
       DO UPDATE SET result = EXCLUDED.result, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
      [userId || 0, feature, key, JSON.stringify(result), String(ttlSeconds)]
    );
  } catch {}
}

// 3-strategy JSON parser — direct → extract+fix → repair-truncation
function parseAIJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    let extracted = text.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(extracted); } catch {}
    let fixed = extracted
      .replace(/:\s*True\b/g, ': true')
      .replace(/:\s*False\b/g, ': false')
      .replace(/:\s*None\b/g, ': null')
      .replace(/'/g, '"');
    try { return JSON.parse(fixed); } catch {}
    try {
      let repaired = fixed.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '').replace(/,\s*$/, '');
      const opens = (repaired.match(/\{/g) || []).length;
      const closes = (repaired.match(/\}/g) || []).length;
      const openBrk = (repaired.match(/\[/g) || []).length;
      const closeBrk = (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < openBrk - closeBrk; i++) repaired += ']';
      for (let i = 0; i < opens - closes; i++) repaired += '}';
      return JSON.parse(repaired);
    } catch {}
  }
  return { raw: text };
}

/**
 * Helper: call OpenRouter and parse JSON from response
 */
async function callAI(systemPrompt, userContent) {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-db-admin-agent.local',
        'X-Title': 'AI Database Admin Agent'
      }
    }
  );

  const text = response.data.choices[0].message.content;
  return parseAIJson(text);
}

/**
 * Log analysis result to agent_analysis_log
 */
async function logAnalysis(agentType, input, output, userId) {
  try {
    await pool.query(
      `INSERT INTO agent_analysis_log (agent_type, input_payload, output_payload, user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [agentType, JSON.stringify(input), JSON.stringify(output), userId || null]
    );
  } catch (_) {
    // Non-fatal: log table may not exist yet
  }
}

// ─── POST /api/agents-new/query-analyze ─────────────────────────────────────
router.post('/query-analyze', async (req, res) => {
  const { sql_query, table_name } = req.body;

  if (!sql_query) {
    return res.status(400).json({ error: 'sql_query is required' });
  }

  const systemPrompt = `You are a senior PostgreSQL database performance expert.
Analyze the provided SQL query and return a structured JSON response with:
- summary: brief one-sentence analysis
- indexes_needed: array of objects { column, reason, estimated_improvement_pct }
- optimization_suggestions: array of objects { suggestion, priority ("high"|"medium"|"low"), expected_impact }
- estimated_cost: object { relative_cost ("low"|"medium"|"high"), estimated_rows, full_scan_risk (boolean) }
- rewritten_query: an optimized version of the query if improvements are possible, or null
Return ONLY valid JSON, no markdown.`;

  const userContent = `SQL Query to analyze:\n\`\`\`sql\n${sql_query}\n\`\`\`${table_name ? `\nTable name: ${table_name}` : ''}`;

  try {
    const cached = await getCached(req.user?.id, 'query-analyze', { sql_query, table_name });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('query-analyze', { sql_query, table_name }, result, req.user?.id);
    const out = { success: true, analysis: result, model: MODEL };
    await setCached(req.user?.id, 'query-analyze', { sql_query, table_name }, out, 1800);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/index-advisor ─────────────────────────────────────
router.post('/index-advisor', async (req, res) => {
  const { table_name, columns, query_patterns } = req.body;

  if (!table_name) {
    return res.status(400).json({ error: 'table_name is required' });
  }

  const systemPrompt = `You are a PostgreSQL index optimization expert.
Given a table name, its columns, and common query patterns, recommend indexes.
Return a JSON object with:
- recommendations: array of objects, each containing:
  - index_name: suggested index name
  - create_statement: full CREATE INDEX IF NOT EXISTS statement
  - columns_covered: array of column names included
  - index_type: "btree" | "hash" | "gin" | "gist" | "brin"
  - use_case: explanation of when this index is used
  - estimated_benefit: "high" | "medium" | "low"
  - trade_offs: storage and write overhead notes
- overall_strategy: brief paragraph summarizing the indexing strategy
Return ONLY valid JSON, no markdown.`;

  const userContent = `Table: ${table_name}
Columns: ${JSON.stringify(columns || [])}
Common query patterns: ${JSON.stringify(query_patterns || [])}`;

  try {
    const cached = await getCached(req.user?.id, 'index-advisor', { table_name, columns, query_patterns });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('index-advisor', { table_name, columns, query_patterns }, result, req.user?.id);
    const out = { success: true, advisor: result, model: MODEL };
    await setCached(req.user?.id, 'index-advisor', { table_name, columns, query_patterns }, out, 1800);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/health-report ─────────────────────────────────────
router.post('/health-report', async (req, res) => {
  const { db_name, metrics } = req.body;

  if (!db_name) {
    return res.status(400).json({ error: 'db_name is required' });
  }

  const systemPrompt = `You are a database reliability engineer specializing in PostgreSQL health assessments.
Analyze the provided database metrics and return a JSON object with:
- health_score: integer 0-100 (100 = perfectly healthy)
- status: "healthy" | "warning" | "critical"
- bottlenecks: array of objects { area, severity ("low"|"medium"|"high"|"critical"), description }
- recommendations: array of objects { action, priority ("immediate"|"short_term"|"long_term"), expected_outcome }
- summary: 2-3 sentence executive summary of the database health
Return ONLY valid JSON, no markdown.`;

  const userContent = `Database: ${db_name}
Metrics: ${JSON.stringify(metrics || {})}`;

  try {
    const cached = await getCached(req.user?.id, 'health-report', { db_name, metrics });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('health-report', { db_name, metrics }, result, req.user?.id);
    const out = { success: true, report: result, model: MODEL };
    await setCached(req.user?.id, 'health-report', { db_name, metrics }, out, 600);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/capacity-forecast ──────────────────────────────────
router.post('/capacity-forecast', async (req, res) => {
  const { current_size_gb, growth_rate_pct, time_horizon_months } = req.body;

  if (current_size_gb === undefined || growth_rate_pct === undefined || !time_horizon_months) {
    return res.status(400).json({
      error: 'current_size_gb, growth_rate_pct, and time_horizon_months are required'
    });
  }

  const systemPrompt = `You are a cloud infrastructure and database capacity planning expert.
Based on current database size, growth rate, and time horizon, provide capacity forecast and scaling plan.
Return a JSON object with:
- projected_sizes: array of objects { month, size_gb } for each month in the horizon
- scaling_milestones: array of objects { month, size_gb, action_required, urgency }
- recommendations: array of objects { timeframe, action, cost_impact ("low"|"medium"|"high"), description }
- cost_estimates: object { storage_cost_monthly_usd_current, storage_cost_monthly_usd_projected, optimization_savings_potential_pct }
- summary: brief narrative of the capacity outlook
Return ONLY valid JSON, no markdown.`;

  const userContent = `Current database size: ${current_size_gb} GB
Monthly growth rate: ${growth_rate_pct}%
Forecast horizon: ${time_horizon_months} months`;

  try {
    const cached = await getCached(req.user?.id, 'capacity-forecast', { current_size_gb, growth_rate_pct, time_horizon_months });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('capacity-forecast', { current_size_gb, growth_rate_pct, time_horizon_months }, result, req.user?.id);
    const out = { success: true, forecast: result, model: MODEL };
    await setCached(req.user?.id, 'capacity-forecast', { current_size_gb, growth_rate_pct, time_horizon_months }, out, 3600);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/lock-analysis ─────────────────────────────────────
router.post('/lock-analysis', async (req, res) => {
  const { blocking_queries, wait_events } = req.body;

  if (!blocking_queries && !wait_events) {
    return res.status(400).json({ error: 'blocking_queries or wait_events is required' });
  }

  const systemPrompt = `You are a PostgreSQL concurrency and locking expert.
Analyze the provided blocking queries and wait events to identify deadlocks and lock contention issues.
Return a JSON object with:
- deadlock_risk: "none" | "low" | "medium" | "high"
- lock_chains: array of objects { blocker, blocked, lock_type, wait_duration_estimate }
- root_causes: array of strings describing root causes
- resolution_strategies: array of objects { strategy, description, sql_example (if applicable), priority }
- prevention_tips: array of strings with best practices to prevent future lock issues
- immediate_actions: array of SQL statements or commands to resolve current blocking (e.g., pg_terminate_backend)
Return ONLY valid JSON, no markdown.`;

  const userContent = `Blocking queries: ${JSON.stringify(blocking_queries || [])}
Wait events: ${JSON.stringify(wait_events || [])}`;

  try {
    const cached = await getCached(req.user?.id, 'lock-analysis', { blocking_queries, wait_events });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('lock-analysis', { blocking_queries, wait_events }, result, req.user?.id);
    const out = { success: true, analysis: result, model: MODEL };
    await setCached(req.user?.id, 'lock-analysis', { blocking_queries, wait_events }, out, 600);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/workload-analysis ──────────────────────────────────
// Profile query patterns over time, identify top consumers, recommend caching/MV.
router.post('/workload-analysis', async (req, res) => {
  const { time_window_hours, db_id } = req.body;

  try {
    const cached = await getCached(req.user?.id, 'workload-analysis', { time_window_hours, db_id });
    if (cached) return res.json({ ...cached, cached: true });

    // Gather actual workload from query_logs
    const params = [];
    let where = "WHERE created_at > NOW() - INTERVAL '" + (parseInt(time_window_hours) || 24) + " hours'";
    if (db_id) {
      params.push(db_id);
      where += ` AND database_id = $${params.length}`;
    }
    const workload = await pool.query(
      `SELECT query_type, table_name,
              COUNT(*) as exec_count,
              AVG(execution_time_ms)::int as avg_ms,
              MAX(execution_time_ms) as max_ms,
              SUM(execution_time_ms) as total_ms
       FROM query_logs
       ${where}
       GROUP BY query_type, table_name
       ORDER BY total_ms DESC NULLS LAST
       LIMIT 30`,
      params
    );
    const topQueries = await pool.query(
      `SELECT query_text, table_name, execution_time_ms, query_type
       FROM query_logs ${where}
       ORDER BY execution_time_ms DESC NULLS LAST LIMIT 20`,
      params
    );

    const systemPrompt = `You are a PostgreSQL workload profiling expert.
Analyze the supplied query workload and recommend caching, materialized views, or denormalization where appropriate.
Return JSON with:
- workload_summary: { total_queries, avg_ms, p95_ms_estimate, top_consumer_table, hot_query_types }
- top_consumers: array of {pattern, exec_count, total_time_ms, pct_of_workload, recommendation}
- caching_opportunities: array of {pattern, layer ("application"|"redis"|"materialized_view"), expected_hit_rate_pct, estimated_savings_pct}
- materialized_view_candidates: array of {definition_sql, refresh_strategy, expected_savings_pct}
- partition_recommendations: array of {table, partition_key, reason}
- bottleneck_analysis: { primary_bottleneck ("cpu"|"io"|"locks"|"network"|"unknown"), supporting_evidence }
- priority_actions: array of {action, effort, impact, priority (1-5)}
Return ONLY valid JSON, no markdown.`;

    const userContent = `Time window: ${time_window_hours || 24}h
Workload aggregates (top 30):
${JSON.stringify(workload.rows, null, 2)}

Top 20 slowest queries:
${JSON.stringify(topQueries.rows, null, 2)}`;

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('workload-analysis', { time_window_hours, db_id }, result, req.user?.id);
    const out = { success: true, analysis: result, model: MODEL, workload_aggregates: workload.rows };
    await setCached(req.user?.id, 'workload-analysis', { time_window_hours, db_id }, out, 1800);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/connection-pool-optimizer ──────────────────────────
// Monitor connection usage, suggest pool size tuning based on workload patterns.
router.post('/connection-pool-optimizer', async (req, res) => {
  const { current_pool_size, peak_active_connections, avg_active_connections, error_rate_pct, queue_depth, db_max_connections, app_count } = req.body;

  if (current_pool_size === undefined) {
    return res.status(400).json({ error: 'current_pool_size is required' });
  }

  try {
    const cached = await getCached(req.user?.id, 'pool-optimizer', { current_pool_size, peak_active_connections, avg_active_connections, error_rate_pct, queue_depth, db_max_connections, app_count });
    if (cached) return res.json({ ...cached, cached: true });

    const systemPrompt = `You are a connection pool tuning expert for PostgreSQL.
Analyze the connection usage statistics and recommend optimal pool configuration.
Return JSON with:
- diagnosis: one of (over_provisioned/under_provisioned/well_sized/erratic)
- recommended_pool_size: integer
- recommended_max_lifetime_seconds: integer
- recommended_idle_timeout_seconds: integer
- recommended_connection_timeout_ms: integer
- pgbouncer_recommended: boolean (and reason if true)
- queue_strategy: { use_queue (boolean), max_queue_size, queue_timeout_ms }
- monitoring_metrics: array of {metric, threshold, alert_severity}
- risks: array of {risk, severity ("low"|"medium"|"high"), mitigation}
- explanation: 2-3 sentence summary
Return ONLY valid JSON, no markdown.`;

    const userContent = `Current pool size: ${current_pool_size}
Peak active connections: ${peak_active_connections || 'unknown'}
Avg active connections: ${avg_active_connections || 'unknown'}
Error rate (connection refused / timeouts): ${error_rate_pct || 0}%
Average queue depth: ${queue_depth || 0}
DB max_connections: ${db_max_connections || 100}
App instance count: ${app_count || 1}`;

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('pool-optimizer', { current_pool_size, peak_active_connections, avg_active_connections }, result, req.user?.id);
    const out = { success: true, recommendation: result, model: MODEL };
    await setCached(req.user?.id, 'pool-optimizer', { current_pool_size, peak_active_connections, avg_active_connections, error_rate_pct, queue_depth, db_max_connections, app_count }, out, 3600);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/denormalization-advisor ────────────────────────────
// Identify heavily joined tables, suggest denormalization with maintenance impact.
router.post('/denormalization-advisor', async (req, res) => {
  const { schema_definition, frequent_joins, query_patterns, write_to_read_ratio } = req.body;

  if (!schema_definition && !frequent_joins) {
    return res.status(400).json({ error: 'schema_definition or frequent_joins is required' });
  }

  try {
    const cached = await getCached(req.user?.id, 'denormalization', { schema_definition, frequent_joins, write_to_read_ratio });
    if (cached) return res.json({ ...cached, cached: true });

    const systemPrompt = `You are a database normalization & denormalization expert.
Analyze the schema and join patterns to recommend safe denormalization opportunities with maintenance trade-offs.
Return JSON with:
- denormalization_opportunities: array of {tables_involved, suggested_consolidation_table, columns_to_duplicate, expected_read_speedup_pct, write_overhead_pct, recommendation_strength ("strong"|"moderate"|"weak")}
- maintenance_impact: { sync_strategy ("triggers"|"materialized_view"|"app_logic"|"cdc"), refresh_frequency, complexity ("low"|"medium"|"high") }
- data_integrity_risks: array of {risk, mitigation}
- alternative_strategies: array of {strategy, when_to_use, pros, cons}
- reversibility: { difficulty ("easy"|"moderate"|"hard"), rollback_plan }
- recommended_action: 2-3 sentence summary
- implementation_sql: array of DDL/DML statements to apply the recommendation
Return ONLY valid JSON, no markdown.`;

    const userContent = `Schema:
${schema_definition || '(not provided)'}

Frequent joins observed:
${JSON.stringify(frequent_joins || [], null, 2)}

Common query patterns:
${JSON.stringify(query_patterns || [], null, 2)}

Write:Read ratio: ${write_to_read_ratio || 'unknown'}`;

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('denormalization', { schema_definition, frequent_joins, write_to_read_ratio }, result, req.user?.id);
    const out = { success: true, advice: result, model: MODEL };
    await setCached(req.user?.id, 'denormalization', { schema_definition, frequent_joins, write_to_read_ratio }, out, 3600);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/replication-lag-monitor ────────────────────────────
// Track primary-replica lag, alert on threshold breaches, suggest failover.
router.post('/replication-lag-monitor', async (req, res) => {
  const { primary_lsn, replica_lsn, lag_seconds, replica_count, sync_mode, recent_lag_history } = req.body;

  try {
    const cached = await getCached(req.user?.id, 'replication-lag', { primary_lsn, replica_lsn, lag_seconds, replica_count, sync_mode });
    if (cached) return res.json({ ...cached, cached: true });

    const systemPrompt = `You are a PostgreSQL replication and HA expert.
Analyze the replication state and recommend monitoring thresholds, failover protocols, and remediation.
Return JSON with:
- lag_status: one of (healthy/elevated/degraded/critical/replica_disconnected)
- estimated_data_loss_seconds: number
- failover_recommended: boolean
- failover_protocol: { steps: array of strings, expected_downtime_seconds, rollback_procedure }
- alert_thresholds: { warning_seconds, critical_seconds, disconnected_seconds }
- root_cause_hypotheses: array of {cause, likelihood ("high"|"medium"|"low"), supporting_evidence}
- remediations: array of {action, urgency ("immediate"|"short_term"|"long_term"), expected_outcome, sql_or_command}
- monitoring_recommendations: array of {metric, frequency_seconds, alert_channel}
- summary: 2-3 sentence executive summary
Return ONLY valid JSON, no markdown.`;

    const userContent = `Primary LSN: ${primary_lsn || 'unknown'}
Replica LSN: ${replica_lsn || 'unknown'}
Current lag: ${lag_seconds || 0} seconds
Number of replicas: ${replica_count || 1}
Sync mode: ${sync_mode || 'asynchronous'}
Recent lag history (seconds): ${JSON.stringify(recent_lag_history || [])}`;

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('replication-lag', { lag_seconds, replica_count, sync_mode }, result, req.user?.id);
    const out = { success: true, analysis: result, model: MODEL };
    await setCached(req.user?.id, 'replication-lag', { primary_lsn, replica_lsn, lag_seconds, replica_count, sync_mode }, out, 300);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/storage-cost-analyzer ──────────────────────────────
// Identify unused indexes, bloated tables, schemas; estimate cleanup savings.
router.post('/storage-cost-analyzer', async (req, res) => {
  const { db_id, monthly_storage_cost_usd_per_gb, total_size_gb } = req.body;

  try {
    const cached = await getCached(req.user?.id, 'storage-cost', { db_id, monthly_storage_cost_usd_per_gb, total_size_gb });
    if (cached) return res.json({ ...cached, cached: true });

    // Fetch known suggested indexes (proxy for "indexes added/considered")
    const idxStats = await pool.query(
      `SELECT si.*, md.name AS db_name FROM suggested_indexes si
       LEFT JOIN monitored_databases md ON si.database_id = md.id
       ${db_id ? 'WHERE si.database_id = $1' : ''}
       ORDER BY si.impact_score ASC LIMIT 50`,
      db_id ? [db_id] : []
    );
    const dbs = await pool.query(
      `SELECT id, name, size_mb, total_queries, slow_queries
       FROM monitored_databases ${db_id ? 'WHERE id = $1' : ''}`,
      db_id ? [db_id] : []
    );

    const systemPrompt = `You are a database cost optimization & storage hygiene expert.
Analyze the supplied database & index data to identify cleanup opportunities and estimate cost savings.
Return JSON with:
- estimated_savings: { reclaimable_gb, monthly_savings_usd, annual_savings_usd, confidence ("high"|"medium"|"low") }
- unused_indexes: array of {table, index_name, last_used_estimate, size_estimate_mb, drop_statement, risk}
- bloated_tables: array of {table, current_mb, estimated_bloat_pct, vacuum_full_savings_mb, sql_remediation}
- redundant_indexes: array of {indexes, reason, action}
- compression_opportunities: array of {table, current_mb, estimated_compressed_mb, technique}
- archival_candidates: array of {table, age_threshold, estimated_savings_mb, archive_strategy}
- partitioning_opportunities: array of {table, partition_key, expected_savings_pct}
- prioritized_actions: array of {action, savings_mb, effort ("low"|"medium"|"high"), risk ("low"|"medium"|"high"), priority (1-5)}
- summary: 2-3 sentence executive summary
Return ONLY valid JSON, no markdown.`;

    const userContent = `Storage cost: $${monthly_storage_cost_usd_per_gb || 0.10}/GB/month
Total DB size: ${total_size_gb || 0}GB

Monitored databases:
${JSON.stringify(dbs.rows, null, 2)}

Suggested/tracked indexes (low impact_score may indicate unused):
${JSON.stringify(idxStats.rows, null, 2)}`;

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('storage-cost', { db_id, monthly_storage_cost_usd_per_gb, total_size_gb }, result, req.user?.id);
    const out = { success: true, analysis: result, model: MODEL };
    await setCached(req.user?.id, 'storage-cost', { db_id, monthly_storage_cost_usd_per_gb, total_size_gb }, out, 3600);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/predict-backup-failure ─────────────────────────────
router.post('/predict-backup-failure', async (req, res) => {
  const { backup_history, schedule, environment } = req.body || {};

  if (!Array.isArray(backup_history) || backup_history.length === 0) {
    return res.status(400).json({ error: 'backup_history (array) is required' });
  }

  const systemPrompt = `You are a database backup reliability expert.
Analyze the backup history and predict the likelihood and timing of the next failure.
Return a JSON object with:
- failure_risk: "low" | "medium" | "high" | "critical"
- failure_probability_pct: integer 0-100 representing probability of next backup failing
- predicted_window: object { earliest_iso, latest_iso, confidence ("low"|"medium"|"high") }
- root_cause_signals: array of strings
- mitigations: array of objects { action, priority ("immediate"|"short_term"|"long_term"), expected_outcome }
- summary: 2-3 sentence executive summary
Return ONLY valid JSON, no markdown.`;

  const userContent = `Backup history (most recent first):
${JSON.stringify(backup_history, null, 2)}

Schedule: ${JSON.stringify(schedule || {})}
Environment: ${JSON.stringify(environment || {})}`;

  try {
    const cached = await getCached(req.user?.id, 'predict-backup-failure', { backup_history, schedule, environment });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('predict-backup-failure', { backup_history, schedule, environment }, result, req.user?.id);
    const out = { success: true, prediction: result, model: MODEL };
    await setCached(req.user?.id, 'predict-backup-failure', { backup_history, schedule, environment }, out, 1800);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/anomaly-detection ──────────────────────────────────
router.post('/anomaly-detection', async (req, res) => {
  const { metric_name, series, baseline } = req.body || {};

  if (!metric_name || !Array.isArray(series) || series.length === 0) {
    return res.status(400).json({ error: 'metric_name and series (array) are required' });
  }

  const systemPrompt = `You are a database observability and anomaly-detection expert.
Given a time-series of database metrics, detect anomalies (spikes, drops, level shifts, seasonality breaks).
Return a JSON object with:
- anomalies: array of objects { index, value, type ("spike"|"drop"|"level_shift"|"seasonality_break"), severity ("low"|"medium"|"high"|"critical"), explanation }
- overall_risk: "none" | "low" | "medium" | "high"
- trend: "increasing" | "decreasing" | "stable" | "volatile"
- recommendations: array of objects { action, priority, expected_outcome }
- summary: brief narrative
Return ONLY valid JSON, no markdown.`;

  const userContent = `Metric: ${metric_name}
Baseline: ${JSON.stringify(baseline || {})}
Series (chronological): ${JSON.stringify(series)}`;

  try {
    const cached = await getCached(req.user?.id, 'anomaly-detection', { metric_name, series, baseline });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('anomaly-detection', { metric_name, series, baseline }, result, req.user?.id);
    const out = { success: true, detection: result, model: MODEL };
    await setCached(req.user?.id, 'anomaly-detection', { metric_name, series, baseline }, out, 600);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents-new/security-posture-review ────────────────────────────
router.post('/security-posture-review', async (req, res) => {
  const { schema, grants, audit_columns } = req.body || {};

  if (!schema && !grants) {
    return res.status(400).json({ error: 'schema or grants is required' });
  }

  const systemPrompt = `You are a database security and compliance expert.
Review the schema, grants, and audit-column coverage for security weaknesses.
Return a JSON object with:
- posture_score: integer 0-100 (100 = excellent)
- findings: array of objects { area ("audit"|"grants"|"encryption"|"pii"|"injection"), severity ("low"|"medium"|"high"|"critical"), description, remediation }
- missing_audit_columns: array of objects { table, column, suggested_type }
- weak_grants: array of objects { role, privilege, table, recommendation }
- compliance_alignment: object { gdpr ("aligned"|"partial"|"gap"), hipaa ("aligned"|"partial"|"gap"), pci ("aligned"|"partial"|"gap") }
- summary: 2-3 sentence executive summary
Return ONLY valid JSON, no markdown.`;

  const userContent = `Schema: ${JSON.stringify(schema || {}, null, 2)}
Grants: ${JSON.stringify(grants || [], null, 2)}
Audit columns observed: ${JSON.stringify(audit_columns || [])}`;

  try {
    const cached = await getCached(req.user?.id, 'security-posture-review', { schema, grants, audit_columns });
    if (cached) return res.json({ ...cached, cached: true });

    const result = await callAI(systemPrompt, userContent);
    await logAnalysis('security-posture-review', { schema, grants, audit_columns }, result, req.user?.id);
    const out = { success: true, review: result, model: MODEL };
    await setCached(req.user?.id, 'security-posture-review', { schema, grants, audit_columns }, out, 1800);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
