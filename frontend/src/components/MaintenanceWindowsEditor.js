import React, { useEffect, useState, useCallback } from 'react';

// NON-VIZ 2: CRUD editor for maintenance windows (cron + DB list).
const empty = {
  name: '', cron_expression: '0 3 * * 0', duration_minutes: 60,
  database_names_csv: '', timezone: 'UTC', enabled: true, notes: '',
};

export default function MaintenanceWindowsEditor() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  }), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/custom-views/maintenance-windows', { headers: headers() });
      const j = await r.json();
      if (j.error) setMsg('Error: ' + j.error);
      else setRows(j.data || []);
    } catch (e) {
      setMsg('Error: ' + e.message);
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setMsg('Saving...');
    const body = {
      name: form.name,
      cron_expression: form.cron_expression,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      database_names: form.database_names_csv.split(',').map(s => s.trim()).filter(Boolean),
      timezone: form.timezone,
      enabled: !!form.enabled,
      notes: form.notes,
    };
    try {
      const url = editId
        ? `/api/custom-views/maintenance-windows/${editId}`
        : '/api/custom-views/maintenance-windows';
      const method = editId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || j.error) { setMsg('Error: ' + (j.error || r.status)); return; }
      setMsg(editId ? 'Updated.' : 'Created.');
      setForm(empty); setEditId(null);
      load();
    } catch (e) {
      setMsg('Error: ' + e.message);
    }
  };

  const edit = (row) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      cron_expression: row.cron_expression,
      duration_minutes: row.duration_minutes,
      database_names_csv: (row.database_names || []).join(', '),
      timezone: row.timezone || 'UTC',
      enabled: !!row.enabled,
      notes: row.notes || '',
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this maintenance window?')) return;
    try {
      const r = await fetch(`/api/custom-views/maintenance-windows/${id}`,
        { method: 'DELETE', headers: headers() });
      const j = await r.json();
      if (!r.ok || j.error) setMsg('Error: ' + (j.error || r.status));
      else { setMsg('Deleted.'); load(); }
    } catch (e) {
      setMsg('Error: ' + e.message);
    }
  };

  const input = {
    background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #0f3460',
    borderRadius: 6, padding: '6px 10px', width: '100%',
  };

  return (
    <div data-testid="mw-editor" style={{
      background: '#16213e', border: '1px solid #0f3460', borderRadius: 10,
      padding: 16, marginBottom: 18,
    }}>
      <div style={{ color: '#e94560', fontWeight: 'bold', marginBottom: 10 }}>
        Maintenance Windows (cron + databases)
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 10, marginBottom: 10,
      }}>
        <div>
          <label style={{ color: '#a0a0b0', fontSize: 12 }}>Name</label>
          <input style={input} value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label style={{ color: '#a0a0b0', fontSize: 12 }}>Cron (5 fields)</label>
          <input style={input} value={form.cron_expression}
            onChange={e => setForm({ ...form, cron_expression: e.target.value })} />
        </div>
        <div>
          <label style={{ color: '#a0a0b0', fontSize: 12 }}>Duration (min)</label>
          <input style={input} type="number" min={5} max={720}
            value={form.duration_minutes}
            onChange={e => setForm({ ...form, duration_minutes: e.target.value })} />
        </div>
        <div>
          <label style={{ color: '#a0a0b0', fontSize: 12 }}>Timezone</label>
          <input style={input} value={form.timezone}
            onChange={e => setForm({ ...form, timezone: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / span 3' }}>
          <label style={{ color: '#a0a0b0', fontSize: 12 }}>Databases (comma-separated)</label>
          <input style={input} value={form.database_names_csv}
            onChange={e => setForm({ ...form, database_names_csv: e.target.value })}
            placeholder="prod_db, analytics_db" />
        </div>
        <div style={{ display: 'flex', alignItems: 'end', gap: 6 }}>
          <label style={{ color: '#a0a0b0', fontSize: 12 }}>
            <input type="checkbox" checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })} />
            {' '}Enabled
          </label>
        </div>
        <div style={{ gridColumn: '1 / span 4' }}>
          <label style={{ color: '#a0a0b0', fontSize: 12 }}>Notes</label>
          <input style={input} value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <button onClick={save}
          style={{ background: '#e94560', color: '#fff', border: 'none',
                   padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
                   fontWeight: 'bold' }}>
          {editId ? 'Update Window' : 'Create Window'}
        </button>
        {editId && (
          <button onClick={() => { setEditId(null); setForm(empty); }}
            style={{ background: 'transparent', color: '#a0a0b0',
                     border: '1px solid #0f3460', padding: '8px 14px',
                     borderRadius: 6, cursor: 'pointer' }}>
            Cancel
          </button>
        )}
        <span style={{ color: '#a0a0b0', fontSize: 12, alignSelf: 'center' }}>{msg}</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e0e0e0', fontSize: 13 }}>
        <thead>
          <tr style={{ color: '#a0a0b0', textAlign: 'left' }}>
            <th style={{ padding: 6 }}>Name</th>
            <th style={{ padding: 6 }}>Cron</th>
            <th style={{ padding: 6 }}>Dur</th>
            <th style={{ padding: 6 }}>Databases</th>
            <th style={{ padding: 6 }}>TZ</th>
            <th style={{ padding: 6 }}>On</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 10, color: '#a0a0b0' }}>
              No maintenance windows yet — create one above.
            </td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid #0f3460' }}>
              <td style={{ padding: 6 }}>{r.name}</td>
              <td style={{ padding: 6, fontFamily: 'monospace' }}>{r.cron_expression}</td>
              <td style={{ padding: 6 }}>{r.duration_minutes}m</td>
              <td style={{ padding: 6 }}>{(r.database_names || []).join(', ') || '—'}</td>
              <td style={{ padding: 6 }}>{r.timezone}</td>
              <td style={{ padding: 6 }}>{r.enabled ? 'yes' : 'no'}</td>
              <td style={{ padding: 6 }}>
                <button onClick={() => edit(r)}
                  style={{ background: 'transparent', color: '#4cc9f0',
                           border: '1px solid #0f3460', padding: '4px 8px',
                           borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>
                  Edit
                </button>
                <button onClick={() => remove(r.id)}
                  style={{ background: 'transparent', color: '#e94560',
                           border: '1px solid #0f3460', padding: '4px 8px',
                           borderRadius: 4, cursor: 'pointer' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
