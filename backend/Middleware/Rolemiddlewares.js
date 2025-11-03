// middlewares/roleMiddleware.js
module.exports = function requireRole(required) {
  // required can be a string (single role) or array of strings
  const allowed = Array.isArray(required) ? required : [required];

  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
};
