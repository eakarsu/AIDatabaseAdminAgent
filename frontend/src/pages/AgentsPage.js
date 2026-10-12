import React, { useState } from 'react';
import api from '../services/api';
import AIReport from '../components/AIReport';

const examples = {
  query: [
    "SELECT customer_id, COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY customer_id;",
    'SELECT id, status FROM invoices WHERE account_id = $1 ORDER BY issued_at DESC LIMIT 50;',
  ],
  index: [
    JSON.stringify({ table: 'orders', columns: ['id', 'customer_id', 'created_at'], row_count: 120000 }),
    JSON.stringify({ table: 'invoices', columns: ['id', 'account_id', 'issued_at'], row_count: 480000 }),
  ],
  health: [
    JSON.stringify({ cpu_usage: 75, memory_usage: 82, disk_usage: 60, connections: 150, slow_queries: 23 }),
    JSON.stringify({ cpu_usage: 32, memory_usage: 58, disk_usage: 78, connections: 47, slow_queries: 2 }),
  ],
};
const tabs = [
  ['query', '🔍 Query Optimizer', 'SQL Query to Optimize', '🔍 Optimize Query'],
  ['index', '📑 Index Advisor', 'Table Information (JSON)', '📑 Suggest Indexes'],
  ['health', '❤️ Health Check', 'Database Metrics (JSON)', '❤️ Health Check'],
];
const calls = { query: (input) => api.analyzeQuery({ query: input }), index: (input) => api.suggestIndexes({ table_info: input }), health: (input) => api.healthCheck({ metrics: input }) };
const inputStyle = { width: '100%', padding: '10px 14px', background: '#1a1a2e', border: '1px solid #0f3460', borderRadius: 8, color: '#e0e0e0', fontSize: 14, marginBottom: 12, minHeight: 100, fontFamily: 'monospace' };
export default function AgentsPage() {
  const [tab, setTab] = useState('query');
  const [inputs, setInputs] = useState({ query: '', index: '', health: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const active = tabs.find(([key]) => key === tab);
  const run = async () => {
    setLoading(true); setResult(null);
    try { setResult(await calls[tab](inputs[tab])); }
    catch (error) { setResult({ error: error.message }); }
    finally { setLoading(false); }
  };
  return <div style={{ padding: 30 }}><h1 style={{ fontSize: 24, color: '#e0e0e0', marginBottom: 24 }}>AI Agents</h1>
    <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>{tabs.map(([key, label]) => <button key={key} type="button" style={{ padding: '10px 20px', background: tab === key ? '#e94560' : '#16213e', color: tab === key ? '#fff' : '#a0a0b0', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }} onClick={() => { setTab(key); setResult(null); }}>{label}</button>)}</div>
    <div style={{ background: '#16213e', borderRadius: 12, padding: 24, border: '1px solid #0f3460' }}>
      <div className="ai-preset-bar"><div><strong>Fill the prompt</strong><p>Review the example before running the agent.</p></div><div className="ai-actions">{['Operations example', 'Review example'].map((label, index) => <button key={label} type="button" className="btn btn-secondary" disabled={loading} onClick={() => { setInputs({ ...inputs, [tab]: examples[tab][index] }); setResult(null); }}>{label}</button>)}</div></div>
      <label htmlFor="agent-input" style={{ color: '#a0a0b0', fontSize: 12 }}>{active[2]}</label><textarea id="agent-input" style={inputStyle} value={inputs[tab]} onChange={(event) => setInputs({ ...inputs, [tab]: event.target.value })} />
      <button type="button" style={{ padding: '12px 24px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }} onClick={run} disabled={loading || !inputs[tab].trim()}>{loading ? '⏳ Analyzing...' : active[3]}</button>
    </div>
    <AIReport response={result} title={active[1]} />
  </div>;
}
