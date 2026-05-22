const express = require('express');
const router = express.Router();

router.post('/score', (req, res) => {
  const replicas = Number(req.body?.replicas ?? 2);
  const lagSeconds = Number(req.body?.lag_seconds ?? 18);
  const backupAgeHours = Number(req.body?.backup_age_hours ?? 9);
  const lastDrillDays = Number(req.body?.last_drill_days ?? 64);
  const runbookSteps = Number(req.body?.runbook_steps ?? 7);
  const missingSteps = Number(req.body?.missing_steps ?? 2);
  const score = Math.max(0, Math.min(100, Math.round(
    100 - lagSeconds * 1.2 - backupAgeHours * 1.4 - lastDrillDays * 0.35 - missingSteps * 12 + replicas * 4 + runbookSteps
  )));
  res.json({
    readinessScore: score,
    status: score >= 80 ? 'ready' : score >= 60 ? 'needs_drill' : 'at_risk',
    checks: [
      { name: 'Replica coverage', pass: replicas >= 2 },
      { name: 'Replication lag', pass: lagSeconds <= 30 },
      { name: 'Backup freshness', pass: backupAgeHours <= 12 },
      { name: 'Runbook completeness', pass: missingSteps === 0 },
      { name: 'Recent drill', pass: lastDrillDays <= 45 },
    ],
    nextAction: score >= 80 ? 'Schedule a tabletop validation only.' : 'Run a failover exercise and close runbook gaps before the next maintenance window.',
  });
});

module.exports = router;
