const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// All client routes require authentication
router.use(authMiddleware);

// GET /api/clients - list and search clients
router.get('/', (req, res) => {
  const { search, status, entity_type } = req.query;

  try {
    let sql = `
      SELECT c.*,
        COALESCE((SELECT COUNT(*) FROM invoices WHERE client_id = c.id AND status != 'cancelled'), 0) as total_invoices,
        COALESCE((SELECT SUM(grand_total) FROM invoices WHERE client_id = c.id AND status != 'cancelled' AND status != 'draft'), 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM payments WHERE client_id = c.id), 0) as total_paid,
        COALESCE((SELECT SUM(balance_amount) FROM invoices WHERE client_id = c.id AND status NOT IN ('draft', 'cancelled', 'paid')), 0) as outstanding_balance
      FROM clients c
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (c.legal_name LIKE ? OR c.client_code LIKE ? OR c.contact_person LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.cin_llpin LIKE ? OR c.gstin LIKE ?)`;
      params.push(q, q, q, q, q, q, q);
    }

    if (status && status !== 'all') {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (entity_type && entity_type !== 'all') {
      sql += ` AND c.entity_type = ?`;
      params.push(entity_type);
    }

    sql += ` ORDER BY c.legal_name ASC`;

    const clients = db.prepare(sql).all(...params);
    res.json({ success: true, count: clients.length, clients });
  } catch (err) {
    console.error('Fetch clients error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve clients' });
  }
});

// GET /api/clients/check-duplicate - check potential duplicates
router.get('/check-duplicate', (req, res) => {
  const { cin_llpin, gstin, phone, legal_name, exclude_id } = req.query;
  const warnings = [];

  try {
    if (cin_llpin && cin_llpin.trim()) {
      const matchCin = db.prepare(`
        SELECT id, legal_name, client_code, cin_llpin FROM clients
        WHERE cin_llpin = ? COLLATE NOCASE AND (? IS NULL OR id != ?)
      `).get(cin_llpin.trim(), exclude_id || null, exclude_id || null);

      if (matchCin) {
        warnings.push(`Client "${matchCin.legal_name}" (${matchCin.client_code}) already has this CIN/LLPIN (${matchCin.cin_llpin}).`);
      }
    }

    if (gstin && gstin.trim()) {
      const matchGstin = db.prepare(`
        SELECT id, legal_name, client_code, gstin FROM clients
        WHERE gstin = ? COLLATE NOCASE AND (? IS NULL OR id != ?)
      `).get(gstin.trim(), exclude_id || null, exclude_id || null);

      if (matchGstin) {
        warnings.push(`Client "${matchGstin.legal_name}" (${matchGstin.client_code}) already has this GSTIN (${matchGstin.gstin}).`);
      }
    }

    if (phone && phone.trim()) {
      const matchPhone = db.prepare(`
        SELECT id, legal_name, client_code, phone FROM clients
        WHERE phone = ? AND (? IS NULL OR id != ?)
      `).get(phone.trim(), exclude_id || null, exclude_id || null);

      if (matchPhone) {
        warnings.push(`Client "${matchPhone.legal_name}" (${matchPhone.client_code}) has the same phone number (${matchPhone.phone}).`);
      }
    }

    if (legal_name && legal_name.trim()) {
      const matchName = db.prepare(`
        SELECT id, legal_name, client_code FROM clients
        WHERE legal_name = ? COLLATE NOCASE AND (? IS NULL OR id != ?)
      `).get(legal_name.trim(), exclude_id || null, exclude_id || null);

      if (matchName) {
        warnings.push(`A client with the exact same name "${matchName.legal_name}" already exists (${matchName.client_code}).`);
      }
    }

    res.json({
      success: true,
      hasDuplicate: warnings.length > 0,
      warnings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Duplicate check failed' });
  }
});

// GET /api/clients/:id - get single client details
router.get('/:id', (req, res) => {
  try {
    const client = db.prepare(`
      SELECT c.*,
        COALESCE((SELECT COUNT(*) FROM invoices WHERE client_id = c.id AND status != 'cancelled'), 0) as total_invoices,
        COALESCE((SELECT SUM(grand_total) FROM invoices WHERE client_id = c.id AND status != 'cancelled' AND status != 'draft'), 0) as total_billed,
        COALESCE((SELECT SUM(amount) FROM payments WHERE client_id = c.id), 0) as total_paid,
        COALESCE((SELECT SUM(balance_amount) FROM invoices WHERE client_id = c.id AND status NOT IN ('draft', 'cancelled', 'paid')), 0) as outstanding_balance
      FROM clients c
      WHERE c.id = ?
    `).get(req.params.id);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    res.json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve client' });
  }
});

// GET /api/clients/:id/ledger - Client statement & transaction history
router.get('/:id/ledger', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Invoices (Debits)
    const invoices = db.prepare(`
      SELECT
        id, invoice_number as reference_number, invoice_date as transaction_date,
        'INVOICE' as type, 'Invoice Raised (' || status || ')' as particulars,
        grand_total as debit, 0 as credit, status
      FROM invoices
      WHERE client_id = ? AND status != 'cancelled' AND status != 'draft'
      ORDER BY invoice_date ASC
    `).all(req.params.id);

    // Payments (Credits)
    const payments = db.prepare(`
      SELECT
        p.id, p.receipt_number as reference_number, p.payment_date as transaction_date,
        'PAYMENT' as type, 'Receipt via ' || p.payment_mode || COALESCE(' (Ref: ' || p.reference_number || ')', '') as particulars,
        0 as debit, p.amount as credit, 'realised' as status
      FROM payments p
      WHERE p.client_id = ?
      ORDER BY p.payment_date ASC
    `).all(req.params.id);

    // Merge and sort chronologically
    const allTransactions = [...invoices, ...payments].sort((a, b) => {
      const dateDiff = new Date(a.transaction_date) - new Date(b.transaction_date);
      if (dateDiff !== 0) return dateDiff;
      // Invoices first on same date
      return a.type === 'INVOICE' ? -1 : 1;
    });

    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const ledgerEntries = allTransactions.map((tx, idx) => {
      runningBalance += (tx.debit - tx.credit);
      totalDebit += tx.debit;
      totalCredit += tx.credit;
      return {
        serialNo: idx + 1,
        ...tx,
        balance: runningBalance
      };
    });

    res.json({
      success: true,
      client,
      summary: {
        totalBilled: totalDebit,
        totalPaid: totalCredit,
        closingBalance: runningBalance
      },
      ledger: ledgerEntries
    });
  } catch (err) {
    console.error('Ledger error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate client ledger' });
  }
});

