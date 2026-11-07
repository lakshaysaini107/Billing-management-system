const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/reports/dashboard - summary metrics and trends
router.get('/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Refresh overdue statuses
    db.prepare(`
      UPDATE invoices
      SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('issued', 'partially_paid')
        AND due_date < ?
        AND balance_amount > 0
    `).run(today);

    // Totals
    const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients WHERE status = \'active\'').get().count;
    const totalClientsAll = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;

    const invoiceStats = db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'cancelled') THEN grand_total ELSE 0 END), 0) as total_billed,
        COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'cancelled') THEN paid_amount ELSE 0 END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN status NOT IN ('draft', 'cancelled', 'paid') THEN balance_amount ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN balance_amount ELSE 0 END), 0) as total_overdue,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_count,
        COUNT(CASE WHEN status = 'partially_paid' THEN 1 END) as partial_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
      FROM invoices
    `).get();

    // Top 5 clients by outstanding balance
    const topOutstandingClients = db.prepare(`
      SELECT
        c.id, c.legal_name, c.client_code, c.contact_person, c.phone,
        COALESCE(SUM(i.balance_amount), 0) as outstanding_balance,
        COUNT(i.id) as pending_invoices
      FROM clients c
      JOIN invoices i ON c.id = i.client_id
      WHERE i.status IN ('issued', 'partially_paid', 'overdue') AND i.balance_amount > 0
      GROUP BY c.id
      ORDER BY outstanding_balance DESC
      LIMIT 5
    `).all();

    // Recent 5 invoices
    const recentInvoices = db.prepare(`
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.due_date, i.status,
        i.grand_total, i.paid_amount, i.balance_amount,
        c.legal_name as client_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      ORDER BY i.id DESC
      LIMIT 6
    `).all();

    // Recent 5 payments
    const recentPayments = db.prepare(`
      SELECT
        p.id, p.receipt_number, p.payment_date, p.amount, p.payment_mode, p.reference_number,
        i.invoice_number, c.legal_name as client_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN clients c ON p.client_id = c.id
      ORDER BY p.id DESC
      LIMIT 5
    `).all();

    // Overdue alerts
    const overdueAlerts = db.prepare(`
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.due_date, i.grand_total, i.balance_amount,
        c.legal_name as client_name, c.contact_person, c.phone,
        CAST((julianday(?) - julianday(i.due_date)) as INTEGER) as days_overdue
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status = 'overdue' AND i.balance_amount > 0
      ORDER BY days_overdue DESC
      LIMIT 5
    `).all(today);

    // Monthly breakdown (last 6 months)
    const monthlyBilling = db.prepare(`
      SELECT
        strftime('%Y-%m', invoice_date) as month,
        SUM(grand_total) as billed
      FROM invoices
      WHERE status NOT IN ('draft', 'cancelled')
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `).all().reverse();

    const monthlyCollections = db.prepare(`
      SELECT
        strftime('%Y-%m', payment_date) as month,
        SUM(amount) as collected
      FROM payments
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `).all().reverse();

    res.json({
      success: true,
      stats: {
        activeClients: clientCount,
        totalClients: totalClientsAll,
        totalInvoices: invoiceStats.total_invoices,
        totalBilled: invoiceStats.total_billed,
        totalCollected: invoiceStats.total_collected,
        totalOutstanding: invoiceStats.total_outstanding,
        totalOverdue: invoiceStats.total_overdue,
        overdueCount: invoiceStats.overdue_count,
        draftCount: invoiceStats.draft_count,
        issuedCount: invoiceStats.issued_count,
        partialCount: invoiceStats.partial_count,
        paidCount: invoiceStats.paid_count,
        cancelledCount: invoiceStats.cancelled_count
      },
      topOutstandingClients,
      recentInvoices,
      recentPayments,
      overdueAlerts,
      monthlyTrends: {
        billing: monthlyBilling,
        collections: monthlyCollections
      }
    });
  } catch (err) {
    console.error('Dashboard metrics error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard data' });
  }
});

// GET /api/reports/billing-register
router.get('/billing-register', (req, res) => {
  const { start_date, end_date, client_id, status } = req.query;

  try {
    let sql = `
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.due_date, i.financial_year,
        i.status, i.place_of_supply, i.supply_type,
        i.subtotal, i.discount_amount, i.taxable_amount,
        i.cgst_amount, i.sgst_amount, i.igst_amount, i.total_tax,
        i.round_off, i.grand_total, i.paid_amount, i.balance_amount,
        c.legal_name as client_name, c.client_code, c.gstin as client_gstin
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status != 'draft'
    `;
    const params = [];

    if (start_date) {
      sql += ` AND i.invoice_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND i.invoice_date <= ?`;
      params.push(end_date);
    }
    if (client_id && client_id !== 'all') {
      sql += ` AND i.client_id = ?`;
      params.push(client_id);
    }
    if (status && status !== 'all') {
      sql += ` AND i.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY i.invoice_date ASC, i.id ASC`;

    const records = db.prepare(sql).all(...params);

    // Totals summary
    const summary = records.reduce((acc, row) => {
      acc.taxableTotal += (row.taxable_amount || 0);
      acc.cgstTotal += (row.cgst_amount || 0);
      acc.sgstTotal += (row.sgst_amount || 0);
      acc.igstTotal += (row.igst_amount || 0);
      acc.taxTotal += (row.total_tax || 0);
      acc.grandTotal += (row.grand_total || 0);
      acc.paidTotal += (row.paid_amount || 0);
      acc.balanceTotal += (row.balance_amount || 0);
      return acc;
    }, {
      taxableTotal: 0, cgstTotal: 0, sgstTotal: 0, igstTotal: 0,
      taxTotal: 0, grandTotal: 0, paidTotal: 0, balanceTotal: 0
    });

    res.json({
      success: true,
      count: records.length,
      summary,
      records
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate billing register' });
  }
});

// GET /api/reports/collection-register
router.get('/collection-register', (req, res) => {
  const { start_date, end_date, client_id, payment_mode } = req.query;

  try {
    let sql = `
      SELECT
        p.id, p.receipt_number, p.payment_date, p.amount, p.payment_mode,
        p.reference_number, p.bank_name, p.notes,
        i.invoice_number, i.invoice_date,
        c.legal_name as client_name, c.client_code
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN clients c ON p.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ` AND p.payment_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND p.payment_date <= ?`;
      params.push(end_date);
    }
    if (client_id && client_id !== 'all') {
      sql += ` AND p.client_id = ?`;
      params.push(client_id);
    }
    if (payment_mode && payment_mode !== 'all') {
      sql += ` AND p.payment_mode = ?`;
      params.push(payment_mode);
    }

    sql += ` ORDER BY p.payment_date ASC, p.id ASC`;

    const records = db.prepare(sql).all(...params);
    const totalCollected = records.reduce((sum, r) => sum + r.amount, 0);

    res.json({
      success: true,
      count: records.length,
      totalCollected,
      records
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate collection register' });
  }
});

