-- Non-destructive, idempotent top-up seed for primary domain tables.
-- Goal: every primary table has >= 15 rows. Never deletes or updates existing rows.
-- Safe to run repeatedly: unique keys use ON CONFLICT DO NOTHING, others use NOT EXISTS guards.

-- ai_results (unique: user_id, feature, cache_key)
INSERT INTO ai_results (user_id, feature, cache_key, result, expires_at, created_at)
SELECT 7, f.feature, 'seed-' || f.feature, jsonb_build_object('seeded', true, 'feature', f.feature), NOW() + interval '30 days', NOW()
FROM (VALUES ('workload-analysis'),('replication-lag'),('storage-cost'),('index-advisor'),('query-optimizer'),('backup-verifier'),('capacity-forecast'),('anomaly-scan'),('cost-optimizer'),('failover-drill'),('schema-evolve'),('connection-pool')) AS f(feature)
ON CONFLICT (user_id, feature, cache_key) DO NOTHING;

-- backup_schedules
INSERT INTO backup_schedules (db_name, frequency, retention_days, enabled, last_run_at, next_run_at, created_by, created_at, updated_at)
SELECT 'seed-db-' || lpad(i::text, 2, '0'),
       (ARRAY['hourly','daily','weekly','monthly'])[1 + (i % 4)],
       7 * (1 + i % 6), true,
       NOW() - (i || ' hours')::interval, NOW() + (i || ' hours')::interval,
       7, NOW(), NOW()
FROM generate_series(1, 15) i
WHERE NOT EXISTS (SELECT 1 FROM backup_schedules b WHERE b.db_name = 'seed-db-' || lpad(i::text, 2, '0'));

-- backup_history (FK -> backup_schedules)
INSERT INTO backup_history (schedule_id, db_name, status, size_mb, duration_seconds, storage_path, started_at, completed_at)
SELECT s.id, s.db_name,
       (ARRAY['success','success','success','failed','running'])[1 + (s.id % 5)],
       round((random() * 5000 + 100)::numeric, 2), 30 + (s.id * 7),
       '/backups/' || s.db_name || '_' || s.id || '.sql.gz',
       NOW() - interval '1 day', NOW() - interval '23 hours'
FROM backup_schedules s
WHERE s.db_name LIKE 'seed-db-%'
  AND NOT EXISTS (SELECT 1 FROM backup_history h WHERE h.schedule_id = s.id)
LIMIT 15;

-- db_logs (FK -> monitored_databases)
INSERT INTO db_logs (database_id, agent, action, status, message, duration_ms, created_at)
SELECT d.id, 'database-admin-agent',
       (ARRAY['health_check','index_analysis','backup_run','vacuum','query_review'])[1 + (row_number() OVER (ORDER BY d.id) % 5)],
       (ARRAY['info','success','warning'])[1 + (row_number() OVER (ORDER BY d.id) % 3)],
       'seed-activity:' || d.name, 120 + (row_number() OVER (ORDER BY d.id) * 13), NOW()
FROM monitored_databases d
WHERE NOT EXISTS (SELECT 1 FROM db_logs l WHERE l.message = 'seed-activity:' || d.name)
  AND (SELECT count(*) FROM db_logs) < 15
LIMIT 15;

-- maintenance_windows
INSERT INTO maintenance_windows (name, cron_expression, duration_minutes, database_names, timezone, enabled, notes, created_by, created_at, updated_at)
SELECT 'seed-window-' || lpad(i::text, 2, '0'),
       (ARRAY['0 2 * * 0','0 3 * * 6','30 1 * * *','0 4 1 * *'])[1 + (i % 4)],
       30 + i * 10, ARRAY['ecommerce_prod','analytics_dw'], 'UTC', true,
       'Routine maintenance window ' || i, 7, NOW(), NOW()
FROM generate_series(1, 15) i
WHERE NOT EXISTS (SELECT 1 FROM maintenance_windows m WHERE m.name = 'seed-window-' || lpad(i::text, 2, '0'));

