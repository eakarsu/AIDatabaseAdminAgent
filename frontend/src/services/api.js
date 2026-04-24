const A='http://localhost:3004/api';const h=()=>{const t=localStorage.getItem('token');return{'Content-Type':'application/json',...(t?{Authorization:`Bearer ${t}`}:{})}};
const api={
  login:async(e,p)=>{const r=await fetch(`${A}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});const d=await r.json();if(d.token)localStorage.setItem('token',d.token);return d},
  getStats:()=>fetch(`${A}/stats`,{headers:h()}).then(r=>r.json()),
  getDatabases:()=>fetch(`${A}/databases`,{headers:h()}).then(r=>r.json()),
  createDatabase:(d)=>fetch(`${A}/databases`,{method:'POST',headers:h(),body:JSON.stringify(d)}).then(r=>r.json()),
  updateDatabase:(id,d)=>fetch(`${A}/databases/${id}`,{method:'PUT',headers:h(),body:JSON.stringify(d)}).then(r=>r.json()),
  deleteDatabase:(id)=>fetch(`${A}/databases/${id}`,{method:'DELETE',headers:h()}).then(r=>r.json()),
  getQueries:()=>fetch(`${A}/queries`,{headers:h()}).then(r=>r.json()),
  getIndexes:()=>fetch(`${A}/indexes`,{headers:h()}).then(r=>r.json()),
  getBackups:()=>fetch(`${A}/backups`,{headers:h()}).then(r=>r.json()),
  createBackup:(d)=>fetch(`${A}/backups`,{method:'POST',headers:h(),body:JSON.stringify(d)}).then(r=>r.json()),
  analyzeQuery:(d)=>fetch(`${A}/agents/analyze-query`,{method:'POST',headers:h(),body:JSON.stringify(d)}).then(r=>r.json()),
  suggestIndexes:(d)=>fetch(`${A}/agents/suggest-indexes`,{method:'POST',headers:h(),body:JSON.stringify(d)}).then(r=>r.json()),
  healthCheck:(d)=>fetch(`${A}/agents/health-check`,{method:'POST',headers:h(),body:JSON.stringify(d)}).then(r=>r.json()),
};export default api;
