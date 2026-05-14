# Audit Apply Notes — AIDatabaseAdminAgent

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_02.md` (lines 877-909).

The audit reports 0 AI endpoints. Inspection shows 12 AI endpoints across
`routes/agents.js` (analyze-query, suggest-indexes, health-check) and
`routes/agentsNew.js` (query-analyze, index-advisor, health-report,
capacity-forecast, lock-analysis, workload-analysis,
connection-pool-optimizer, denormalization-advisor, replication-lag-monitor,
storage-cost-analyzer). Audit metadata is stale.

The project is below the 15-AI-endpoint threshold but already addresses every
audit-suggested gap. Adding more would risk duplication. This pass is
**backlog-only**.

## Original audit recommendations

### Missing AI counterparts (audit, already covered)
- `/optimize-query` — covered by `/analyze-query`, `/query-analyze`.
- `/analyze-slow-queries` — partly covered by `/workload-analysis`.
- `/recommend-indexes` — covered by `/suggest-indexes`, `/index-advisor`.
- `/predict-backup-failure` — not covered.
- `/optimize-schema` — partly covered by `/denormalization-advisor`.
- `/anomaly-detection` — not covered explicitly.
- `/performance-forecasting` — covered by `/capacity-forecast`.

### Missing non-AI features
- Connection pooling / driver management.
- Real-time monitoring/alerting.
- Cloud database integration (RDS, Azure SQL, Cloud SQL).
- Replication/failover management.
- Encryption / security audit.

### Custom feature suggestions
- Query optimization agent (already partly in place).
- Predictive performance modeling (already partly in place).
- Anomaly detection.
- Schema evolution recommendations.
- Cost optimization.

## Implemented in this pass

None. Backlog-only.

## Backlog (prioritized)

### Mechanical, low-risk
1. `/api/agents/predict-backup-failure` — given backup history, predict
   next-failure window.
2. `/api/agents/anomaly-detection` — given metric series, flag anomalies.
3. `/api/agents/security-posture-review` — review schema for missing audit
   columns, weak grants.

### Needs product decision
- Live agent vs. batch-job orchestration model.
- How to surface alerts to end users (UI vs. webhook).

### Needs credentials / external SDK
- AWS RDS / Azure SQL / GCP Cloud SQL clients.
- DB drivers for live metrics (pg_stat_*, MySQL Performance Schema).

### Too risky / large refactor
- Auto-applying optimizations on a live database (correctness, lock risk).
- Replication/failover orchestration.

## Apply pass 3 (frontend)
- **Action:** LEFT-AS-IS. FE already fully wired.
- `frontend/src/services/api.js` exposes all 13 AI endpoints (`analyzeQuery`, `suggestIndexes`, `healthCheck` plus 10 `agents-new/*` methods) using JWT Bearer auth from localStorage.
- `pages/AgentsPage.js` covers the legacy 3 agents; `pages/AgentsNewPage.js` exposes all 10 advanced agents via expandable feature cards.
- Both routes registered in `App.js` (`/agents`, `/agents-new`).
- No frontend changes required this pass.

## Apply pass 4 (mechanical backlog)
- **Action:** LEFT-AS-IS (already done in earlier passes).
- All three mechanical backlog items (`/predict-backup-failure`, `/anomaly-detection`, `/security-posture-review`) are present in `backend/routes/agentsNew.js` (lines 585, 624, 660), all behind the existing OPENROUTER_API_KEY 503 guard at the top of the router (lines 22-31).
- Frontend wiring already complete: `frontend/src/services/api.js` exposes `agentPredictBackupFailure`, `agentAnomalyDetection`, `agentSecurityPostureReview`; `frontend/src/pages/AgentsNewPage.js` renders cards for all three (keys `predict-backup-failure`, `anomaly-detection`, `security-posture-review`).
- No code changes required this pass.
