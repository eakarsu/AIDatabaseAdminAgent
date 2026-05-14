import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const items = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/databases', label: 'Databases', icon: '🗄️' },
  { path: '/queries', label: 'Slow Queries', icon: '🔍' },
  { path: '/indexes', label: 'Indexes', icon: '📑' },
  { path: '/backups', label: 'Backups', icon: '💾' },
  { path: '/backup-schedules', label: 'Backup Schedules', icon: '📅' },
  { path: '/agents', label: 'AI Agents', icon: '🤖' },
  { path: '/agents-new', label: 'AI Agents (New)', icon: '✨' },
];

export default function Sidebar() {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <div style={{ width: 250, background: '#16213e', height: '100vh', position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #0f3460' }}>
      <div style={{ padding: 20, fontSize: 18, fontWeight: 'bold', color: '#e94560', borderBottom: '1px solid #0f3460', textAlign: 'center' }}>🗄️ Database Admin Agent</div>
      <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {items.map(i => (
          <div
            key={i.path}
            onClick={() => nav(i.path)}
            style={{
              padding: '12px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: loc.pathname === i.path ? '#0f3460' : 'transparent',
              color: loc.pathname === i.path ? '#e94560' : '#a0a0b0',
              borderLeft: loc.pathname === i.path ? '3px solid #e94560' : '3px solid transparent',
              fontSize: 14,
            }}
          >
            <span>{i.icon}</span>{i.label}
          </div>
        ))}
      </div>
      <div
        style={{ padding: '15px 20px', borderTop: '1px solid #0f3460', cursor: 'pointer', color: '#e94560', textAlign: 'center', fontSize: 14 }}
        onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
      >🚪 Logout</div>
    </div>
  );
}
