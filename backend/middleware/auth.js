const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });
module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123'); next(); }
  catch (err) { res.status(401).json({ error: 'Invalid token' }); }
};