// POST /api/clients - create new client
router.post('/', (req, res) => {
  const {
    legal_name, entity_type, cin_llpin, gstin, pan,
    address, city, state, state_code, pincode,
    contact_person, designation, phone, email, notes
  } = req.body;

  if (!legal_name || !legal_name.trim()) {
    return res.status(400).json({ success: false, message: 'Client legal name is required.' });
  }

  try {
    // Generate next client code
    const lastClient = db.prepare('SELECT id FROM clients ORDER BY id DESC LIMIT 1').get();
    const nextId = lastClient ? lastClient.id + 1 : 1;
    const clientCode = `CLI-${String(nextId).padStart(3, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO clients (
        client_code, legal_name, entity_type, cin_llpin, gstin, pan,
        address, city, state, state_code, pincode,
        contact_person, designation, phone, email, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);

    const result = stmt.run(
      clientCode, legal_name.trim(), entity_type || 'Private Limited Company',
      cin_llpin ? cin_llpin.trim().toUpperCase() : '',
      gstin ? gstin.trim().toUpperCase() : '',
      pan ? pan.trim().toUpperCase() : '',
      address || '', city || 'New Delhi', state || 'Delhi', state_code || '07', pincode || '',
      contact_person || '', designation || '', phone || '', email || '', notes || ''
    );

    const newClientId = Number(result.lastInsertRowid);
    logAudit(req, 'CLIENT_CREATE', 'client', newClientId, `Created client "${legal_name}" with code ${clientCode}`);

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      client_id: newClientId,
      client_code: clientCode
    });
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ success: false, message: 'Failed to create client' });
  }
});

// PUT /api/clients/:id - update existing client
router.put('/:id', (req, res) => {
  const {
    legal_name, entity_type, cin_llpin, gstin, pan,
    address, city, state, state_code, pincode,
    contact_person, designation, phone, email, status, notes
  } = req.body;

  if (!legal_name || !legal_name.trim()) {
    return res.status(400).json({ success: false, message: 'Client legal name is required.' });
  }

  try {
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    db.prepare(`
      UPDATE clients SET
        legal_name = ?, entity_type = ?, cin_llpin = ?, gstin = ?, pan = ?,
        address = ?, city = ?, state = ?, state_code = ?, pincode = ?,
        contact_person = ?, designation = ?, phone = ?, email = ?, status = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      legal_name.trim(), entity_type || existing.entity_type,
      cin_llpin ? cin_llpin.trim().toUpperCase() : '',
      gstin ? gstin.trim().toUpperCase() : '',
      pan ? pan.trim().toUpperCase() : '',
      address || '', city || '', state || '', state_code || '', pincode || '',
      contact_person || '', designation || '', phone || '', email || '',
      status || existing.status, notes || '', req.params.id
    );

    logAudit(req, 'CLIENT_UPDATE', 'client', req.params.id, `Updated client "${legal_name}"`);
    res.json({ success: true, message: 'Client updated successfully' });
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ success: false, message: 'Failed to update client' });
  }
});

// POST /api/clients/:id/toggle-status - activate or deactivate
router.post('/:id/toggle-status', (req, res) => {
  try {
    const client = db.prepare('SELECT id, legal_name, status FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, client.id);

    logAudit(req, 'CLIENT_STATUS_CHANGE', 'client', client.id, `Changed status of client "${client.legal_name}" to ${newStatus}`);
    res.json({ success: true, message: `Client status changed to ${newStatus}`, newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle client status' });
  }
});

module.exports = router;