-- governed_cases (unique: tenant_id, business_key)
INSERT INTO governed_cases (tenant_id, case_kind, business_key, state, payload, safety_flags, version, created_by)
SELECT 'runtime-tenant', 'database_change', 'seed-dbchange-' || lpad(i::text, 3, '0'),
       (ARRAY['proposed','evidence_collected','sandbox_ready','sandbox_passed','approval_pending','approved','executing','verified','rolled_back','failed','closed','proposed','approved','verified','closed'])[i],
       jsonb_build_object('title', 'Governed change case ' || i, 'target', 'ecommerce_prod'),
       '[]'::jsonb, 1, 'runtime-admin@example.com'
FROM generate_series(1, 15) i
ON CONFLICT (tenant_id, business_key) DO NOTHING;

-- governed_evidence (unique: tenant_id, case_id, kind, sha256)
INSERT INTO governed_evidence (tenant_id, case_id, kind, sha256, storage_ref, detector_or_schema_version, metadata, recorded_by)
SELECT 'runtime-tenant', c.id, 'sandbox_log', lpad((10000 + c.id)::text, 64, '0'),
       'vault://evidence/' || c.business_key || '.log', 'schema-v1', '{}'::jsonb, 'runtime-admin@example.com'
FROM governed_cases c
WHERE c.business_key LIKE 'seed-dbchange-%'
ON CONFLICT (tenant_id, case_id, kind, sha256) DO NOTHING;

-- governed_approvals (unique: tenant_id, case_id, target_state, approver_id)
INSERT INTO governed_approvals (tenant_id, case_id, target_state, approver_id, approver_role, reason, decision)
SELECT 'runtime-tenant', c.id, 'approval_pending', 'runtime-admin@example.com', 'admin',
       'Seed approval record for ' || c.business_key,
       CASE WHEN c.id % 5 = 0 THEN 'rejected' ELSE 'approved' END
FROM governed_cases c
WHERE c.business_key LIKE 'seed-dbchange-%'
ON CONFLICT (tenant_id, case_id, target_state, approver_id) DO NOTHING;

-- governed_events (append-only; unique: tenant_id, idempotency_key)
INSERT INTO governed_events (tenant_id, case_id, idempotency_key, event_type, from_state, to_state, actor_id, actor_role, request_hash, detail)
SELECT 'runtime-tenant', c.id, 'seed-evt-' || c.business_key, 'state_transition', 'proposed', c.state,
       'runtime-admin@example.com', 'admin', lpad((20000 + c.id)::text, 64, '0'), '{}'::jsonb
FROM governed_cases c
WHERE c.business_key LIKE 'seed-dbchange-%'
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

-- governed_integration_runs (unique: tenant_id, connector, idempotency_key)
INSERT INTO governed_integration_runs (tenant_id, connector, operation, idempotency_key, credential_ref, status, external_cursor, records_seen, records_applied, started_by, completed_at)
SELECT 'runtime-tenant',
       (ARRAY['database_driver','metrics_tracing','secret_vault','migration_tool','ticketing','backup_system'])[1 + (i % 6)],
       (ARRAY['pull','push','verify'])[1 + (i % 3)],
       'seed-run-' || lpad(i::text, 3, '0'),
       'vault://integrations/connector-' || i, 'succeeded', 'cursor-' || i,
       100 + i * 7, 100 + i * 7, 'runtime-admin@example.com', NOW()
FROM generate_series(1, 15) i
ON CONFLICT (tenant_id, connector, idempotency_key) DO NOTHING;

-- governed_quality_observations (no unique key; guard by evidence_sha256)
INSERT INTO governed_quality_observations (tenant_id, case_id, metric_name, metric_value, sample_size, cohort, evaluator_version, evidence_sha256, observed_at)
SELECT 'runtime-tenant', c.id,
       (ARRAY['lock_impact','load_delta','sandbox_success','rollback_success','recovery_time','recommendation_accuracy'])[1 + (i % 6)],
       round((random() * 100)::numeric, 2), 10 + i, '{}'::jsonb, 'evaluator-v1',
       lpad((30000 + i)::text, 64, '0'), NOW()
FROM generate_series(1, 15) i
JOIN governed_cases c ON c.business_key = 'seed-dbchange-' || lpad(i::text, 3, '0')
WHERE NOT EXISTS (SELECT 1 FROM governed_quality_observations q WHERE q.evidence_sha256 = lpad((30000 + i)::text, 64, '0'));
