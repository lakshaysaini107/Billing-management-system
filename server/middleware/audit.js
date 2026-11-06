/**
 * Audit Logging Helper
 */
const { db } = require('../db');

function logAudit(req, action, entityType, entityId, details) {
  try {
    const userId = req && req.user ? req.user.id : null;
    const username = req && req.user ? req.user.username : 'system';
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(userId, username, action, entityType, String(entityId || ''), detailsStr, ipAddress);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

module.exports = { logAudit };
