const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

router.use(authMiddleware);

// GET /api/services - list all services
router.get('/', (req, res) => {
  const { active_only } = req.query;
  try {
    let sql = 'SELECT * FROM services';
    if (active_only === 'true') {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY code ASC';

    const services = db.prepare(sql).all();
    res.json({ success: true, count: services.length, services });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve services' });
  }
});

// GET /api/services/:id - single service
router.get('/:id', (req, res) => {
  try {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, service });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve service' });
  }
});

// POST /api/services - create service
router.post('/', (req, res) => {
  const { code, name, sac_code, description, default_fee, default_tax_rate } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Service name is required.' });
  }

  try {
    let serviceCode = code ? code.trim().toUpperCase() : '';
    if (!serviceCode) {
      const lastService = db.prepare('SELECT id FROM services ORDER BY id DESC LIMIT 1').get();
      const nextId = lastService ? lastService.id + 1 : 1;
      serviceCode = `PCS-SRV-${String(nextId).padStart(2, '0')}`;
    }

    // Check code unique
    const existing = db.prepare('SELECT id FROM services WHERE code = ?').get(serviceCode);
    if (existing) {
      return res.status(400).json({ success: false, message: `Service with code "${serviceCode}" already exists.` });
    }

    const stmt = db.prepare(`
      INSERT INTO services (code, name, sac_code, description, default_fee, default_tax_rate, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      serviceCode, name.trim(), sac_code || '998242',
      description || '', Number(default_fee) || 0, Number(default_tax_rate) !== undefined ? Number(default_tax_rate) : 18
    );

    const newId = Number(result.lastInsertRowid);
    logAudit(req, 'SERVICE_CREATE', 'service', newId, `Created service "${name}" (${serviceCode})`);

    res.status(201).json({
      success: true,
      message: 'Service added to catalogue successfully',
      service_id: newId,
      code: serviceCode
    });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ success: false, message: 'Failed to create service' });
  }
});

// PUT /api/services/:id - update service
router.put('/:id', (req, res) => {
  const { name, sac_code, description, default_fee, default_tax_rate, is_active } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Service name is required.' });
  }

  try {
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    db.prepare(`
      UPDATE services SET
        name = ?, sac_code = ?, description = ?, default_fee = ?,
        default_tax_rate = ?, is_active = ?
      WHERE id = ?
    `).run(
      name.trim(), sac_code || '998242', description || '',
      Number(default_fee) || 0, Number(default_tax_rate) || 18,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      req.params.id
    );

    logAudit(req, 'SERVICE_UPDATE', 'service', req.params.id, `Updated service "${name}"`);
    res.json({ success: true, message: 'Service updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update service' });
  }
});

// POST /api/services/:id/toggle - activate/deactivate
router.post('/:id/toggle', (req, res) => {
  try {
    const service = db.prepare('SELECT id, name, is_active FROM services WHERE id = ?').get(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const newActive = service.is_active ? 0 : 1;
    db.prepare('UPDATE services SET is_active = ? WHERE id = ?').run(newActive, service.id);

    logAudit(req, 'SERVICE_TOGGLE', 'service', service.id, `Set service active=${newActive}`);
    res.json({ success: true, is_active: newActive });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle service' });
  }
});

module.exports = router;
