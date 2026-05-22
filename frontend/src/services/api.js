const A = 'http://localhost:3004/api';
const h = () => {
  const t = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};
const j = (r) => r.json();

// Helpers that handle paginated {data,pagination} response shape
const paged = async (url) => {
  const r = await fetch(url, { headers: h() }).then(j);
  if (r && Array.isArray(r.data)) return r.data;
  return Array.isArray(r) ? r : [];
};
const pagedFull = async (url) => {
  const r = await fetch(url, { headers: h() }).then(j);
  if (r && Array.isArray(r.data)) return r;
  return { data: Array.isArray(r) ? r : [], pagination: null };
};

const api = {
  login: async (e, p) => {
    const r = await fetch(`${A}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password: p }),
    });
    const d = await r.json();
    if (d.token) localStorage.setItem('token', d.token);
    return d;
  },
  getStats: () => fetch(`${A}/stats`, { headers: h() }).then(j),
  getDatabases: (page = 1, limit = 100) => paged(`${A}/databases?page=${page}&limit=${limit}`),
  getDatabasesPage: (page = 1, limit = 25) => pagedFull(`${A}/databases?page=${page}&limit=${limit}`),
  createDatabase: (d) => fetch(`${A}/databases`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  updateDatabase: (id, d) => fetch(`${A}/databases/${id}`, { method: 'PUT', headers: h(), body: JSON.stringify(d) }).then(j),
  deleteDatabase: (id) => fetch(`${A}/databases/${id}`, { method: 'DELETE', headers: h() }).then(j),
  getQueries: (page = 1, limit = 200) => paged(`${A}/queries?page=${page}&limit=${limit}`),
  getQueriesPage: (page = 1, limit = 50) => pagedFull(`${A}/queries?page=${page}&limit=${limit}`),
  getIndexes: (page = 1, limit = 100) => paged(`${A}/indexes?page=${page}&limit=${limit}`),
  getIndexesPage: (page = 1, limit = 25) => pagedFull(`${A}/indexes?page=${page}&limit=${limit}`),
  getBackups: (page = 1, limit = 100) => paged(`${A}/backups?page=${page}&limit=${limit}`),
  getBackupsPage: (page = 1, limit = 25) => pagedFull(`${A}/backups?page=${page}&limit=${limit}`),
  createBackup: (d) => fetch(`${A}/backups`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),

  // Existing 3 minified AI agent endpoints
  analyzeQuery: (d) => fetch(`${A}/agents/analyze-query`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  suggestIndexes: (d) => fetch(`${A}/agents/suggest-indexes`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  healthCheck: (d) => fetch(`${A}/agents/health-check`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),

  // New full-implementation AI agent endpoints
  agentQueryAnalyze: (d) => fetch(`${A}/agents-new/query-analyze`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentIndexAdvisor: (d) => fetch(`${A}/agents-new/index-advisor`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentHealthReport: (d) => fetch(`${A}/agents-new/health-report`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentCapacityForecast: (d) => fetch(`${A}/agents-new/capacity-forecast`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentLockAnalysis: (d) => fetch(`${A}/agents-new/lock-analysis`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentWorkloadAnalysis: (d) => fetch(`${A}/agents-new/workload-analysis`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentPoolOptimizer: (d) => fetch(`${A}/agents-new/connection-pool-optimizer`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentDenormalization: (d) => fetch(`${A}/agents-new/denormalization-advisor`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentReplicationLag: (d) => fetch(`${A}/agents-new/replication-lag-monitor`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentStorageCost: (d) => fetch(`${A}/agents-new/storage-cost-analyzer`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentPredictBackupFailure: (d) => fetch(`${A}/agents-new/predict-backup-failure`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentAnomalyDetection: (d) => fetch(`${A}/agents-new/anomaly-detection`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  agentSecurityPostureReview: (d) => fetch(`${A}/agents-new/security-posture-review`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),

  // Backup scheduling
  createBackupSchedule: (d) => fetch(`${A}/backup-new/schedule`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
  getBackupSchedules: () => paged(`${A}/backup-new/schedules`),
  getBackupHistory: () => paged(`${A}/backup-new/history`),
  failoverDrill: (d) => fetch(`${A}/failover-drill/score`, { method: 'POST', headers: h(), body: JSON.stringify(d) }).then(j),
};

export default api;
