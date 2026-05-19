import React from 'react';
import QueryPerformanceChart from '../components/QueryPerformanceChart';
import SlowQueryHeatmap from '../components/SlowQueryHeatmap';
import BackupRestoreRunbook from '../components/BackupRestoreRunbook';
import MaintenanceWindowsEditor from '../components/MaintenanceWindowsEditor';

export default function CustomViewsPage() {
  return (
    <div style={{ padding: 24, background: '#1a1a2e', minHeight: '100vh' }}>
      <h1 style={{ color: '#e94560', marginTop: 0 }}>DBA Views</h1>
      <p style={{ color: '#a0a0b0', marginTop: 0, marginBottom: 20 }}>
        Custom database-administration views: latency trends, slow-query hotspots,
        backup/restore runbook, and maintenance-window scheduling.
      </p>
      <QueryPerformanceChart />
      <SlowQueryHeatmap />
      <BackupRestoreRunbook />
      <MaintenanceWindowsEditor />
    </div>
  );
}
