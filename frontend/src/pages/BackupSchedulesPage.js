import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function BackupSchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('schedules');
  const [form, setForm] = useState({ db_name: '', frequency: 'daily', retention_days: 30 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);
  const load = () => {
    api.getBackupSchedules().then(setSchedules).catch(e => console.error(e));
    api.getBackupHistory().then(setHistory).catch(e => console.error(e));
  };

  const submit = async (e) => {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      const r = await api.createBackupSchedule({ ...form, retention_days: parseInt(form.retention_days) });
      if (r.error) throw new Error(r.error);
      setForm({ db_name: '', frequency: 'daily', retention_days: 30 });
      load();
    } catch (err) { setError(err.message); } finally { setCreating(false); }
  };

  const inp = { width: '100%', padding: '10px 12px', background: '#1a1a2e', border: '1px solid #0f3460', borderRadius: 6, color: '#e0e0e0', fontSize: 13, marginBottom: 10, outline: 'none' };
  const th = { padding: '12px 16px', textAlign: 'left', background: '#0f3460', color: '#a0a0b0', fontSize: 12, textTransform: 'uppercase' };
  const td = { padding: '10px 16px', borderBottom: '1px solid #0f346030', fontSize: 13, color: '#e0e0e0' };

  const stColor = (s) => s === 'success' ? '#2ecc71' : s === 'failed' ? '#e94560' : s === 'running' ? '#3498db' : '#f39c12';

  return (
    <div style={{ padding: 30 }}>
      <h1 style={{ fontSize: 24, color: '#e0e0e0', marginBottom: 16 }}>💾 Backup Scheduling</h1>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[['schedules', '📅 Schedules'], ['create', '➕ Create Schedule'], ['history', '📜 History']].map(([k, l]) => (
          <button key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '10px 18px',
              background: tab === k ? '#e94560' : '#16213e',
              color: tab === k ? '#fff' : '#a0a0b0',
              border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
              fontWeight: tab === k ? 'bold' : 'normal', fontSize: 13,
            }}>{l}</button>
        ))}
      </div>

      {tab === 'create' && (
        <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 12, padding: 20, maxWidth: 500 }}>
          <h3 style={{ color: '#e0e0e0', marginBottom: 16, fontSize: 16 }}>New Backup Schedule</h3>
          <form onSubmit={submit}>
            <label style={{ color: '#a0a0b0', fontSize: 11, display: 'block', marginBottom: 4 }}>Database Name *</label>
            <input style={inp} required value={form.db_name} onChange={e => setForm({ ...form, db_name: e.target.value })} placeholder="production_db" />

            <label style={{ color: '#a0a0b0', fontSize: 11, display: 'block', marginBottom: 4 }}>Frequency *</label>
            <select style={inp} value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>

            <label style={{ color: '#a0a0b0', fontSize: 11, display: 'block', marginBottom: 4 }}>Retention Days (1-365)</label>
            <input style={inp} type="number" min="1" max="365" value={form.retention_days} onChange={e => setForm({ ...form, retention_days: e.target.value })} />

            <button type="submit" disabled={creating} style={{ padding: '10px 20px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Creating...' : 'Create Schedule'}
            </button>

            {error && <div style={{ marginTop: 10, color: '#e94560', fontSize: 12 }}>{error}</div>}
          </form>
        </div>
      )}

      {tab === 'schedules' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16213e', borderRadius: 12, overflow: 'hidden' }}>
          <thead><tr>{['Database', 'Frequency', 'Retention', 'Enabled', 'Next Run', 'Last Run', 'Created'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {schedules.length === 0 && <tr><td colSpan="7" style={{ ...td, textAlign: 'center', color: '#a0a0b0' }}>No schedules yet.</td></tr>}
            {schedules.map(s => (
              <tr key={s.id}>
                <td style={td}><strong>{s.db_name}</strong></td>
                <td style={td}>{s.frequency}</td>
                <td style={td}>{s.retention_days}d</td>
                <td style={td}><span style={{ color: s.enabled ? '#2ecc71' : '#e94560' }}>{s.enabled ? 'Yes' : 'No'}</span></td>
                <td style={td}>{s.next_run_at ? new Date(s.next_run_at).toLocaleString() : '-'}</td>
                <td style={td}>{s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never'}</td>
                <td style={td}>{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'history' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16213e', borderRadius: 12, overflow: 'hidden' }}>
          <thead><tr>{['Database', 'Status', 'Size (MB)', 'Duration (s)', 'Started', 'Completed', 'Error'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan="7" style={{ ...td, textAlign: 'center', color: '#a0a0b0' }}>No backup history yet.</td></tr>}
            {history.map(h => (
              <tr key={h.id}>
                <td style={td}>{h.db_name}</td>
                <td style={td}><span style={{ color: stColor(h.status), fontWeight: 'bold' }}>{h.status}</span></td>
                <td style={td}>{h.size_mb || '-'}</td>
                <td style={td}>{h.duration_seconds || '-'}</td>
                <td style={td}>{new Date(h.started_at).toLocaleString()}</td>
                <td style={td}>{h.completed_at ? new Date(h.completed_at).toLocaleString() : '-'}</td>
                <td style={td}>{h.error_message ? <span style={{ color: '#e94560' }}>{h.error_message}</span> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
