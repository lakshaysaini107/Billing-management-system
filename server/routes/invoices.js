const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { getFinancialYear, formatInvoiceNumber } = require('../utils/numbering');
const { convertNumberToWords } = require('../utils/numberToWords');
const { generateUpiQr } = require('../utils/upiQr');

router.use(authMiddleware);

/**
 * Helper to update overdue status for invoices where due_date < today
 */
function refreshOverdueStatuses() {
  try {
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE invoices
      SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('issued', 'partially_paid')
        AND due_date < ?
        AND balance_amount > 0
    `).run(today);
  } catch (err) {
    console.error('Error refreshing overdue status:', err);
  }
}

/**
 * Calculation helper
 */
function calculateInvoiceTotals({ items = [], discount_type = 'fixed', discount_value = 0, supply_type = 'intra_state', default_tax_rate = 18 }) {
  let subtotal = 0;
  const processedItems = items.map((item, idx) => {
    const qty = Math.max(0.01, Number(item.quantity) || 1);
    const rate = Number(item.rate) || 0;
    const discPct = Math.min(100, Math.max(0, Number(item.discount_percent) || 0));
    const gross = qty * rate;
    const itemDisc = (gross * discPct) / 100;
    const taxableVal = Math.round((gross - itemDisc) * 100) / 100;
    const taxRate = item.tax_rate !== undefined ? Number(item.tax_rate) : default_tax_rate;
    const taxAmt = supply_type === 'exempt' ? 0 : Math.round((taxableVal * (taxRate / 100)) * 100) / 100;
    const totalAmt = Math.round((taxableVal + taxAmt) * 100) / 100;

    subtotal += taxableVal;

    return {
      service_id: item.service_id || null,
      service_code: item.service_code || '',
      item_name: item.item_name || 'Professional Service',
      sac_code: item.sac_code || '998242',
      description: item.description || '',
      quantity: qty,
      rate: rate,
      discount_percent: discPct,
      taxable_value: taxableVal,
      tax_rate: supply_type === 'exempt' ? 0 : taxRate,
      tax_amount: taxAmt,
      total_amount: totalAmt,
      sort_order: idx + 1
    };
  });

  subtotal = Math.round(subtotal * 100) / 100;

  let discAmt = 0;
  const discVal = Number(discount_value) || 0;
  if (discount_type === 'percentage') {
    discAmt = Math.round((subtotal * (discVal / 100)) * 100) / 100;
  } else {
    discAmt = Math.round(discVal * 100) / 100;
  }
  if (discAmt > subtotal) discAmt = subtotal;

  const taxableAmount = Math.round((subtotal - discAmt) * 100) / 100;

  let cgstRate = 0, cgstAmount = 0;
  let sgstRate = 0, sgstAmount = 0;
  let igstRate = 0, igstAmount = 0;

  if (supply_type === 'intra_state') {
    cgstRate = default_tax_rate / 2;
    sgstRate = default_tax_rate / 2;
    cgstAmount = Math.round((taxableAmount * (cgstRate / 100)) * 100) / 100;
    sgstAmount = Math.round((taxableAmount * (sgstRate / 100)) * 100) / 100;
  } else if (supply_type === 'inter_state') {
    igstRate = default_tax_rate;
    igstAmount = Math.round((taxableAmount * (igstRate / 100)) * 100) / 100;
  }

  const totalTax = Math.round((cgstAmount + sgstAmount + igstAmount) * 100) / 100;
  const rawGrandTotal = taxableAmount + totalTax;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  return {
    items: processedItems,
    subtotal,
    discount_amount: discAmt,
    taxable_amount: taxableAmount,
    cgst_rate: cgstRate,
    cgst_amount: cgstAmount,
    sgst_rate: sgstRate,
    sgst_amount: sgstAmount,
    igst_rate: igstRate,
    igst_amount: igstAmount,
    total_tax: totalTax,
    round_off: roundOff,
    grand_total: roundedGrandTotal
  };
}

// GET /api/invoices - list invoices with search and filters
router.get('/', (req, res) => {
  refreshOverdueStatuses();

  const { search, status, client_id, start_date, end_date, financial_year } = req.query;

  try {
    let sql = `
      SELECT
        i.*,
        c.legal_name as client_name,
        c.client_code,
        c.contact_person,
        c.phone as client_phone,
        c.gstin as client_gstin,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count,
        (SELECT COUNT(*) FROM payments WHERE invoice_id = i.id) as payment_count
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (i.invoice_number LIKE ? OR c.legal_name LIKE ? OR c.client_code LIKE ? OR c.contact_person LIKE ?)`;
      params.push(q, q, q, q);
    }

    if (status && status !== 'all') {
      sql += ` AND i.status = ?`;
      params.push(status);
    }

    if (client_id && client_id !== 'all') {
      sql += ` AND i.client_id = ?`;
      params.push(client_id);
    }

    if (financial_year && financial_year !== 'all') {
      sql += ` AND i.financial_year = ?`;
      params.push(financial_year);
    }

    if (start_date) {
      sql += ` AND i.invoice_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND i.invoice_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY i.id DESC`;

    const invoices = db.prepare(sql).all(...params);
    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    console.error('Fetch invoices error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoices' });
  }
});

// GET /api/invoices/:id - single invoice with items, payments, firm info & UPI QR
router.get('/:id', async (req, res) => {
  refreshOverdueStatuses();

  try {
    const invoice = db.prepare(`
      SELECT i.*,
        c.legal_name as client_name, c.entity_type as client_entity_type,
        c.client_code, c.cin_llpin as client_cin, c.gstin as client_gstin,
        c.pan as client_pan, c.address as client_address, c.city as client_city,
        c.state as client_state, c.state_code as client_state_code, c.pincode as client_pincode,
        c.contact_person as client_contact, c.designation as client_designation,
        c.phone as client_phone, c.email as client_email,
        u_iss.full_name as issued_by_name,
        u_canc.full_name as cancelled_by_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN users u_iss ON i.issued_by = u_iss.id
      LEFT JOIN users u_canc ON i.cancelled_by = u_canc.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const items = db.prepare(`
      SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC
    `).all(invoice.id);

    const payments = db.prepare(`
      SELECT p.*, u.full_name as recorded_by_name
      FROM payments p
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.invoice_id = ?
      ORDER BY p.payment_date ASC, p.id ASC
    `).all(invoice.id);

    // Fetch firm settings for printable invoice
    const rawSettings = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const s of rawSettings) {
      settings[s.key] = s.value;
    }

    // Convert amount in words
    const amountInWords = convertNumberToWords(invoice.grand_total);
    const balanceInWords = convertNumberToWords(invoice.balance_amount);

    // Generate UPI QR for invoice balance (or grand total if unpaid)
    const amountForQr = invoice.balance_amount > 0 ? invoice.balance_amount : invoice.grand_total;
    const upiInfo = await generateUpiQr({
      upiId: settings.upi_id,
      payeeName: settings.account_name || settings.firm_name,
      amount: amountForQr,
      invoiceNo: invoice.invoice_number || `INV-${invoice.id}`
    });

    res.json({
      success: true,
      invoice: {
        ...invoice,
        amountInWords,
        balanceInWords,
        upiQrDataUrl: upiInfo.qrDataUrl,
        upiString: upiInfo.upiString
      },
      items,
      payments,
      settings
    });
  } catch (err) {
    console.error('Invoice detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoice details' });
  }
});

