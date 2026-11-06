/**
 * Reports & Financial Analytics View
 */
const ReportsView = {
  currentTab: 'billing',

  async render(container, options = {}) {
    this.currentTab = (options && options.tab) || 'billing';

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">Practice Reports &amp; Registers</h3>
          <p style="font-size:12.5px; color:#64748b;">Statutory billing registers, collection summaries, and aging analysis</p>
        </div>
      </div>

      <!-- Tabs Header -->
      <div class="tabs-header">
        <button class="tab-btn ${this.currentTab === 'billing' ? 'active' : ''}" onclick="ReportsView.switchTab('billing')">
          Billing Register (GST)
        </button>
        <button class="tab-btn ${this.currentTab === 'collections' ? 'active' : ''}" onclick="ReportsView.switchTab('collections')">
          Collections Register
        </button>
        <button class="tab-btn ${this.currentTab === 'aging' ? 'active' : ''}" onclick="ReportsView.switchTab('aging')">
          Aging &amp; Overdue Report
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="report-tab-content">
        <!-- Rendered dynamically -->
      </div>
    `;

    this.renderCurrentTab();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tabs-header .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tab.toLowerCase()));
    });
    this.renderCurrentTab();
  },

  renderCurrentTab() {
    const container = document.getElementById('report-tab-content');
    if (!container) return;

    if (this.currentTab === 'billing') {
      this.renderBillingRegister(container);
    } else if (this.currentTab === 'collections') {
      this.renderCollectionRegister(container);
    } else if (this.currentTab === 'aging') {
      this.renderAgingReport(container);
    }
  },

  /**
   * 1. Billing Register
   */
  async renderBillingRegister(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:12px; font-weight:600; color:#475569;">From:</label>
          <input type="date" id="rep-bill-from" class="form-control" style="font-size:12px;" />
          <label style="font-size:12px; font-weight:600; color:#475569;">To:</label>
          <input type="date" id="rep-bill-to" class="form-control" style="font-size:12px;" />
        </div>
        <button class="btn btn-outline btn-sm" onclick="ReportsView.loadBillingData()">Filter</button>
        <button class="btn btn-outline btn-sm" onclick="ReportsView.exportBillingCsv()">Export CSV</button>
      </div>

      <div class="panel">
        <div id="billing-summary-cards" style="padding:16px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
          <!-- Summary cards -->
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Client Legal Name</th>
                <th>GSTIN</th>
                <th>Type</th>
                <th style="text-align:right;">Taxable (₹)</th>
                <th style="text-align:right;">CGST (₹)</th>
                <th style="text-align:right;">SGST (₹)</th>
                <th style="text-align:right;">IGST (₹)</th>
                <th style="text-align:right;">Grand Total (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="billing-table-body">
              <tr><td colspan="11" style="text-align:center; padding:30px; color:#94a3b8;">Loading billing register...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadBillingData();
  },

  billingRecords: [],
  async loadBillingData() {
    const start_date = document.getElementById('rep-bill-from')?.value || '';
    const end_date = document.getElementById('rep-bill-to')?.value || '';

    try {
      const data = await API.get('/api/reports/billing-register', { start_date, end_date });
      this.billingRecords = data.records;
      const s = data.summary;

      document.getElementById('billing-summary-cards').innerHTML = `
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Taxable Base:</span>
          <div style="font-size:16px; font-weight:800; color:#0f2942;">${Utils.formatINR(s.taxableTotal)}</div>
        </div>
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">CGST + SGST:</span>
          <div style="font-size:16px; font-weight:800; color:#0369a1;">${Utils.formatINR(s.cgstTotal + s.sgstTotal)}</div>
        </div>
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">IGST:</span>
          <div style="font-size:16px; font-weight:800; color:#0284c7;">${Utils.formatINR(s.igstTotal)}</div>
        </div>
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Total Tax:</span>
          <div style="font-size:16px; font-weight:800; color:#475569;">${Utils.formatINR(s.taxTotal)}</div>
        </div>
        <div>
          <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Grand Billed Total:</span>
          <div style="font-size:18px; font-weight:800; color:#0f2942;">${Utils.formatINR(s.grandTotal)}</div>
        </div>
      `;

      const tbody = document.getElementById('billing-table-body');
      if (!data.records.length) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:30px; color:#94a3b8;">No issued invoices found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.records.map(r => `
        <tr>
          <td>${Utils.formatDate(r.invoice_date)}</td>
          <td style="font-weight:700; color:#0f2942;">
            <a href="javascript:void(0)" onclick="InvoiceModal.open(${r.id})" style="color:#0f2942; text-decoration:underline;">
              ${Utils.escapeHtml(r.invoice_number)}
            </a>
          </td>
          <td style="font-weight:600;">${Utils.escapeHtml(r.client_name)}</td>
          <td style="font-family:monospace; font-size:11px;">${Utils.escapeHtml(r.client_gstin || 'Unregistered')}</td>
          <td><span style="font-size:11px; color:#64748b;">${r.supply_type === 'intra_state' ? 'Intra' : 'Inter'}</span></td>
          <td style="text-align:right;">${Utils.formatINR(r.taxable_amount).replace('₹', '')}</td>
          <td style="text-align:right; color:#64748b;">${r.cgst_amount > 0 ? Utils.formatINR(r.cgst_amount).replace('₹', '') : '-'}</td>
          <td style="text-align:right; color:#64748b;">${r.sgst_amount > 0 ? Utils.formatINR(r.sgst_amount).replace('₹', '') : '-'}</td>
          <td style="text-align:right; color:#64748b;">${r.igst_amount > 0 ? Utils.formatINR(r.igst_amount).replace('₹', '') : '-'}</td>
          <td style="text-align:right; font-weight:700; color:#0f2942;">${Utils.formatINR(r.grand_total)}</td>
          <td>${Utils.statusBadge(r.status)}</td>
        </tr>
      `).join('');
    } catch (err) {
      Toast.error('Failed to load billing register');
    }
  },

  exportBillingCsv() {
    if (!this.billingRecords.length) return Toast.warning('No records to export');
    const rows = this.billingRecords.map(r => ({
      'Invoice Date': r.invoice_date,
      'Invoice Number': r.invoice_number,
      'Client Legal Name': r.client_name,
      'Client GSTIN': r.client_gstin || '',
      'Supply Type': r.supply_type,
      'Place of Supply': r.place_of_supply,
      'Taxable Value': r.taxable_amount,
      'CGST Amount': r.cgst_amount,
      'SGST Amount': r.sgst_amount,
      'IGST Amount': r.igst_amount,
      'Total Tax': r.total_tax,
      'Grand Total': r.grand_total,
      'Paid Amount': r.paid_amount,
      'Balance Amount': r.balance_amount,
      'Status': r.status
    }));
    Utils.exportToCsv(`RSA_Billing_Register_${new Date().toISOString().split('T')[0]}.csv`, rows);
  },

  /**
   * 2. Collection Register
   */
  async renderCollectionRegister(container) {
    container.innerHTML = `
      <div class="filter-bar">
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:12px; font-weight:600; color:#475569;">From:</label>
          <input type="date" id="rep-coll-from" class="form-control" style="font-size:12px;" />
          <label style="font-size:12px; font-weight:600; color:#475569;">To:</label>
          <input type="date" id="rep-coll-to" class="form-control" style="font-size:12px;" />
        </div>
        <button class="btn btn-outline btn-sm" onclick="ReportsView.loadCollectionData()">Filter</button>
        <button class="btn btn-outline btn-sm" onclick="ReportsView.exportCollectionCsv()">Export CSV</button>
      </div>

      <div class="panel">
        <div id="coll-summary-cards" style="padding:16px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
          <!-- Summary -->
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Receipt Date</th>
                <th>Client Name</th>
                <th>Invoice Number</th>
                <th>Payment Mode</th>
                <th>Transaction Ref / UTR</th>
                <th>Bank Name</th>
                <th style="text-align:right;">Amount Received (₹)</th>
              </tr>
            </thead>
            <tbody id="collection-table-body">
              <tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">Loading collections register...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadCollectionData();
  },

  collectionRecords: [],
  async loadCollectionData() {
    const start_date = document.getElementById('rep-coll-from')?.value || '';
    const end_date = document.getElementById('rep-coll-to')?.value || '';

    try {
      const data = await API.get('/api/reports/collection-register', { start_date, end_date });
      this.collectionRecords = data.records;

      document.getElementById('coll-summary-cards').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Total Receipts Count:</span>
            <strong style="margin-left:8px; font-size:16px; color:#0f2942;">${data.count} Payments</strong>
          </div>
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Total Realised Amount:</span>
            <strong style="margin-left:8px; font-size:20px; color:#047857;">${Utils.formatINR(data.totalCollected)}</strong>
          </div>
        </div>
      `;

      const tbody = document.getElementById('collection-table-body');
      if (!data.records.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No collections recorded.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.records.map(r => `
        <tr>
          <td style="font-weight:700; color:#0f2942;">${Utils.escapeHtml(r.receipt_number)}</td>
          <td>${Utils.formatDate(r.payment_date)}</td>
          <td style="font-weight:600;">${Utils.escapeHtml(r.client_name)}</td>
          <td><span class="badge badge-issued">${Utils.escapeHtml(r.invoice_number)}</span></td>
          <td><strong>${Utils.escapeHtml(r.payment_mode)}</strong></td>
          <td style="font-family:monospace; font-size:11px;">${Utils.escapeHtml(r.reference_number || '-')}</td>
          <td>${Utils.escapeHtml(r.bank_name || '-')}</td>
          <td style="text-align:right; font-weight:800; color:#047857;">${Utils.formatINR(r.amount)}</td>
        </tr>
      `).join('');
    } catch (err) {
      Toast.error('Failed to load collections register');
    }
  },

  exportCollectionCsv() {
    if (!this.collectionRecords.length) return Toast.warning('No records to export');
    const rows = this.collectionRecords.map(r => ({
      'Receipt Number': r.receipt_number,
      'Receipt Date': r.payment_date,
      'Client Name': r.client_name,
      'Client Code': r.client_code,
      'Invoice Number': r.invoice_number,
      'Payment Mode': r.payment_mode,
      'Reference Number': r.reference_number || '',
      'Bank Name': r.bank_name || '',
      'Amount': r.amount
    }));
    Utils.exportToCsv(`RSA_Collections_Register_${new Date().toISOString().split('T')[0]}.csv`, rows);
  },

  /**
   * 3. Aging & Overdue Report
   */
  async renderAgingReport(container) {
    container.innerHTML = `
      <div id="aging-content" style="padding:10px 0;">
        <div style="text-align:center; padding:30px; color:#94a3b8;">Analyzing outstanding invoices and overdue aging...</div>
      </div>
    `;

    try {
      const data = await API.get('/api/reports/aging');
      const sum = data.summary;

      document.getElementById('aging-content').innerHTML = `
        <!-- Aging Buckets Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:24px;">
          
          <div class="panel" style="margin-bottom:0; padding:16px; border-top:4px solid #0369a1;">
            <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Current (Not Due)</div>
            <div style="font-size:20px; font-weight:800; color:#0369a1; margin-top:4px;">${Utils.formatINR(sum.totalCurrent)}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Within payment terms</div>
          </div>

          <div class="panel" style="margin-bottom:0; padding:16px; border-top:4px solid #f59e0b;">
            <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">1 - 30 Days Overdue</div>
            <div style="font-size:20px; font-weight:800; color:#d97706; margin-top:4px;">${Utils.formatINR(sum.total1To30)}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Follow-up required</div>
          </div>

          <div class="panel" style="margin-bottom:0; padding:16px; border-top:4px solid #ea580c;">
            <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">31 - 60 Days Overdue</div>
            <div style="font-size:20px; font-weight:800; color:#ea580c; margin-top:4px;">${Utils.formatINR(sum.total31To60)}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Reminder notice</div>
          </div>

          <div class="panel" style="margin-bottom:0; padding:16px; border-top:4px solid #dc2626;">
            <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">61 - 90 Days Overdue</div>
            <div style="font-size:20px; font-weight:800; color:#dc2626; margin-top:4px;">${Utils.formatINR(sum.total61To90)}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Critical collection</div>
          </div>

          <div class="panel" style="margin-bottom:0; padding:16px; border-top:4px solid #7f1d1d;">
            <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">&gt; 90 Days Overdue</div>
            <div style="font-size:20px; font-weight:800; color:#7f1d1d; margin-top:4px;">${Utils.formatINR(sum.total90Plus)}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Statutory interest / review</div>
          </div>

        </div>

        <!-- Client-wise Aging Breakdown Table -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Client-Wise Outstanding Aging Analysis</span>
            <span style="font-weight:700; color:#b45309;">Total Pending: ${Utils.formatINR(sum.totalOutstanding)}</span>
          </div>

          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Client Legal Name</th>
                  <th style="text-align:right;">Current</th>
                  <th style="text-align:right;">1-30 Days</th>
                  <th style="text-align:right;">31-60 Days</th>
                  <th style="text-align:right;">61-90 Days</th>
                  <th style="text-align:right;">&gt;90 Days</th>
                  <th style="text-align:right;">Total Balance Due</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${data.clients.length === 0 ? `
                  <tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">All accounts settled. Zero outstanding!</td></tr>
                ` : data.clients.map(c => `
                  <tr>
                    <td>
                      <div style="font-weight:600; color:#0f2942;">${Utils.escapeHtml(c.clientName)}</div>
                      <div style="font-size:11px; color:#64748b;">${Utils.escapeHtml(c.clientCode)} • ${Utils.escapeHtml(c.phone || c.contactPerson || '')}</div>
                    </td>
                    <td style="text-align:right; color:#64748b;">${c.current > 0 ? Utils.formatINR(c.current) : '-'}</td>
                    <td style="text-align:right; color:${c.days1To30 > 0 ? '#d97706' : '#94a3b8'}; font-weight:${c.days1To30 > 0 ? '700' : 'normal'};">
                      ${c.days1To30 > 0 ? Utils.formatINR(c.days1To30) : '-'}
                    </td>
                    <td style="text-align:right; color:${c.days31To60 > 0 ? '#ea580c' : '#94a3b8'}; font-weight:${c.days31To60 > 0 ? '700' : 'normal'};">
                      ${c.days31To60 > 0 ? Utils.formatINR(c.days31To60) : '-'}
                    </td>
                    <td style="text-align:right; color:${c.days61To90 > 0 ? '#dc2626' : '#94a3b8'}; font-weight:${c.days61To90 > 0 ? '700' : 'normal'};">
                      ${c.days61To90 > 0 ? Utils.formatINR(c.days61To90) : '-'}
                    </td>
                    <td style="text-align:right; color:${c.days90Plus > 0 ? '#7f1d1d' : '#94a3b8'}; font-weight:${c.days90Plus > 0 ? '800' : 'normal'};">
                      ${c.days90Plus > 0 ? Utils.formatINR(c.days90Plus) : '-'}
                    </td>
                    <td style="text-align:right; font-weight:800; font-size:13.5px; color:#b45309;">
                      ${Utils.formatINR(c.totalOutstanding)}
                    </td>
                    <td style="text-align:right;">
                      <button class="btn btn-outline btn-sm" onclick="ClientsView.openLedgerModal(${c.clientId})">
                        Ledger
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      Toast.error('Failed to load aging report: ' + err.message);
    }
  }
};
