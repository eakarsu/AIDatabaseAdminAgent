const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });
module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ error: 'Authentication is not configured' });
    req.user = jwt.verify(token, process.env.JWT_SECRET); next();
  }
  catch (err) { res.status(401).json({ error: 'Invalid token' }); }
};
