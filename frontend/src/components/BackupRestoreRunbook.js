import React, { useState } from 'react';

// NON-VIZ 1: Download backup/restore runbook PDF.
export default function BackupRestoreRunbook() {
  const [db, setDb] = useState('production_db');
  const [status, setStatus] = useState('');

  const download = async () => {
    setStatus('Generating PDF...');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(
        `/api/custom-views/backup-restore-runbook?db=${encodeURIComponent(db)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_restore_runbook_${db}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('Downloaded.');
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  return (
    <div data-testid="runbook-pdf" style={{
      background: '#16213e', border: '1px solid #0f3460', borderRadius: 10,
      padding: 16, marginBottom: 18,
    }}>
      <div style={{ color: '#e94560', fontWeight: 'bold', marginBottom: 10 }}>
        Backup / Restore Runbook (PDF)
      </div>
      <p style={{ color: '#a0a0b0', fontSize: 13, marginTop: 0 }}>
        Generates a printable, signature-ready runbook covering pre-checks,
        <code> pg_basebackup</code>, point-in-time restore, verification, rollback,
        and sign-off.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: '#a0a0b0', fontSize: 13 }}>Database:</label>
        <input
          value={db}
          onChange={e => setDb(e.target.value)}
          style={{
            background: '#1a1a2e', color: '#e0e0e0',
            border: '1px solid #0f3460', borderRadius: 6, padding: '6px 10px',
            minWidth: 220,
          }}
        />
        <button
          onClick={download}
          style={{
            background: '#e94560', color: '#fff', border: 'none',
            padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >Download PDF</button>
        <span style={{ color: '#a0a0b0', fontSize: 12 }}>{status}</span>
      </div>
    </div>
  );
}
