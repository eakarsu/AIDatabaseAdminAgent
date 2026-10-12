// Local examples only. Database references are never fabricated by a preset.
const examples = {
  'query-analyze': [
    { sql_query: 'SELECT customer_id, COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL \'30 days\' GROUP BY customer_id;', table_name: 'orders' },
    { sql_query: 'SELECT id, status FROM invoices WHERE account_id = $1 ORDER BY issued_at DESC LIMIT 50;', table_name: 'invoices' },
  ],
  'index-advisor': [
    { table_name: 'orders', columns: [{ name: 'customer_id', type: 'bigint' }, { name: 'created_at', type: 'timestamp' }], query_patterns: ['WHERE customer_id = ?', 'WHERE customer_id = ? ORDER BY created_at DESC'] },
    { table_name: 'invoices', columns: [{ name: 'account_id', type: 'bigint' }, { name: 'issued_at', type: 'date' }], query_patterns: ['WHERE account_id = ?', 'ORDER BY issued_at DESC LIMIT 50'] },
  ],
  'health-report': [
    { db_name: 'orders_reporting', metrics: { cpu_pct: 72, memory_pct: 81, disk_pct: 64, connections: 120, slow_queries: 18 } },
    { db_name: 'billing_primary', metrics: { cpu_pct: 34, memory_pct: 59, disk_pct: 77, connections: 48, slow_queries: 2 } },
  ],
  'capacity-forecast': [
    { current_size_gb: 120, growth_rate_pct: 8, time_horizon_months: 12 },
    { current_size_gb: 480, growth_rate_pct: 3, time_horizon_months: 18 },
  ],
  'lock-analysis': [
    { blocking_queries: [{ pid: 4812, query: 'UPDATE orders SET status = $1 WHERE id = $2', wait_seconds: 42 }], wait_events: [{ event: 'transactionid', count: 12 }] },
    { blocking_queries: [{ pid: 7821, query: 'DELETE FROM expired_sessions WHERE expires_at < NOW()', wait_seconds: 18 }], wait_events: [{ event: 'tuple', count: 4 }] },
  ],
  'workload-analysis': [
    { time_window_hours: 24 }, { time_window_hours: 72 },
  ],
  'pool-optimizer': [
    { current_pool_size: 20, peak_active_connections: 18, avg_active_connections: 11, error_rate_pct: 0.4, queue_depth: 3, db_max_connections: 100, app_count: 3 },
    { current_pool_size: 40, peak_active_connections: 36, avg_active_connections: 20, error_rate_pct: 1.2, queue_depth: 7, db_max_connections: 150, app_count: 4 },
  ],
  denormalization: [
    { schema_definition: 'CREATE TABLE customers (id bigint PRIMARY KEY, name text); CREATE TABLE orders (id bigint PRIMARY KEY, customer_id bigint REFERENCES customers(id));', frequent_joins: [{ from: 'orders', to: 'customers', on: 'customer_id', frequency: 'high' }], query_patterns: ['SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id'], write_to_read_ratio: '1:10' },
    { schema_definition: 'CREATE TABLE products (id bigint PRIMARY KEY, category_id bigint); CREATE TABLE categories (id bigint PRIMARY KEY, name text);', frequent_joins: [{ from: 'products', to: 'categories', on: 'category_id', frequency: 'medium' }], query_patterns: ['SELECT p.id, c.name FROM products p JOIN categories c ON c.id = p.category_id'], write_to_read_ratio: '1:25' },
  ],
  'replication-lag': [
    { primary_lsn: '0/16B6C50', replica_lsn: '0/16B6A20', lag_seconds: 2.4, replica_count: 2, sync_mode: 'asynchronous', recent_lag_history: [1.2, 1.8, 2.4] },
    { primary_lsn: '0/26A1F00', replica_lsn: '0/26A1EF0', lag_seconds: 0.2, replica_count: 1, sync_mode: 'synchronous', recent_lag_history: [0.1, 0.3, 0.2] },
  ],
  'storage-cost': [
    { monthly_storage_cost_usd_per_gb: 0.12, total_size_gb: 250 },
    { monthly_storage_cost_usd_per_gb: 0.18, total_size_gb: 900 },
  ],
  'predict-backup-failure': [
    { backup_history: [{ started_at: '2026-10-08T02:00:00Z', status: 'success', duration_s: 540 }, { started_at: '2026-10-09T02:00:00Z', status: 'failed', error: 'timeout' }], schedule: { cron: '0 2 * * *', retention_days: 14 }, environment: { db_size_gb: 120, target: 'object storage', disk_free_pct: 42 } },
    { backup_history: [{ started_at: '2026-10-07T03:00:00Z', status: 'success', duration_s: 820 }, { started_at: '2026-10-08T03:00:00Z', status: 'success', duration_s: 950 }], schedule: { cron: '0 3 * * *', retention_days: 30 }, environment: { db_size_gb: 400, target: 'local backup volume', disk_free_pct: 18 } },
  ],
  'anomaly-detection': [
    { metric_name: 'cpu_pct', series: [40, 42, 41, 43, 80, 82, 44, 42], baseline: { mean: 42, stddev: 3, window: '7d' } },
    { metric_name: 'connection_count', series: [55, 58, 60, 59, 101, 97, 62], baseline: { mean: 59, stddev: 5, window: '24h' } },
  ],
  'security-posture-review': [
    { schema: { tables: [{ name: 'users', columns: ['id', 'email', 'password_hash'] }] }, grants: [{ role: 'app_reader', privilege: 'SELECT', table: 'users' }], audit_columns: [{ table: 'users', columns: ['created_at', 'updated_at'] }] },
    { schema: { tables: [{ name: 'payments', columns: ['id', 'account_id', 'amount'] }] }, grants: [{ role: 'billing_worker', privilege: 'UPDATE', table: 'payments' }], audit_columns: [{ table: 'payments', columns: ['created_at', 'updated_at'] }] },
  ],
};

export function agentPreset(feature, variant, current = {}) {
  const sample = examples[feature.key][variant];
  const next = { ...current };
  for (const field of feature.fields) {
    if (field.name === 'db_id') continue;
    const value = sample[field.name];
    next[field.name] = feature.parseFields?.includes(field.name) ? JSON.stringify(value) : value;
  }
  return next;
}

export function agentPresetNeedsDatabase(feature) {
  return feature.fields.some((field) => field.name === 'db_id');
}
