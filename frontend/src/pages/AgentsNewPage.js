import React, { useState } from 'react';
import api from '../services/api';

const FEATURES = [
  {
    key: 'query-analyze',
    title: 'Query Analyzer',
    icon: '🔍',
    desc: 'Deep SQL query analysis with optimization recommendations',
    fields: [
      { name: 'sql_query', label: 'SQL Query', type: 'textarea', required: true,
        placeholder: 'SELECT * FROM orders WHERE customer_id = 42' },
      { name: 'table_name', label: 'Table Name (optional)', type: 'text' },
    ],
    apiCall: api.agentQueryAnalyze,
  },
  {
    key: 'index-advisor',
    title: 'Index Advisor',
    icon: '📑',
    desc: 'Recommend indexes based on table structure & query patterns',
    fields: [
      { name: 'table_name', label: 'Table Name', type: 'text', required: true },
      { name: 'columns', label: 'Columns (JSON array)', type: 'textarea',
        placeholder: '[{"name":"customer_id","type":"int"},{"name":"created_at","type":"timestamp"}]' },
      { name: 'query_patterns', label: 'Query Patterns (JSON array)', type: 'textarea',
        placeholder: '["WHERE customer_id = ?","ORDER BY created_at"]' },
    ],
    parseFields: ['columns', 'query_patterns'],
    apiCall: api.agentIndexAdvisor,
  },
  {
    key: 'health-report',
    title: 'Health Report',
    icon: '❤️',
    desc: 'Score database health & identify bottlenecks',
    fields: [
      { name: 'db_name', label: 'Database Name', type: 'text', required: true },
      { name: 'metrics', label: 'Metrics (JSON)', type: 'textarea',
        placeholder: '{"cpu_pct":75,"memory_pct":82,"disk_pct":60,"connections":150,"slow_queries":23}' },
    ],
    parseFields: ['metrics'],
    apiCall: api.agentHealthReport,
  },
  {
    key: 'capacity-forecast',
    title: 'Capacity Forecast',
    icon: '📈',
    desc: 'Project growth & estimate scaling milestones',
    fields: [
      { name: 'current_size_gb', label: 'Current Size (GB)', type: 'number', required: true },
      { name: 'growth_rate_pct', label: 'Monthly Growth Rate (%)', type: 'number', required: true },
      { name: 'time_horizon_months', label: 'Time Horizon (months)', type: 'number', required: true },
    ],
    apiCall: api.agentCapacityForecast,
  },
  {
    key: 'lock-analysis',
    title: 'Lock Analysis',
    icon: '🔒',
    desc: 'Detect blocking queries & resolve lock contention',
    fields: [
      { name: 'blocking_queries', label: 'Blocking Queries (JSON array)', type: 'textarea',
        placeholder: '[{"pid":12345,"query":"UPDATE orders SET status=...","wait_seconds":45}]' },
      { name: 'wait_events', label: 'Wait Events (JSON array)', type: 'textarea',
        placeholder: '[{"event":"transactionid","count":12}]' },
    ],
    parseFields: ['blocking_queries', 'wait_events'],
    apiCall: api.agentLockAnalysis,
  },
  {
    key: 'workload-analysis',
    title: 'Workload Analysis',
    icon: '📊',
    desc: 'Profile query patterns over time, recommend caching layers',
    fields: [
      { name: 'time_window_hours', label: 'Time Window (hours)', type: 'number', placeholder: '24' },
      { name: 'db_id', label: 'Database ID (optional)', type: 'number' },
    ],
    apiCall: api.agentWorkloadAnalysis,
  },
  {
    key: 'pool-optimizer',
    title: 'Connection Pool Optimizer',
    icon: '🌊',
    desc: 'Tune pool size based on workload patterns & error rates',
    fields: [
      { name: 'current_pool_size', label: 'Current Pool Size', type: 'number', required: true },
      { name: 'peak_active_connections', label: 'Peak Active Connections', type: 'number' },
      { name: 'avg_active_connections', label: 'Avg Active Connections', type: 'number' },
      { name: 'error_rate_pct', label: 'Error Rate (%)', type: 'number' },
      { name: 'queue_depth', label: 'Avg Queue Depth', type: 'number' },
      { name: 'db_max_connections', label: 'DB max_connections', type: 'number' },
      { name: 'app_count', label: 'App Instance Count', type: 'number' },
    ],
    apiCall: api.agentPoolOptimizer,
  },
  {
    key: 'denormalization',
    title: 'Denormalization Advisor',
    icon: '🔀',
    desc: 'Identify heavy joins; recommend safe denormalization',
    fields: [
      { name: 'schema_definition', label: 'Schema (DDL)', type: 'textarea',
        placeholder: 'CREATE TABLE orders (...); CREATE TABLE customers (...);' },
      { name: 'frequent_joins', label: 'Frequent Joins (JSON)', type: 'textarea',
        placeholder: '[{"from":"orders","to":"customers","on":"customer_id","frequency":"high"}]' },
      { name: 'query_patterns', label: 'Query Patterns (JSON)', type: 'textarea' },
      { name: 'write_to_read_ratio', label: 'Write:Read Ratio', type: 'text', placeholder: '1:10' },
    ],
    parseFields: ['frequent_joins', 'query_patterns'],
    apiCall: api.agentDenormalization,
  },
  {
    key: 'replication-lag',
    title: 'Replication Lag Monitor',
    icon: '🔁',
    desc: 'Track primary-replica divergence & failover protocols',
    fields: [
      { name: 'primary_lsn', label: 'Primary LSN', type: 'text' },
      { name: 'replica_lsn', label: 'Replica LSN', type: 'text' },
      { name: 'lag_seconds', label: 'Current Lag (seconds)', type: 'number' },
      { name: 'replica_count', label: 'Replica Count', type: 'number' },
      { name: 'sync_mode', label: 'Sync Mode', type: 'select',
        options: [['asynchronous', 'Asynchronous'], ['synchronous', 'Synchronous'], ['quorum', 'Quorum']] },
      { name: 'recent_lag_history', label: 'Recent Lag History (JSON array)', type: 'textarea',
        placeholder: '[1.2,1.4,2.1,1.8,1.6]' },
    ],
    parseFields: ['recent_lag_history'],
    apiCall: api.agentReplicationLag,
  },
  {
    key: 'storage-cost',
    title: 'Storage Cost Analyzer',
    icon: '💰',
    desc: 'Identify unused indexes & bloat; estimate cleanup savings',
    fields: [
      { name: 'db_id', label: 'Database ID (optional)', type: 'number' },
      { name: 'monthly_storage_cost_usd_per_gb', label: 'Storage Cost (USD/GB/month)', type: 'number', placeholder: '0.10' },
      { name: 'total_size_gb', label: 'Total DB Size (GB)', type: 'number' },
    ],
    apiCall: api.agentStorageCost,
  },
  {
    key: 'predict-backup-failure',
    title: 'Predict Backup Failure',
    icon: '🛡️',
    desc: 'Forecast backup failure risk and the next failure window from history',
    fields: [
      { name: 'backup_history', label: 'Backup History (JSON array)', type: 'textarea', required: true,
        placeholder: '[{"started_at":"2026-04-01T02:00:00Z","status":"success","duration_s":540},{"started_at":"2026-04-02T02:00:00Z","status":"failed","error":"timeout"}]' },
      { name: 'schedule', label: 'Schedule (JSON)', type: 'textarea',
        placeholder: '{"cron":"0 2 * * *","retention_days":14}' },
      { name: 'environment', label: 'Environment (JSON)', type: 'textarea',
        placeholder: '{"db_size_gb":120,"target":"s3","disk_free_pct":42}' },
    ],
    parseFields: ['backup_history', 'schedule', 'environment'],
    apiCall: api.agentPredictBackupFailure,
  },
  {
    key: 'anomaly-detection',
    title: 'Metric Anomaly Detection',
    icon: '🚨',
    desc: 'Flag spikes, drops, and seasonality breaks in a metric series',
    fields: [
      { name: 'metric_name', label: 'Metric Name', type: 'text', required: true, placeholder: 'cpu_pct' },
      { name: 'series', label: 'Series (JSON array of numbers)', type: 'textarea', required: true,
        placeholder: '[40,42,41,43,80,82,44,42]' },
      { name: 'baseline', label: 'Baseline (JSON)', type: 'textarea',
        placeholder: '{"mean":42,"stddev":3,"window":"7d"}' },
    ],
    parseFields: ['series', 'baseline'],
    apiCall: api.agentAnomalyDetection,
  },
  {
    key: 'security-posture-review',
    title: 'Security Posture Review',
    icon: '🔐',
    desc: 'Audit schema, grants, and audit columns for security gaps',
    fields: [
      { name: 'schema', label: 'Schema (JSON)', type: 'textarea',
        placeholder: '{"tables":[{"name":"users","columns":["id","email","password_hash"]}]}' },
      { name: 'grants', label: 'Grants (JSON array)', type: 'textarea',
        placeholder: '[{"role":"app_user","privilege":"ALL","table":"users"}]' },
      { name: 'audit_columns', label: 'Audit Columns Observed (JSON array)', type: 'textarea',
        placeholder: '[{"table":"users","columns":["created_at","updated_at"]}]' },
    ],
    parseFields: ['schema', 'grants', 'audit_columns'],
    apiCall: api.agentSecurityPostureReview,
  },
];

