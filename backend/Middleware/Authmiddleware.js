// middlewares/authMiddleware.js
const { verifyToken } = require("../Utils/Jwt");

module.exports = function (req, res, next) {
  if (!req.headers || !req.headers.authorization) {
    return res.status(401).json({ error: "Authorization header missing" });
  }
  const authHeader = req.headers.authorization;

  // ...existing code...

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Invalid Authorization format" });

  const token = parts[1];
  try {
    const payload = verifyToken(token);
    req.user = payload; // { user_id, role, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
