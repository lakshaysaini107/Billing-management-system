/**
 * Dashboard View
 */
const DashboardView = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height:300px;">
        <div style="text-align:center; color:#64748b;">
          <div style="font-size:24px; margin-bottom:8px;">⏳</div>
          Loading Practice Dashboard...
        </div>
      </div>
    `;

    try {
      const data = await API.get('/api/reports/dashboard');
      const stats = data.stats;

      container.innerHTML = `
        <!-- Top Action Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="font-size: 18px; font-weight: 700; color: #0f2942;">Executive Practice Overview</h3>
            <p style="font-size: 12.5px; color: #64748b;">Real-time billing, collections, and outstanding fee tracking</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-gold" onclick="App.navigate('create-invoice')">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Create Invoice
            </button>
            <button class="btn btn-primary" onclick="App.navigate('clients', { openNew: true })">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              Add Client
            </button>
            <button class="btn btn-outline" onclick="PaymentsView.openRecordPaymentModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Record Payment
            </button>
          </div>
        </div>

        <!-- Overdue Invoices Alert Banner -->
        ${stats.totalOverdue > 0 ? `
          <div class="alert alert-danger" style="margin-bottom: 24px;">
            <svg width="22" height="22" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <div style="flex: 1;">
              <strong>Attention: ${stats.overdueCount} invoice(s) are overdue</strong> totaling <strong>${Utils.formatINR(stats.totalOverdue)}</strong>.
              Follow up with clients to expedite collections.
            </div>
            <button class="btn btn-sm btn-danger" onclick="App.navigate('invoices', { status: 'overdue' })">
              Review Overdue (${stats.overdueCount})
            </button>
          </div>
        ` : ''}

        <!-- KPI Cards Grid -->
        <div class="metrics-grid">
          <div class="metric-card navy">
            <div class="metric-header">
              <span class="metric-title">Total Billed</span>
              <div class="metric-icon" style="background:#e0f2fe; color:#0369a1;">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
            </div>
            <div class="metric-value">${Utils.formatINR(stats.totalBilled)}</div>
            <div class="metric-subtitle">${stats.totalInvoices} Invoices Raised (${stats.draftCount} Drafts)</div>
          </div>

          <div class="metric-card green">
            <div class="metric-header">
              <span class="metric-title">Total Collected</span>
              <div class="metric-icon" style="background:#d1fae5; color:#047857;">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <div class="metric-value" style="color:#047857;">${Utils.formatINR(stats.totalCollected)}</div>
            <div class="metric-subtitle">${stats.paidCount} Fully Paid • ${stats.partialCount} Partially Paid</div>
          </div>

          <div class="metric-card gold">
            <div class="metric-header">
              <span class="metric-title">Total Outstanding</span>
              <div class="metric-icon" style="background:#fef3c7; color:#b45309;">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <div class="metric-value" style="color:#b45309;">${Utils.formatINR(stats.totalOutstanding)}</div>
            <div class="metric-subtitle">${stats.issuedCount + stats.partialCount + stats.overdueCount} Pending Invoices</div>
          </div>

          <div class="metric-card red">
            <div class="metric-header">
              <span class="metric-title">Overdue Amount</span>
              <div class="metric-icon" style="background:#fee2e2; color:#b91c1c;">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
            </div>
            <div class="metric-value" style="color:#b91c1c;">${Utils.formatINR(stats.totalOverdue)}</div>
            <div class="metric-subtitle">${stats.overdueCount} Invoices past due date</div>
          </div>

          <div class="metric-card blue">
            <div class="metric-header">
              <span class="metric-title">Active Clients</span>
              <div class="metric-icon" style="background:#eff6ff; color:#1d4ed8;">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              </div>
            </div>
            <div class="metric-value">${stats.activeClients}</div>
            <div class="metric-subtitle">Total Registered: ${stats.totalClients}</div>
          </div>
        </div>

        <!-- 2 Column Section: Top Outstanding Clients & Recent Invoices -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; margin-bottom: 24px;">
          
          <!-- Top Outstanding Clients Panel -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Top Outstanding Balances
              </span>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('reports', { tab: 'aging' })">
                View Aging
              </button>
            </div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Client Legal Name</th>
                    <th>Pending</th>
                    <th style="text-align: right;">Outstanding</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.topOutstandingClients.length === 0 ? `
                    <tr><td colspan="4" style="text-align:center; padding:24px; color:#94a3b8;">No outstanding balances. All accounts cleared!</td></tr>
                  ` : data.topOutstandingClients.map(c => `
                    <tr>
                      <td>
                        <div style="font-weight: 600; color: #0f2942;">${Utils.escapeHtml(c.legal_name)}</div>
                        <div style="font-size: 11px; color: #64748b;">${Utils.escapeHtml(c.client_code)} • ${Utils.escapeHtml(c.phone || c.contact_person || '')}</div>
                      </td>
                      <td>
                        <span class="badge badge-partial">${c.pending_invoices} Bills</span>
                      </td>
                      <td style="text-align: right; font-weight: 700; color: #b45309;">
                        ${Utils.formatINR(c.outstanding_balance)}
                      </td>
                      <td style="text-align: right;">
                        <button class="btn btn-outline btn-sm" title="Statement of Account" onclick="ClientsView.openLedgerModal(${c.id})">
                          Ledger
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Recent Invoices Panel -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Recent Invoices Raised
              </span>
              <button class="btn btn-outline btn-sm" onclick="App.navigate('invoices')">
                All Invoices
              </button>
            </div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th style="text-align: right;">Amount</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.recentInvoices.length === 0 ? `
                    <tr><td colspan="5" style="text-align:center; padding:24px; color:#94a3b8;">No invoices created yet.</td></tr>
                  ` : data.recentInvoices.map(inv => `
                    <tr>
                      <td style="font-weight: 700; color: #0f2942;">
                        ${inv.invoice_number ? Utils.escapeHtml(inv.invoice_number) : `<span style="color:#64748b; font-style:italic;">Draft #${inv.id}</span>`}
                        <div style="font-size: 11px; color: #64748b; font-weight: normal;">${Utils.formatDate(inv.invoice_date)}</div>
                      </td>
                      <td style="max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${Utils.escapeHtml(inv.client_name)}
                      </td>
                      <td>${Utils.statusBadge(inv.status)}</td>
                      <td style="text-align: right; font-weight: 600;">
                        ${Utils.formatINR(inv.grand_total)}
                        ${inv.balance_amount > 0 && inv.status !== 'draft' ? `<div style="font-size:10px; color:#b45309;">Bal: ${Utils.formatINR(inv.balance_amount)}</div>` : ''}
                      </td>
                      <td style="text-align: right;">
                        <button class="btn btn-outline btn-sm" onclick="InvoiceModal.open(${inv.id})">
                          View
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- Recent Payment Collections Panel -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Recent Payment Receipts
            </span>
            <button class="btn btn-outline btn-sm" onclick="App.navigate('payments')">
              Receipt Register
            </button>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Invoice Ref</th>
                  <th>Payment Mode & Ref</th>
                  <th style="text-align: right;">Amount Realised</th>
                </tr>
              </thead>
              <tbody>
                ${data.recentPayments.length === 0 ? `
                  <tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8;">No payment receipts recorded yet.</td></tr>
                ` : data.recentPayments.map(p => `
                  <tr>
                    <td style="font-weight: 700; color: #0f2942;">${Utils.escapeHtml(p.receipt_number)}</td>
                    <td>${Utils.formatDate(p.payment_date)}</td>
                    <td style="font-weight: 600;">${Utils.escapeHtml(p.client_name)}</td>
                    <td><span class="badge badge-issued">${Utils.escapeHtml(p.invoice_number)}</span></td>
                    <td>
                      <strong>${Utils.escapeHtml(p.payment_mode)}</strong>
                      ${p.reference_number ? `<span style="color:#64748b; font-size:11px;"> • Ref: ${Utils.escapeHtml(p.reference_number)}</span>` : ''}
                    </td>
                    <td style="text-align: right; font-weight: 700; color: #047857;">
                      ${Utils.formatINR(p.amount)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="alert alert-danger">
          Failed to load dashboard: ${Utils.escapeHtml(err.message)}
        </div>
      `;
    }
  }
};
