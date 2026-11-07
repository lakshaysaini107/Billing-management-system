const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const { getFinancialYear, formatReceiptNumber } = require('../utils/numbering');
const { convertNumberToWords } = require('../utils/numberToWords');

router.use(authMiddleware);

// GET /api/payments - list all payment receipts with search and filters
router.get('/', (req, res) => {
  const { search, payment_mode, client_id, invoice_id, start_date, end_date } = req.query;

  try {
    let sql = `
      SELECT
        p.*,
        i.invoice_number,
        i.invoice_date,
        i.grand_total as invoice_total,
        i.balance_amount as invoice_balance,
        c.legal_name as client_name,
        c.client_code,
        u.full_name as recorded_by_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (p.receipt_number LIKE ? OR p.reference_number LIKE ? OR i.invoice_number LIKE ? OR c.legal_name LIKE ?)`;
      params.push(q, q, q, q);
    }

    if (payment_mode && payment_mode !== 'all') {
      sql += ` AND p.payment_mode = ?`;
      params.push(payment_mode);
    }

    if (client_id && client_id !== 'all') {
      sql += ` AND p.client_id = ?`;
      params.push(client_id);
    }

    if (invoice_id && invoice_id !== 'all') {
      sql += ` AND p.invoice_id = ?`;
      params.push(invoice_id);
    }

    if (start_date) {
      sql += ` AND p.payment_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND p.payment_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY p.payment_date DESC, p.id DESC`;

    const payments = db.prepare(sql).all(...params);
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    console.error('Fetch payments error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve payment records' });
  }
});

// GET /api/payments/:id - single payment receipt detail
router.get('/:id', (req, res) => {
  try {
    const payment = db.prepare(`
      SELECT
        p.*,
        i.invoice_number,
        i.invoice_date,
        i.grand_total as invoice_total,
        i.balance_amount as invoice_balance,
        c.legal_name as client_name,
        c.client_code,
        c.address as client_address,
        c.city as client_city,
        c.gstin as client_gstin,
        c.pan as client_pan,
        u.full_name as recorded_by_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const rawSettings = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const s of rawSettings) {
      settings[s.key] = s.value;
    }

    const amountInWords = convertNumberToWords(payment.amount);

    res.json({
      success: true,
      payment: {
        ...payment,
        amountInWords
      },
      settings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve receipt' });
  }
});

// POST /api/payments - record a receipt against an invoice
router.post('/', (req, res) => {
  const {
    invoice_id, payment_date, amount, payment_mode, reference_number, bank_name, notes
  } = req.body;

  if (!invoice_id) {
    return res.status(400).json({ success: false, message: 'Invoice selection is required.' });
  }

  const payAmount = Number(amount);
  if (!payAmount || payAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
  }

  if (!payment_mode) {
    return res.status(400).json({ success: false, message: 'Payment mode is required (e.g. NEFT, UPI, Cheque).' });
  }

  try {
    const invoice = db.prepare(`
      SELECT i.*, c.legal_name as client_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(invoice_id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status === 'draft') {
      return res.status(400).json({ success: false, message: 'Cannot record payment against a draft invoice. Please issue the invoice first.' });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot record payment against a cancelled invoice.' });
    }

    if (invoice.balance_amount <= 0) {
      return res.status(400).json({ success: false, message: 'This invoice has already been fully paid.' });
    }

    if (payAmount > invoice.balance_amount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${payAmount}) cannot exceed outstanding balance of ₹${invoice.balance_amount}.`
      });
    }

    const payDate = payment_date || new Date().toISOString().split('T')[0];
    const fy = getFinancialYear(payDate, 'short');

    // Generate sequential receipt number: RCP/26-27/00X
    const lastReceipt = db.prepare('SELECT id FROM payments ORDER BY id DESC LIMIT 1').get();
    const nextSeq = lastReceipt ? lastReceipt.id + 1 : 1;
    const receiptNumber = formatReceiptNumber(fy, nextSeq, 3);

    // Insert payment
    const insertPayment = db.prepare(`
      INSERT INTO payments (
        receipt_number, invoice_id, client_id, payment_date, amount, payment_mode, reference_number, bank_name, notes, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertPayment.run(
      receiptNumber, invoice.id, invoice.client_id, payDate, payAmount,
      payment_mode, reference_number || '', bank_name || '', notes || '', req.user.id
    );

    const newPaymentId = Number(result.lastInsertRowid);

    // Calculate new invoice balance and status
    const newPaidAmount = Math.round((invoice.paid_amount + payAmount) * 100) / 100;
    const newBalance = Math.round((invoice.grand_total - newPaidAmount) * 100) / 100;
    const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

    db.prepare(`
      UPDATE invoices SET
        paid_amount = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPaidAmount, newBalance, newStatus, invoice.id);

    logAudit(
      req,
      'PAYMENT_RECORD',
      'payment',
      newPaymentId,
      `Recorded receipt ${receiptNumber} of ₹${payAmount} via ${payment_mode} for invoice ${invoice.invoice_number} (${invoice.client_name}). Remaining balance: ₹${newBalance}`
    );

    res.status(201).json({
      success: true,
      message: `Receipt ${receiptNumber} recorded successfully!`,
      payment_id: newPaymentId,
      receipt_number: receiptNumber,
      new_balance: newBalance,
      invoice_status: newStatus
    });
  } catch (err) {
    console.error('Record payment error:', err);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
});

module.exports = router;

