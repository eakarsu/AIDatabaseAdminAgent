import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const finishLogin = (data) => {
    if (!data.token) throw new Error(data.error || 'Login failed');
    localStorage.setItem('token', data.token);
    onLogin(data);
  };
  const request = async (url, body) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      finishLogin(data);
    } catch (failure) { setError(failure.message || 'Connection failed'); }
    finally { setLoading(false); }
  };
  const s = { container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }, card: { background: '#16213e', padding: 40, borderRadius: 16, width: 400, border: '1px solid #0f3460', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }, input: { width: '100%', padding: '12px 16px', background: '#1a1a2e', border: '1px solid #0f3460', borderRadius: 8, color: '#e0e0e0', fontSize: 14, marginBottom: 16, outline: 'none' }, btn: { width: '100%', padding: 12, background: '#e94560', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer', fontWeight: 'bold', marginBottom: 12 }, demo: { width: '100%', padding: 10, background: 'transparent', color: '#dce6fa', border: '1px dashed #8ca7d3', borderRadius: 8, fontSize: 13, cursor: 'pointer' } };
  return <div style={s.container}><div style={s.card}>
    <div style={{ textAlign: 'center', color: '#e94560', fontSize: 28, marginBottom: 8 }}>🗄️ Database Admin Agent</div>
    <div style={{ textAlign: 'center', color: '#a0a0b0', fontSize: 14, marginBottom: 30 }}>AI-Powered Database Administration</div>
    {error && <div role="alert" style={{ background: '#e9456020', color: '#e94560', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13, textAlign: 'center' }}>{error}</div>}
    <form onSubmit={(event) => { event.preventDefault(); request('/api/auth/login', { email, password }); }}>
      <input style={s.input} type="email" aria-label="Email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <input style={s.input} type="password" aria-label="Password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Sign In'}</button>
    </form>
    <button type="button" style={s.demo} disabled={loading} onClick={() => request('/api/auth/demo-login')}>🔑 Log In as Demo</button>
  </div></div>;
}
