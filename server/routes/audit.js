const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/audit - list audit trail logs
router.get('/', (req, res) => {
  const { action, entity_type, limit = 100 } = req.query;

  try {
    let sql = `
      SELECT a.*, u.full_name as user_full_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action && action !== 'all') {
      sql += ` AND a.action = ?`;
      params.push(action);
    }

    if (entity_type && entity_type !== 'all') {
      sql += ` AND a.entity_type = ?`;
      params.push(entity_type);
    }

    sql += ` ORDER BY a.id DESC LIMIT ?`;
    params.push(Number(limit) || 100);

    const logs = db.prepare(sql).all(...params);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs' });
  }
});

module.exports = router;

