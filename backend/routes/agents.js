const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const router = express.Router();

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

// 3-strategy JSON parser
function parseAIJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    let extracted = text.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(extracted); } catch {}
    let fixed = extracted
      .replace(/:\s*True\b/g, ': true')
      .replace(/:\s*False\b/g, ': false')
      .replace(/:\s*None\b/g, ': null')
      .replace(/'/g, '"');
    try { return JSON.parse(fixed); } catch {}
    try {
      let repaired = fixed.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '').replace(/,\s*$/, '');
      const opens = (repaired.match(/\{/g) || []).length;
      const closes = (repaired.match(/\}/g) || []).length;
      const openBrk = (repaired.match(/\[/g) || []).length;
      const closeBrk = (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < openBrk - closeBrk; i++) repaired += ']';
      for (let i = 0; i < opens - closes; i++) repaired += '}';
      return JSON.parse(repaired);
    } catch {}
  }
  return { analysis: text };
}

const ai = async (prompt) => {
  const r = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-db-admin-agent.local',
        'X-Title': 'AI Database Admin Agent',
      },
    }
  );
  const c = r.data.choices[0].message.content;
  return parseAIJson(c);
};

router.post('/analyze-query', auth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'query is required and must be a non-empty string' });
    }
    if (query.length > 10000) {
      return res.status(400).json({ error: 'query must be 10000 characters or fewer' });
    }
    const result = await ai(
      `Analyze and optimize this SQL query. Suggest improvements for performance.\n\nQuery: ${query}\n\nRespond in JSON: {"original_query":"string","optimized_query":"string","improvements":[{"type":"string","description":"string","impact":"string"}],"execution_plan_notes":"string","estimated_speedup":"string","index_recommendations":[{"table":"string","column":"string","reason":"string"}]}`
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/suggest-indexes', auth, async (req, res) => {
  try {
    const { table_info } = req.body;
    if (!table_info) return res.status(400).json({ error: 'table_info is required' });
    const result = await ai(
      `Analyze this database table structure and suggest indexes for optimization.\n\nTable info: ${typeof table_info === 'string' ? table_info : JSON.stringify(table_info)}\n\nRespond in JSON: {"suggested_indexes":[{"table":"string","columns":["string"],"type":"string","reason":"string","estimated_impact":"string"}],"current_bottlenecks":["string"],"maintenance_considerations":["string"]}`
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/health-check', auth, async (req, res) => {
  try {
    const { metrics } = req.body;
    if (!metrics) return res.status(400).json({ error: 'metrics is required' });
    const result = await ai(
      `Analyze this database health metrics and provide recommendations.\n\nMetrics: ${typeof metrics === 'string' ? metrics : JSON.stringify(metrics)}\n\nRespond in JSON: {"health_score":number,"status":"string","issues":[{"severity":"string","area":"string","description":"string","recommendation":"string"}],"performance_tips":["string"],"capacity_forecast":"string"}`
    );
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
