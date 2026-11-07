/**
 * Authentication Middleware
 */
const { db } = require('../db');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const session = db.prepare(`
      SELECT s.*, u.id as user_id, u.username, u.full_name, u.email, u.role, u.status
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
    }

    if (session.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is inactive. Contact the practice owner.' });
    }

    req.user = {
      id: session.user_id,
      username: session.username,
      fullName: session.full_name,
      email: session.email,
      role: session.role
    };
    req.token = token;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, message: 'Server authentication error.' });
  }
}

/**
 * Role-based authorization guard
 * @param {string[]} allowedRoles
 */
function requireRole(allowedRoles = ['admin']) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to perform this action.'
      });
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  requireRole
};

