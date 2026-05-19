import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DatabasesPage from './pages/DatabasesPage';
import QueriesPage from './pages/QueriesPage';
import IndexesPage from './pages/IndexesPage';
import BackupsPage from './pages/BackupsPage';
import AgentsPage from './pages/AgentsPage';
import AgentsNewPage from './pages/AgentsNewPage';
import BackupSchedulesPage from './pages/BackupSchedulesPage';
import CustomViewsPage from './pages/CustomViewsPage';

// // === Batch 02 Gaps & Frontend Mounts ===
import CfQueryOptimizationAgent from './pages/CfQueryOptimizationAgent';
import CfPredictivePerformanceModeling from './pages/CfPredictivePerformanceModeling';
import CfAnomalyDetectionForDatabaseHealth from './pages/CfAnomalyDetectionForDatabaseHealth';
import CfSchemaEvolutionRecommendations from './pages/CfSchemaEvolutionRecommendations';
import CfCostOptimization from './pages/CfCostOptimization';
import GapMissingOptimizeQueryAnalyzeSlowQueriesRecommendIndexe from './pages/GapMissingOptimizeQueryAnalyzeSlowQueriesRecommendIndexe';
import GapNoConnectionPoolingOrDriverManagementModule from './pages/GapNoConnectionPoolingOrDriverManagementModule';
import GapNoRealTimeMonitoringAlertingBeyondStubs from './pages/GapNoRealTimeMonitoringAlertingBeyondStubs';
import GapLimitedCloudDbIntegrationsNoAwsRdsAzureSqlGcpCloud from './pages/GapLimitedCloudDbIntegrationsNoAwsRdsAzureSqlGcpCloud';
import GapNoReplicationFailoverManagement from './pages/GapNoReplicationFailoverManagement';
import GapNoEncryptionOrSecurityAuditModule from './pages/GapNoEncryptionOrSecurityAuditModule';
import GapNoNotificationSystem from './pages/GapNoNotificationSystem';

export default function App() {
  const [auth, setAuth] = useState(!!localStorage.getItem('token'));
  if (!auth) return <LoginPage onLogin={() => setAuth(true)} />;
  return (
    <BrowserRouter>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div style={{ marginLeft: 250, flex: 1, minHeight: '100vh' }}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/databases" element={<DatabasesPage />} />
            <Route path="/queries" element={<QueriesPage />} />
            <Route path="/indexes" element={<IndexesPage />} />
            <Route path="/backups" element={<BackupsPage />} />
            <Route path="/backup-schedules" element={<BackupSchedulesPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents-new" element={<AgentsNewPage />} />
            <Route path="/custom-views" element={<CustomViewsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          
        {/* // === Batch 02 Gaps & Frontend Mounts === */}
        <Route path="/cf/query-optimization-agent" element={<CfQueryOptimizationAgent />} />
        <Route path="/cf/predictive-performance-modeling" element={<CfPredictivePerformanceModeling />} />
        <Route path="/cf/anomaly-detection-for-database-health" element={<CfAnomalyDetectionForDatabaseHealth />} />
        <Route path="/cf/schema-evolution-recommendations" element={<CfSchemaEvolutionRecommendations />} />
        <Route path="/cf/cost-optimization" element={<CfCostOptimization />} />
        <Route path="/gap/missing-optimize-query-analyze-slow-queries-recommend-indexe" element={<GapMissingOptimizeQueryAnalyzeSlowQueriesRecommendIndexe />} />
        <Route path="/gap/no-connection-pooling-or-driver-management-module" element={<GapNoConnectionPoolingOrDriverManagementModule />} />
        <Route path="/gap/no-real-time-monitoring-alerting-beyond-stubs" element={<GapNoRealTimeMonitoringAlertingBeyondStubs />} />
        <Route path="/gap/limited-cloud-db-integrations-no-aws-rds-azure-sql-gcp-cloud" element={<GapLimitedCloudDbIntegrationsNoAwsRdsAzureSqlGcpCloud />} />
        <Route path="/gap/no-replication-failover-management" element={<GapNoReplicationFailoverManagement />} />
        <Route path="/gap/no-encryption-or-security-audit-module" element={<GapNoEncryptionOrSecurityAuditModule />} />
        <Route path="/gap/no-notification-system" element={<GapNoNotificationSystem />} />
      </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
