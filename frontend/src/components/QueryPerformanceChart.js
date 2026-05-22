import React, { useEffect, useState } from 'react';

// VIZ 1: SVG line chart of avg / p95 / p99 query latency over time.
export default function QueryPerformanceChart() {
  const [data, setData] = useState(null);
  const [hours, setHours] = useState(24);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    fetch(`/api/custom-views/query-performance?hours=${hours}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => { if (alive) { if (j.error) setErr(j.error); else setData(j); } })
      .catch(e => alive && setErr(String(e)));
    return () => { alive = false; };
  }, [hours]);

  if (err) return <div style={{ color: '#e94560' }}>Error: {err}</div>;
  if (!data) return <div style={{ color: '#a0a0b0' }}>Loading query performance...</div>;

  const series = data.series;
  const w = 720, h = 260, pad = 40;
  const all = series.flatMap(p => [p.avg_ms, p.p95_ms, p.p99_ms]);
  const max = Math.max(1, ...all);
  const x = (i) => pad + (i / Math.max(1, series.length - 1)) * (w - 2 * pad);
  const y = (v) => h - pad - (v / max) * (h - 2 * pad);

  const buildPath = (key) =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');

  const colors = { avg_ms: '#4cc9f0', p95_ms: '#f59e0b', p99_ms: '#e94560' };

  return (
    <div data-testid="query-perf-chart" style={{
      background: '#16213e', border: '1px solid #0f3460', borderRadius: 10,
      padding: 16, marginBottom: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ color: '#e94560', fontWeight: 'bold' }}>Query Performance (avg / p95 / p99 ms)</div>
        <div>
          <label style={{ color: '#a0a0b0', fontSize: 12, marginRight: 6 }}>Window:</label>
          <select
            value={hours}
            onChange={e => setHours(parseInt(e.target.value))}
            style={{ background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #0f3460', borderRadius: 6, padding: '4px 8px' }}
          >
            <option value={12}>12h</option>
            <option value={24}>24h</option>
            <option value={48}>48h</option>
            <option value={72}>72h</option>
          </select>
        </div>
      </div>
      <svg width={w} height={h} role="img" aria-label="query performance line chart" style={{ display: 'block', maxWidth: '100%' }}>
        <rect x={0} y={0} width={w} height={h} fill="#1a1a2e" />
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1={pad} x2={w - pad}
            y1={h - pad - f * (h - 2 * pad)} y2={h - pad - f * (h - 2 * pad)}
            stroke="#0f3460" strokeDasharray="3 4" />
        ))}
        {['avg_ms', 'p95_ms', 'p99_ms'].map(k => (
          <path key={k} d={buildPath(k)} fill="none" stroke={colors[k]} strokeWidth={2} />
        ))}
        <text x={pad} y={h - 8} fill="#a0a0b0" fontSize="11">{series[0]?.hour_label}</text>
        <text x={w - pad - 28} y={h - 8} fill="#a0a0b0" fontSize="11">{series[series.length - 1]?.hour_label}</text>
        <text x={6} y={pad} fill="#a0a0b0" fontSize="11">{max.toFixed(0)}ms</text>
      </svg>
      <div style={{ marginTop: 6, display: 'flex', gap: 14, fontSize: 12, color: '#a0a0b0' }}>
        <span><span style={{ color: colors.avg_ms }}>●</span> avg</span>
        <span><span style={{ color: colors.p95_ms }}>●</span> p95</span>
        <span><span style={{ color: colors.p99_ms }}>●</span> p99</span>
        <span style={{ marginLeft: 'auto' }}>databases observed: {data.databases_observed}</span>
      </div>
    </div>
  );
}