// POST /api/invoices - create draft invoice or issue immediately
router.post('/', (req, res) => {
  const {
    client_id, invoice_date, due_date, action = 'save_draft', // 'save_draft' or 'issue'
    place_of_supply, supply_type = 'intra_state',
    discount_type = 'fixed', discount_value = 0,
    items = [], notes, terms
  } = req.body;

  if (!client_id) {
    return res.status(400).json({ success: false, message: 'Client selection is required.' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one service line item is required.' });
  }

  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    const invDate = invoice_date || new Date().toISOString().split('T')[0];
    const dueDate = due_date || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fy = getFinancialYear(invDate, 'short');

    // Get default tax rate from settings
    const taxSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_tax_rate');
    const defaultTaxRate = taxSetting ? Number(taxSetting.value) : 18;

    const calc = calculateInvoiceTotals({
      items,
      discount_type,
      discount_value,
      supply_type,
      default_tax_rate: defaultTaxRate
    });

    let invoiceNumber = null;
    let sequenceNumber = null;
    let status = 'draft';
    let issuedAt = null;
    let issuedBy = null;

    if (action === 'issue') {
      // Allocate next sequence number
      const prefixSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_prefix');
      const paddingSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('sequence_padding');
      const nextSeqSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('next_sequence');

      const prefix = prefixSetting ? prefixSetting.value : 'RSA/';
      const padding = paddingSetting ? Number(paddingSetting.value) : 3;
      let nextSeq = nextSeqSetting ? Number(nextSeqSetting.value) : 1;

      // Ensure no collision in this FY
      while (true) {
        const testNumber = formatInvoiceNumber(prefix, fy, nextSeq, padding);
        const exists = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(testNumber);
        if (!exists) {
          invoiceNumber = testNumber;
          sequenceNumber = nextSeq;
          break;
        }
        nextSeq++;
      }

      // Update next_sequence in settings
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(nextSeq + 1), 'next_sequence');

      status = 'issued';
      issuedAt = new Date().toISOString();
      issuedBy = req.user.id;
    }

    const defaultTerms = terms !== undefined ? terms : db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_terms')?.value;

    const stmt = db.prepare(`
      INSERT INTO invoices (
        invoice_number, financial_year, sequence_number, client_id, invoice_date, due_date,
        status, place_of_supply, supply_type, subtotal, discount_type, discount_value, discount_amount,
        taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
        total_tax, round_off, grand_total, paid_amount, balance_amount, notes, terms,
        issued_at, issued_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      invoiceNumber, fy, sequenceNumber, client.id, invDate, dueDate,
      status, place_of_supply || `${client.state_code || '07'}-${client.state || 'Delhi'}`,
      supply_type, calc.subtotal, discount_type, discount_value, calc.discount_amount,
      calc.taxable_amount, calc.cgst_rate, calc.cgst_amount, calc.sgst_rate, calc.sgst_amount,
      calc.igst_rate, calc.igst_amount, calc.total_tax, calc.round_off, calc.grand_total,
      0, calc.grand_total, notes || '', defaultTerms || '',
      issuedAt, issuedBy
    );

    const newInvoiceId = Number(result.lastInsertRowid);

    // Insert line items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (
        invoice_id, service_id, service_code, item_name, sac_code, description,
        quantity, rate, discount_percent, taxable_value, tax_rate, tax_amount, total_amount, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of calc.items) {
      insertItem.run(
        newInvoiceId, item.service_id, item.service_code, item.item_name, item.sac_code, item.description,
        item.quantity, item.rate, item.discount_percent, item.taxable_value, item.tax_rate, item.tax_amount, item.total_amount, item.sort_order
      );
    }

    logAudit(
      req,
      action === 'issue' ? 'INVOICE_ISSUE' : 'INVOICE_DRAFT_CREATE',
      'invoice',
      newInvoiceId,
      action === 'issue'
        ? `Issued Invoice ${invoiceNumber} for client ${client.legal_name} (₹${calc.grand_total})`
        : `Created draft invoice #${newInvoiceId} for client ${client.legal_name} (₹${calc.grand_total})`
    );

    res.status(201).json({
      success: true,
      message: action === 'issue' ? `Invoice ${invoiceNumber} issued successfully!` : 'Draft invoice saved successfully!',
      invoice_id: newInvoiceId,
      invoice_number: invoiceNumber,
      status
    });
  } catch (err) {
    console.error('Invoice creation error:', err);
    res.status(500).json({ success: false, message: 'Failed to create invoice' });
  }
});

