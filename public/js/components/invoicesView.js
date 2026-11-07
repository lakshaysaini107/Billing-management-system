/**
 * Invoices Register View
 */
const InvoicesView = {
  invoices: [],

  async render(container, options = {}) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">Invoice Register</h3>
          <p style="font-size:12.5px; color:#64748b;">Search, view, issue, download, reprint, and track invoice statuses</p>
        </div>
        <button class="btn btn-primary" onclick="App.navigate('create-invoice')">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Create New Invoice
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="inv-search" class="form-control" placeholder="Search by invoice #, client name, or contact..." />
        </div>

        <div style="min-width: 150px;">
          <select id="inv-status-filter" class="form-control">
            <option value="all">All Statuses</option>
            <option value="draft">Drafts Only</option>
            <option value="issued">Issued (Unpaid)</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Fully Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <input type="date" id="inv-date-from" class="form-control" style="font-size: 12px; padding: 6px 8px;" title="From Date" />
          <span style="color: #94a3b8;">to</span>
          <input type="date" id="inv-date-to" class="form-control" style="font-size: 12px; padding: 6px 8px;" title="To Date" />
        </div>

        <button class="btn btn-outline btn-sm" onclick="InvoicesView.loadInvoices()">
          Apply Filter
        </button>
        <button class="btn btn-outline btn-sm" onclick="InvoicesView.exportCsv()" title="Export filtered list to CSV">
          Export CSV
        </button>
      </div>

      <!-- Invoices Table -->
      <div class="panel">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Client Name</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style="text-align:right;">Grand Total (₹)</th>
                <th style="text-align:right;">Balance (₹)</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="invoices-table-body">
              <tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">Loading invoice register...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (options && options.status) {
      const select = document.getElementById('inv-status-filter');
      if (select) select.value = options.status;
    }

    document.getElementById('inv-search').addEventListener('input', () => InvoicesView.debouncedFilter());
    document.getElementById('inv-status-filter').addEventListener('change', () => InvoicesView.loadInvoices());

    await InvoicesView.loadInvoices();
  },

  debouncedTimer: null,
  debouncedFilter() {
    clearTimeout(this.debouncedTimer);
    this.debouncedTimer = setTimeout(() => {
      this.loadInvoices();
    }, 300);
  },

  async loadInvoices() {
    const search = document.getElementById('inv-search')?.value || '';
    const status = document.getElementById('inv-status-filter')?.value || 'all';
    const start_date = document.getElementById('inv-date-from')?.value || '';
    const end_date = document.getElementById('inv-date-to')?.value || '';

    try {
      const res = await API.get('/api/invoices', { search, status, start_date, end_date });
      this.invoices = res.invoices;
      this.renderRows(res.invoices);
    } catch (err) {
      Toast.error('Failed to load invoices');
    }
  },

  renderRows(invoices) {
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;

    if (!invoices || invoices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No invoices found matching criteria.</td></tr>`;
      return;
    }

    const user = API.getUser() || {};
    const isOwner = user.role === 'admin' || user.role === 'owner';

    tbody.innerHTML = invoices.map(inv => `
      <tr>
        <td style="font-weight:700; color:#0f2942;">
          ${inv.invoice_number ? Utils.escapeHtml(inv.invoice_number) : `<span style="color:#64748b; font-style:italic;">[Draft #${inv.id}]</span>`}
          <div style="font-size:10.5px; color:#64748b; font-weight:normal;">FY: ${Utils.escapeHtml(inv.financial_year)}</div>
        </td>
        <td>
          <div style="font-weight:600; color:#0f2942;">${Utils.escapeHtml(inv.client_name)}</div>
          <div style="font-size:11px; color:#64748b;">${Utils.escapeHtml(inv.client_code)} • ${Utils.escapeHtml(inv.client_gstin || 'Unregistered')}</div>
        </td>
        <td>${Utils.formatDate(inv.invoice_date)}</td>
        <td>
          ${Utils.formatDate(inv.due_date)}
          ${inv.status === 'overdue' ? `<div style="font-size:10px; color:#dc2626; font-weight:700;">OVERDUE</div>` : ''}
        </td>
        <td>${Utils.statusBadge(inv.status)}</td>
        <td style="text-align:right; font-weight:700; color:#0f2942;">
          ${Utils.formatINR(inv.grand_total)}
        </td>
        <td style="text-align:right; font-weight:700; color:${inv.balance_amount > 0 ? '#b45309' : '#059669'};">
          ${inv.status === 'draft' ? '-' : Utils.formatINR(inv.balance_amount)}
        </td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-primary btn-sm" onclick="InvoiceModal.open(${inv.id})">
            View / Print
          </button>

          ${inv.status === 'draft' ? `
            <button class="btn btn-outline btn-sm" onclick="App.navigate('create-invoice', { invoiceId: ${inv.id} })">
              Edit
            </button>
            <button class="btn btn-outline btn-sm" style="color:#ef4444;" onclick="InvoicesView.deleteDraft(${inv.id})">
              Delete
            </button>
          ` : ''}

          ${inv.balance_amount > 0 && inv.status !== 'cancelled' && inv.status !== 'draft' ? `
            <button class="btn btn-outline btn-sm" style="color:#047857;" onclick="PaymentsView.openRecordPaymentModal(${inv.id})">
              Collect
            </button>
          ` : ''}

          ${isOwner && inv.status !== 'cancelled' && inv.status !== 'draft' ? `
            <button class="btn btn-outline btn-sm" style="color:#dc2626;" onclick="InvoiceModal.cancelInvoicePrompt(${inv.id})">
              Cancel
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  },

  async deleteDraft(id) {
    if (!confirm('Are you sure you want to delete this draft invoice?')) return;
    try {
      await API.delete(`/api/invoices/${id}`);
      Toast.success('Draft invoice deleted.');
      InvoicesView.loadInvoices();
    } catch (err) {
      Toast.error(err.message || 'Failed to delete draft');
    }
  },

  exportCsv() {
    if (!this.invoices || !this.invoices.length) {
      Toast.warning('No invoices to export.');
      return;
    }

    const rows = this.invoices.map(inv => ({
      'Invoice Number': inv.invoice_number || `Draft-${inv.id}`,
      'Client Name': inv.client_name,
      'Client Code': inv.client_code,
      'Client GSTIN': inv.client_gstin || '',
      'Invoice Date': inv.invoice_date,
      'Due Date': inv.due_date,
      'Financial Year': inv.financial_year,
      'Status': inv.status,
      'Subtotal': inv.subtotal,
      'Taxable Amount': inv.taxable_amount,
      'CGST': inv.cgst_amount,
      'SGST': inv.sgst_amount,
      'IGST': inv.igst_amount,
      'Total Tax': inv.total_tax,
      'Grand Total': inv.grand_total,
      'Paid Amount': inv.paid_amount,
      'Balance Amount': inv.balance_amount
    }));

    Utils.exportToCsv(`RSA_Invoice_Register_${new Date().toISOString().split('T')[0]}.csv`, rows);
  }
};

