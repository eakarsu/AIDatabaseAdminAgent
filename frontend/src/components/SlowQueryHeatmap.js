import React, { useEffect, useState } from 'react';

// VIZ 2: Slow-query heatmap (query template x hour-of-day).
export default function SlowQueryHeatmap() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/slow-query-heatmap', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => { if (alive) { if (j.error) setErr(j.error); else setData(j); } })
      .catch(e => alive && setErr(String(e)));
    return () => { alive = false; };
  }, []);

  if (err) return <div style={{ color: '#e94560' }}>Error: {err}</div>;
  if (!data) return <div style={{ color: '#a0a0b0' }}>Loading heatmap...</div>;

  const cellAt = (q, h) =>
    data.cells.find(c => c.query === q && c.hour === h) || { count: 0 };

  const color = (v) => {
    const t = v / Math.max(1, data.max);
    // dark blue → bright red
    const r = Math.round(15 + t * 219);
    const g = Math.round(52 + t * 17);
    const b = Math.round(96 - t * 50);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div data-testid="slow-query-heatmap" style={{
      background: '#16213e', border: '1px solid #0f3460', borderRadius: 10,
      padding: 16, marginBottom: 18, overflowX: 'auto',
    }}>
      <div style={{ color: '#e94560', fontWeight: 'bold', marginBottom: 10 }}>
        Slow-Query Heatmap (template × hour)
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, color: '#e0e0e0' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: '#a0a0b0' }}>Query Template</th>
            {data.hours.map(h => (
              <th key={h} style={{ padding: '4px 4px', color: '#a0a0b0', fontWeight: 'normal', minWidth: 22 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.queries.map(q => (
            <tr key={q}>
              <td style={{
                padding: '4px 6px', maxWidth: 320, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', color: '#cfd7e6',
              }}>{q}</td>
              {data.hours.map(h => {
                const c = cellAt(q, h);
                return (
                  <td key={h} title={`${q} @ ${h}:00 — ${c.count} hits`}
                    style={{
                      background: color(c.count),
                      width: 22, height: 22, textAlign: 'center',
                      border: '1px solid #0a1933', color: '#fff', fontSize: 10,
                    }}>
                    {c.count}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 12, color: '#a0a0b0' }}>
        Peak hits: {data.max}. Darker = idle, brighter = busier.
      </div>
    </div>
  );
}
