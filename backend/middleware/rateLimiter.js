const rateLimit = require('express-rate-limit');
let ipKeyGenerator;
try { ({ ipKeyGenerator } = require('express-rate-limit')); } catch (_) {}

const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => {
    if (req.user) return `user:${req.user.id}`;
    return ipKeyGenerator ? ipKeyGenerator(req) : req.ip;
  },
  message: { error: 'AI rate limit exceeded. Max 20 requests/hour.' }
});

module.exports = { aiRateLimiter };