// PUT /api/invoices/:id - update draft invoice
router.put('/:id', (req, res) => {
  const {
    client_id, invoice_date, due_date,
    place_of_supply, supply_type = 'intra_state',
    discount_type = 'fixed', discount_value = 0,
    items = [], notes, terms
  } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (existing.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Issued or finalized invoices cannot be modified. Only draft invoices can be edited.'
      });
    }

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id || existing.client_id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    const invDate = invoice_date || existing.invoice_date;
    const dueDate = due_date || existing.due_date;
    const fy = getFinancialYear(invDate, 'short');

    const taxSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_tax_rate');
    const defaultTaxRate = taxSetting ? Number(taxSetting.value) : 18;

    const calc = calculateInvoiceTotals({
      items,
      discount_type,
      discount_value,
      supply_type,
      default_tax_rate: defaultTaxRate
    });

    db.prepare(`
      UPDATE invoices SET
        client_id = ?, invoice_date = ?, due_date = ?, financial_year = ?,
        place_of_supply = ?, supply_type = ?, subtotal = ?, discount_type = ?, discount_value = ?, discount_amount = ?,
        taxable_amount = ?, cgst_rate = ?, cgst_amount = ?, sgst_rate = ?, sgst_amount = ?,
        igst_rate = ?, igst_amount = ?, total_tax = ?, round_off = ?, grand_total = ?, balance_amount = ?,
        notes = ?, terms = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      client.id, invDate, dueDate, fy,
      place_of_supply || existing.place_of_supply, supply_type, calc.subtotal, discount_type, discount_value, calc.discount_amount,
      calc.taxable_amount, calc.cgst_rate, calc.cgst_amount, calc.sgst_rate, calc.sgst_amount,
      calc.igst_rate, calc.igst_amount, calc.total_tax, calc.round_off, calc.grand_total, calc.grand_total,
      notes !== undefined ? notes : existing.notes, terms !== undefined ? terms : existing.terms,
      existing.id
    );

    // Replace items
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(existing.id);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (
        invoice_id, service_id, service_code, item_name, sac_code, description,
        quantity, rate, discount_percent, taxable_value, tax_rate, tax_amount, total_amount, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of calc.items) {
      insertItem.run(
        existing.id, item.service_id, item.service_code, item.item_name, item.sac_code, item.description,
        item.quantity, item.rate, item.discount_percent, item.taxable_value, item.tax_rate, item.tax_amount, item.total_amount, item.sort_order
      );
    }

    logAudit(req, 'INVOICE_DRAFT_UPDATE', 'invoice', existing.id, `Updated draft invoice #${existing.id} (₹${calc.grand_total})`);

    res.json({ success: true, message: 'Draft invoice updated successfully.' });
  } catch (err) {
    console.error('Invoice update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update draft invoice' });
  }
});