function renderResult(obj, depth = 0) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return (
      <span style={{
        color: typeof obj === 'number' ? '#2ecc71' : (typeof obj === 'boolean' ? (obj ? '#2ecc71' : '#e94560') : '#e0e0e0'),
        fontWeight: typeof obj !== 'string' ? 'bold' : 'normal',
      }}>{String(obj)}</span>
    );
  }
  if (Array.isArray(obj)) {
    return (
      <div style={{ marginLeft: depth * 12 }}>
        {obj.map((item, i) => (
          <div key={i} style={{ background: '#1a1a2e', padding: 10, borderRadius: 8, marginBottom: 6, borderLeft: '3px solid #e94560' }}>
            {typeof item === 'object' ? renderResult(item, depth + 1) : <span style={{ color: '#e0e0e0' }}>{String(item)}</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ marginLeft: depth * 8 }}>
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <div style={{ color: '#e94560', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 3 }}>{k.replace(/_/g, ' ')}</div>
          {typeof v === 'object' && v !== null
            ? renderResult(v, depth + 1)
            : <div style={{ color: '#e0e0e0', background: '#1a1a2e', padding: '6px 10px', borderRadius: 6, fontSize: 13 }}>{renderResult(v)}</div>}
        </div>
      ))}
    </div>
  );
}

