import React, { useState } from 'react';
import api from '../services/api';

export default function FailoverDrillPage() {
  const [form, setForm] = useState({ replicas: 2, lag_seconds: 18, backup_age_hours: 9, last_drill_days: 64, runbook_steps: 7, missing_steps: 2 });
  const [result, setResult] = useState(null);
  const update = (key, value) => setForm({ ...form, [key]: Number(value) });
  const run = async () => setResult(await api.failoverDrill(form));

  return (
    <div style={{ padding: 24 }}>
      <h1>Failover Readiness Drill</h1>
      <p>Score replica, backup, lag, and runbook readiness before a database failover.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 20 }}>
        {Object.entries(form).map(([key, value]) => (
          <label key={key} style={{ display: 'grid', gap: 6 }}>
            {key.replaceAll('_', ' ')}
            <input value={value} type="number" onChange={(event) => update(key, event.target.value)} />
          </label>
        ))}
      </div>
      <button onClick={run} style={{ marginTop: 16 }}>Score Drill</button>
      {result && (
        <div style={{ marginTop: 20, padding: 16, background: '#16213e', borderRadius: 8 }}>
          <h2>{result.status}: {result.readinessScore}</h2>
          <p>{result.nextAction}</p>
          {result.checks.map((check) => <div key={check.name}>{check.pass ? 'Pass' : 'Review'} · {check.name}</div>)}
        </div>
      )}
    </div>
  );
}