// POST /api/invoices/:id/issue - convert draft to issued invoice with unique sequence
router.post('/:id/issue', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, c.legal_name as client_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Invoice is already ${invoice.status} with number ${invoice.invoice_number}. Cannot re-issue.`
      });
    }

    const fy = getFinancialYear(invoice.invoice_date, 'short');
    const prefixSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_prefix');
    const paddingSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('sequence_padding');
    const nextSeqSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('next_sequence');

    const prefix = prefixSetting ? prefixSetting.value : 'RSA/';
    const padding = paddingSetting ? Number(paddingSetting.value) : 3;
    let nextSeq = nextSeqSetting ? Number(nextSeqSetting.value) : 1;

    let invoiceNumber = null;
    let sequenceNumber = null;

    while (true) {
      const testNumber = formatInvoiceNumber(prefix, fy, nextSeq, padding);
      const exists = db.prepare('SELECT id FROM invoices WHERE invoice_number = ?').get(testNumber);
      if (!exists) {
        invoiceNumber = testNumber;
        sequenceNumber = nextSeq;
        break;
      }
      nextSeq++;
    }

    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(nextSeq + 1), 'next_sequence');

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE invoices SET
        invoice_number = ?, sequence_number = ?, status = 'issued',
        issued_at = ?, issued_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(invoiceNumber, sequenceNumber, now, req.user.id, invoice.id);

    logAudit(req, 'INVOICE_ISSUE', 'invoice', invoice.id, `Issued draft invoice #${invoice.id} as ${invoiceNumber} for ${invoice.client_name} (₹${invoice.grand_total})`);

    res.json({
      success: true,
      message: `Invoice ${invoiceNumber} issued successfully!`,
      invoice_number: invoiceNumber,
      status: 'issued'
    });
  } catch (err) {
    console.error('Invoice issue error:', err);
    res.status(500).json({ success: false, message: 'Failed to issue invoice' });
  }
});

// POST /api/invoices/:id/cancel - cancel issued invoice with required reason (Owner / Admin only)
router.post('/:id/cancel', requireRole(['admin', 'owner']), (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'A valid cancellation reason is required.' });
  }

  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Invoice is already cancelled.' });
    }

    if (invoice.status === 'draft') {
      return res.status(400).json({ success: false, message: 'Draft invoices can be deleted directly, no cancellation record required.' });
    }

    // Check if any payments are linked to this invoice
    const paymentsCount = db.prepare('SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?').get(invoice.id).count;
    if (paymentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an invoice with recorded receipts. Please review payments before cancelling.'
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE invoices SET
        status = 'cancelled',
        cancelled_at = ?,
        cancelled_by = ?,
        cancellation_reason = ?,
        balance_amount = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(now, req.user.id, reason.trim(), invoice.id);

    logAudit(
      req,
      'INVOICE_CANCEL',
      'invoice',
      invoice.id,
      `Cancelled invoice ${invoice.invoice_number}. Reason: ${reason.trim()}`
    );

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} has been cancelled. Record and invoice number are permanently retained.`
    });
  } catch (err) {
    console.error('Invoice cancellation error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel invoice' });
  }
});

// DELETE /api/invoices/:id - only allowed for DRAFTS
router.delete('/:id', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status !== 'draft') {
      return res.status(403).json({
        success: false,
        message: 'FR-15 Rule: Issued invoices cannot be deleted. They must follow the cancellation process to retain audit integrity.'
      });
    }

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id);

    logAudit(req, 'INVOICE_DRAFT_DELETE', 'invoice', invoice.id, `Deleted draft invoice #${invoice.id}`);

    res.json({ success: true, message: 'Draft invoice deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete draft invoice' });
  }
});

module.exports = router;