function FeatureCard({ feature }) {
  const [formData, setFormData] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const payload = { ...formData };
      if (feature.parseFields) {
        for (const f of feature.parseFields) {
          if (payload[f]) {
            try { payload[f] = JSON.parse(payload[f]); } catch { throw new Error(`${f} must be valid JSON`); }
          }
        }
      }
      for (const f of feature.fields) {
        if (f.type === 'number' && payload[f.name] !== undefined && payload[f.name] !== '') {
          payload[f.name] = Number(payload[f.name]);
        }
      }
      const r = await feature.apiCall(payload);
      if (r && r.error) throw new Error(r.error);
      setResult(r);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const inp = { width: '100%', padding: '8px 12px', background: '#1a1a2e', border: '1px solid #0f3460', borderRadius: 6, color: '#e0e0e0', fontSize: 13, marginBottom: 8, outline: 'none' };

  return (
    <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: expanded ? 12 : 0 }}
           onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{feature.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#e0e0e0' }}>{feature.title}</div>
            <div style={{ fontSize: 12, color: '#a0a0b0' }}>{feature.desc}</div>
          </div>
        </div>
        <button style={{ background: 'transparent', color: '#e94560', border: '1px solid #e94560', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {expanded ? 'Collapse' : 'Open'}
        </button>
      </div>

      {expanded && (
        <form onSubmit={submit}>
          {feature.fields.map(f => (
            <div key={f.name}>
              <label style={{ color: '#a0a0b0', fontSize: 11, display: 'block', marginBottom: 3 }}>
                {f.label}{f.required ? ' *' : ''}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  style={{ ...inp, minHeight: 70, fontFamily: 'monospace', resize: 'vertical' }}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={formData[f.name] || ''}
                  onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                />
              ) : f.type === 'select' ? (
                <select style={inp} value={formData[f.name] || ''} onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}>
                  <option value="">-- default --</option>
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  style={inp}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={formData[f.name] !== undefined ? formData[f.name] : ''}
                  onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '10px 18px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '⏳ Running...' : '🤖 Run AI Analysis'}
          </button>

          {error && <div style={{ marginTop: 12, padding: 10, background: '#e9456020', border: '1px solid #e94560', borderRadius: 6, color: '#e94560', fontSize: 13 }}>{error}</div>}

          {result && (
            <div style={{ marginTop: 12, background: '#0f0f1a', borderRadius: 8, padding: 12, border: '1px solid #0f3460', maxHeight: 500, overflow: 'auto' }}>
              {result.cached && (
                <div style={{ display: 'inline-block', padding: '2px 8px', background: '#2ecc7120', color: '#2ecc71', borderRadius: 4, fontSize: 10, fontWeight: 'bold', marginBottom: 8 }}>
                  ✓ CACHED
                </div>
              )}
              {result.model && (
                <div style={{ color: '#a0a0b0', fontSize: 10, marginBottom: 8 }}>Model: {result.model}</div>
              )}
              {renderResult(result)}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default function AgentsNewPage() {
  return (
    <div style={{ padding: 30, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, color: '#e0e0e0', marginBottom: 8 }}>🤖 Advanced AI Agents</h1>
      <p style={{ color: '#a0a0b0', marginBottom: 24, fontSize: 13 }}>
        13 specialized AI agents for database administration: query analysis, index advisor, health reports, capacity forecasting, lock contention, workload analysis, pool tuning, denormalization, replication lag, storage cost, backup failure prediction, anomaly detection, security posture review.
      </p>
      {FEATURES.map(f => <FeatureCard key={f.key} feature={f} />)}
    </div>
  );
}
