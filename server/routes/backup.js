const express = require('express');
const router = express.Router();
const path = require('node:path');
const fs = require('node:fs');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

router.use(authMiddleware);

// GET /api/backup/export-json - full database export in JSON
router.get('/export-json', requireRole(['admin', 'owner']), (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM clients').all();
    const services = db.prepare('SELECT * FROM services').all();
    const invoices = db.prepare('SELECT * FROM invoices').all();
    const invoice_items = db.prepare('SELECT * FROM invoice_items').all();
    const payments = db.prepare('SELECT * FROM payments').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const audit_logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all();

    const backupPayload = {
      system: 'RSaini & Associates Practice Management',
      version: '1.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user.username,
      data: {
        settings,
        clients,
        services,
        invoices,
        invoice_items,
        payments,
        audit_logs
      }
    };

    logAudit(req, 'BACKUP_EXPORT', 'system', '0', `Full JSON database backup downloaded by ${req.user.username}`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="RSA_Backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, message: 'Failed to create backup export' });
  }
});

// GET /api/backup/download-db - direct SQLite file download
router.get('/download-db', requireRole(['admin', 'owner']), (req, res) => {
  try {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'rsa_billing.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Database file not found.' });
    }

    logAudit(req, 'BACKUP_DB_DOWNLOAD', 'system', '0', `Raw SQLite database downloaded by ${req.user.username}`);

    res.download(dbPath, `RSA_Database_${new Date().toISOString().split('T')[0]}.db`);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to download database' });
  }
});

// POST /api/backup/restore-json - restore database from JSON backup file
router.post('/restore-json', requireRole(['admin', 'owner']), (req, res) => {
  const { data, system } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid backup file structure.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    // Restore settings
    if (Array.isArray(data.settings)) {
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const s of data.settings) {
        stmt.run(s.key, s.value);
      }
    }

    // Restore clients
    if (Array.isArray(data.clients)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO clients (
          id, client_code, legal_name, entity_type, cin_llpin, gstin, pan,
          address, city, state, state_code, pincode, contact_person, designation, phone, email, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.clients) {
        stmt.run(
          c.id, c.client_code, c.legal_name, c.entity_type, c.cin_llpin, c.gstin, c.pan,
          c.address, c.city, c.state, c.state_code, c.pincode, c.contact_person, c.designation,
          c.phone, c.email, c.status, c.notes, c.created_at, c.updated_at
        );
      }
    }

    // Restore services
    if (Array.isArray(data.services)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO services (
          id, code, name, sac_code, description, default_fee, default_tax_rate, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.services) {
        stmt.run(s.id, s.code, s.name, s.sac_code, s.description, s.default_fee, s.default_tax_rate, s.is_active, s.created_at);
      }
    }

    // Restore invoices
    if (Array.isArray(data.invoices)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO invoices (
          id, invoice_number, financial_year, sequence_number, client_id, invoice_date, due_date,
          status, place_of_supply, supply_type, subtotal, discount_type, discount_value, discount_amount,
          taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
          total_tax, round_off, grand_total, paid_amount, balance_amount, notes, terms,
          issued_at, issued_by, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const i of data.invoices) {
        stmt.run(
          i.id, i.invoice_number, i.financial_year, i.sequence_number, i.client_id, i.invoice_date, i.due_date,
          i.status, i.place_of_supply, i.supply_type, i.subtotal, i.discount_type, i.discount_value, i.discount_amount,
          i.taxable_amount, i.cgst_rate, i.cgst_amount, i.sgst_rate, i.sgst_amount, i.igst_rate, i.igst_amount,
          i.total_tax, i.round_off, i.grand_total, i.paid_amount, i.balance_amount, i.notes, i.terms,
          i.issued_at, i.issued_by, i.cancelled_at, i.cancelled_by, i.cancellation_reason, i.created_at, i.updated_at
        );
      }
    }

    // Restore invoice_items
    if (Array.isArray(data.invoice_items)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO invoice_items (
          id, invoice_id, service_id, service_code, item_name, sac_code, description,
          quantity, rate, discount_percent, taxable_value, tax_rate, tax_amount, total_amount, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const it of data.invoice_items) {
        stmt.run(
          it.id, it.invoice_id, it.service_id, it.service_code, it.item_name, it.sac_code, it.description,
          it.quantity, it.rate, it.discount_percent, it.taxable_value, it.tax_rate, it.tax_amount, it.total_amount, it.sort_order
        );
      }
    }

    // Restore payments
    if (Array.isArray(data.payments)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO payments (
          id, receipt_number, invoice_id, client_id, payment_date, amount, payment_mode, reference_number, bank_name, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of data.payments) {
        stmt.run(
          p.id, p.receipt_number, p.invoice_id, p.client_id, p.payment_date, p.amount, p.payment_mode,
          p.reference_number, p.bank_name, p.notes, p.recorded_by, p.created_at
        );
      }
    }

    db.exec('COMMIT;');

    logAudit(req, 'BACKUP_RESTORE', 'system', '0', `Database successfully restored from backup by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Database restored successfully! All clients, invoices and payments have been loaded.'
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Restore error:', err);
    res.status(500).json({ success: false, message: 'Failed to restore database from backup.' });
  }
});

module.exports = router;