// GET /api/reports/aging - overdue & aging breakdown
router.get('/aging', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const invoices = db.prepare(`
      SELECT
        i.id, i.invoice_number, i.invoice_date, i.due_date,
        i.grand_total, i.paid_amount, i.balance_amount, i.status,
        c.id as client_id, c.legal_name as client_name, c.client_code, c.phone, c.contact_person,
        CAST((julianday(?) - julianday(i.due_date)) as INTEGER) as days_overdue
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status NOT IN ('draft', 'cancelled', 'paid') AND i.balance_amount > 0
      ORDER BY c.legal_name ASC, i.due_date ASC
    `).all(today);

    // Group by client and bucket into aging brackets
    const clientMap = {};
    let totalOutstanding = 0;
    let totalCurrent = 0;
    let total1To30 = 0;
    let total31To60 = 0;
    let total61To90 = 0;
    let total90Plus = 0;

    for (const inv of invoices) {
      const bal = inv.balance_amount;
      totalOutstanding += bal;

      if (!clientMap[inv.client_id]) {
        clientMap[inv.client_id] = {
          clientId: inv.client_id,
          clientName: inv.client_name,
          clientCode: inv.client_code,
          phone: inv.phone,
          contactPerson: inv.contact_person,
          totalOutstanding: 0,
          current: 0,
          days1To30: 0,
          days31To60: 0,
          days61To90: 0,
          days90Plus: 0,
          invoices: []
        };
      }

      const c = clientMap[inv.client_id];
      c.totalOutstanding += bal;

      if (inv.days_overdue <= 0) {
        c.current += bal;
        totalCurrent += bal;
      } else if (inv.days_overdue <= 30) {
        c.days1To30 += bal;
        total1To30 += bal;
      } else if (inv.days_overdue <= 60) {
        c.days31To60 += bal;
        total31To60 += bal;
      } else if (inv.days_overdue <= 90) {
        c.days61To90 += bal;
        total61To90 += bal;
      } else {
        c.days90Plus += bal;
        total90Plus += bal;
      }

      c.invoices.push(inv);
    }

    const clientAging = Object.values(clientMap).sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    res.json({
      success: true,
      summary: {
        totalOutstanding,
        totalCurrent,
        total1To30,
        total31To60,
        total61To90,
        total90Plus,
        overdueTotal: total1To30 + total31To60 + total61To90 + total90Plus
      },
      clients: clientAging
    });
  } catch (err) {
    console.error('Aging report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate aging report' });
  }
});

module.exports = router;

