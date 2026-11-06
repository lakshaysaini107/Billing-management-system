/**
 * Payments & Collections View
 */
const PaymentsView = {
  payments: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">Collections &amp; Receipts Register</h3>
          <p style="font-size:12.5px; color:#64748b;">Record full and partial fee collections, bank references, and issue official receipts</p>
        </div>
        <button class="btn btn-primary" onclick="PaymentsView.openRecordPaymentModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Record Payment Receipt
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="pay-search" class="form-control" placeholder="Search by receipt #, UTR / ref, or client..." />
        </div>

        <div style="min-width: 150px;">
          <select id="pay-mode-filter" class="form-control">
            <option value="all">All Payment Modes</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="UPI">UPI / QR</option>
            <option value="Cheque">Cheque</option>
            <option value="Cash">Cash</option>
            <option value="Demand Draft">Demand Draft</option>
          </select>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <input type="date" id="pay-date-from" class="form-control" style="font-size: 12px; padding: 6px 8px;" title="From Date" />
          <span style="color: #94a3b8;">to</span>
          <input type="date" id="pay-date-to" class="form-control" style="font-size: 12px; padding: 6px 8px;" title="To Date" />
        </div>

        <button class="btn btn-outline btn-sm" onclick="PaymentsView.loadPayments()">
          Apply Filter
        </button>
        <button class="btn btn-outline btn-sm" onclick="PaymentsView.exportCsv()">
          Export CSV
        </button>
      </div>

      <!-- Payments Table -->
      <div class="panel">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Receipt Number</th>
                <th>Payment Date</th>
                <th>Client Name</th>
                <th>Against Invoice</th>
                <th>Mode &amp; Transaction Ref</th>
                <th>Bank</th>
                <th style="text-align:right;">Amount Received (₹)</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody id="payments-table-body">
              <tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">Loading payments register...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('pay-search').addEventListener('input', () => PaymentsView.debouncedFilter());
    document.getElementById('pay-mode-filter').addEventListener('change', () => PaymentsView.loadPayments());

    await PaymentsView.loadPayments();
  },

  debouncedTimer: null,
  debouncedFilter() {
    clearTimeout(this.debouncedTimer);
    this.debouncedTimer = setTimeout(() => {
      this.loadPayments();
    }, 300);
  },

  async loadPayments() {
    const search = document.getElementById('pay-search')?.value || '';
    const payment_mode = document.getElementById('pay-mode-filter')?.value || 'all';
    const start_date = document.getElementById('pay-date-from')?.value || '';
    const end_date = document.getElementById('pay-date-to')?.value || '';

    try {
      const res = await API.get('/api/payments', { search, payment_mode, start_date, end_date });
      this.payments = res.payments;
      this.renderRows(res.payments);
    } catch (err) {
      Toast.error('Failed to load payments register');
    }
  },

  renderRows(payments) {
    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;

    if (!payments || payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No payment receipts found.</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map(p => `
      <tr>
        <td style="font-weight:700; color:#0f2942;">${Utils.escapeHtml(p.receipt_number)}</td>
        <td>${Utils.formatDate(p.payment_date)}</td>
        <td>
          <div style="font-weight:600; color:#0f2942;">${Utils.escapeHtml(p.client_name)}</div>
          <div style="font-size:11px; color:#64748b;">${Utils.escapeHtml(p.client_code)}</div>
        </td>
        <td>
          <span class="badge badge-issued" style="cursor:pointer;" onclick="InvoiceModal.open(${p.invoice_id})">
            ${Utils.escapeHtml(p.invoice_number)}
          </span>
          <div style="font-size:10.5px; color:#64748b; margin-top:2px;">Total: ${Utils.formatINR(p.invoice_total)}</div>
        </td>
        <td>
          <span style="font-weight:700; color:#0f2942;">${Utils.escapeHtml(p.payment_mode)}</span>
          ${p.reference_number ? `<div style="font-family:monospace; font-size:11px; color:#475569;">Ref: ${Utils.escapeHtml(p.reference_number)}</div>` : ''}
        </td>
        <td>${Utils.escapeHtml(p.bank_name || '-')}</td>
        <td style="text-align:right; font-weight:800; color:#047857; font-size:13.5px;">
          ${Utils.formatINR(p.amount)}
        </td>
        <td style="text-align:right;">
          <button class="btn btn-outline btn-sm" onclick="PaymentsView.openReceiptModal(${p.id})">
            Receipt Voucher
          </button>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Record Payment Modal
   */
  async openRecordPaymentModal(prefillInvoiceId = null) {
    const modalId = 'record-payment-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    try {
      // Fetch pending/issued/overdue invoices
      const res = await API.get('/api/invoices');
      const pendingInvoices = res.invoices.filter(i => 
        (i.status === 'issued' || i.status === 'partially_paid' || i.status === 'overdue') && i.balance_amount > 0
      );

      if (pendingInvoices.length === 0) {
        Toast.info('No pending invoices available for payment collection. All invoices are cleared!');
        return;
      }

      const selectedInv = prefillInvoiceId 
        ? pendingInvoices.find(i => i.id == prefillInvoiceId) || pendingInvoices[0]
        : pendingInvoices[0];

      const backdrop = document.createElement('div');
      backdrop.id = modalId;
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title">Record Payment Receipt</div>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
          </div>

          <form id="record-payment-form">
            <div class="modal-body">
              
              <div class="form-group">
                <label class="form-label">Select Pending Invoice *</label>
                <select id="pay-inv-select" class="form-control" onchange="PaymentsView.onInvoiceSelectChange(this)">
                  ${pendingInvoices.map(i => `
                    <option value="${i.id}" data-client="${Utils.escapeHtml(i.client_name)}" data-total="${i.grand_total}" data-balance="${i.balance_amount}" ${i.id == selectedInv.id ? 'selected' : ''}>
                      ${Utils.escapeHtml(i.invoice_number)} — ${Utils.escapeHtml(i.client_name)} (Bal: ₹${i.balance_amount})
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Invoice Balance Summary Card -->
              <div id="pay-inv-summary" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; font-size:12px; display:flex; justify-content:space-between;">
                <div>
                  <span style="color:#64748b;">Client:</span>
                  <strong id="pay-client-name" style="color:#0f2942; display:block;">${Utils.escapeHtml(selectedInv.client_name)}</strong>
                </div>
                <div>
                  <span style="color:#64748b;">Invoice Total:</span>
                  <strong id="pay-inv-total" style="color:#0f2942; display:block;">${Utils.formatINR(selectedInv.grand_total)}</strong>
                </div>
                <div>
                  <span style="color:#64748b;">Outstanding Due:</span>
                  <strong id="pay-inv-balance" style="color:#b45309; font-size:13.5px; display:block;">${Utils.formatINR(selectedInv.balance_amount)}</strong>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Receipt / Payment Date *</label>
                  <input type="date" id="pay-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Amount Received (₹) *</label>
                  <input type="number" id="pay-amount" class="form-control" required step="1" min="1" max="${selectedInv.balance_amount}" value="${selectedInv.balance_amount}" style="font-weight:700; font-size:15px; color:#047857;" />
                  <div style="font-size:11px; color:#64748b; margin-top:2px;">Partial or full receipt allowed (max: <span id="pay-max-hint">₹${selectedInv.balance_amount}</span>)</div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Payment Mode *</label>
                  <select id="pay-mode" class="form-control">
                    <option value="NEFT">NEFT (Electronic Transfer)</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI">UPI / Google Pay / PhonePe</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Bank Transfer">Bank Transfer / NetBanking</option>
                    <option value="Cash">Cash</option>
                    <option value="Demand Draft">Demand Draft</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Transaction / UTR / Cheque Ref No</label>
                  <input type="text" id="pay-ref" class="form-control" placeholder="e.g. HDFCN26288123456" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Client Remitting Bank Name</label>
                  <input type="text" id="pay-bank" class="form-control" placeholder="e.g. ICICI Bank / HDFC Bank" />
                </div>
                <div class="form-group">
                  <label class="form-label">Receipt Notes / Remarks</label>
                  <input type="text" id="pay-notes" class="form-control" placeholder="e.g. Full settlement against annual retainer" />
                </div>
              </div>

            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
              <button type="submit" id="btn-submit-pay" class="btn btn-success">
                Generate Receipt &amp; Update Balance
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(backdrop);

      document.getElementById('record-payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-pay');
        submitBtn.disabled = true;

        const payload = {
          invoice_id: Number(document.getElementById('pay-inv-select').value),
          payment_date: document.getElementById('pay-date').value,
          amount: Number(document.getElementById('pay-amount').value),
          payment_mode: document.getElementById('pay-mode').value,
          reference_number: document.getElementById('pay-ref').value.trim(),
          bank_name: document.getElementById('pay-bank').value.trim(),
          notes: document.getElementById('pay-notes').value.trim()
        };

        try {
          const result = await API.post('/api/payments', payload);
          Toast.success(result.message);
          backdrop.remove();
          PaymentsView.loadPayments();
          if (typeof InvoicesView !== 'undefined' && InvoicesView.loadInvoices) {
            InvoicesView.loadInvoices();
          }
          PaymentsView.openReceiptModal(result.payment_id);
        } catch (err) {
          Toast.error(err.message || 'Failed to record payment');
          submitBtn.disabled = false;
        }
      });

    } catch (err) {
      Toast.error('Could not open payment dialog: ' + err.message);
    }
  },

  onInvoiceSelectChange(selectEl) {
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) return;
    const client = opt.dataset.client;
    const total = Number(opt.dataset.total);
    const balance = Number(opt.dataset.balance);

    document.getElementById('pay-client-name').innerText = client;
    document.getElementById('pay-inv-total').innerText = Utils.formatINR(total);
    document.getElementById('pay-inv-balance').innerText = Utils.formatINR(balance);
    document.getElementById('pay-amount').value = balance;
    document.getElementById('pay-amount').max = balance;
    document.getElementById('pay-max-hint').innerText = `₹${balance}`;
  },

  /**
   * Printable Payment Receipt Voucher Modal
   */
  async openReceiptModal(paymentId) {
    const modalId = 'payment-receipt-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    try {
      const data = await API.get(`/api/payments/${paymentId}`);
      const p = data.payment;
      const settings = data.settings;

      const backdrop = document.createElement('div');
      backdrop.id = modalId;
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-content modal-lg">
          <div class="modal-header no-print">
            <div class="modal-title">Official Receipt Voucher: ${Utils.escapeHtml(p.receipt_number)}</div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary btn-sm" onclick="window.print()">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Print Receipt
              </button>
              <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
            </div>
          </div>

          <div class="modal-body" style="background:#e2e8f0; padding:24px;">
            <div style="background:#ffffff; max-width:680px; margin:0 auto; padding:30px 36px; border:1px solid #cbd5e1; box-shadow:var(--shadow-lg); font-size:12px; color:#1e293b;">
              
              <!-- Letterhead Header -->
              <div style="border-bottom:2px solid #c59b27; padding-bottom:12px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-family:'Cinzel', serif; font-size:22px; font-weight:800; color:#0f2942;">
                    ${Utils.escapeHtml(settings.firm_name || 'RSAINI & ASSOCIATES')}
                  </div>
                  <div style="font-size:11px; font-weight:700; color:#c59b27; letter-spacing:2px; text-transform:uppercase;">
                    PRACTICING COMPANY SECRETARIES
                  </div>
                  <div style="font-size:10px; color:#64748b; margin-top:2px;">
                    ${Utils.escapeHtml(settings.address_line1 || '')}, ${Utils.escapeHtml(settings.city || '')} • GSTIN: ${Utils.escapeHtml(settings.gstin || '')}
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="background:#0f2942; color:#ffffff; font-weight:800; font-size:12px; padding:4px 12px; border-radius:4px; letter-spacing:1px; display:inline-block;">
                    RECEIPT VOUCHER
                  </div>
                  <div style="font-weight:700; color:#0f2942; margin-top:6px; font-size:13px;">
                    ${Utils.escapeHtml(p.receipt_number)}
                  </div>
                  <div style="font-size:11px; color:#64748b;">
                    Date: ${Utils.formatDate(p.payment_date)}
                  </div>
                </div>
              </div>

              <!-- Receipt Content -->
              <div style="margin:24px 0; line-height:2; font-size:13px;">
                Received with thanks from:
                <div style="font-size:15px; font-weight:800; color:#0f2942; padding:4px 0; border-bottom:1px dotted #94a3b8;">
                  ${Utils.escapeHtml(p.client_name)} (${Utils.escapeHtml(p.client_code)})
                </div>

                <div style="display:flex; gap:16px; margin-top:12px;">
                  <div style="flex:1;">
                    The sum of Rupees:
                    <div style="font-weight:700; color:#0f2942; border-bottom:1px dotted #94a3b8;">
                      ${Utils.escapeHtml(p.amountInWords)}
                    </div>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:12px;">
                  <div>
                    Against Invoice Reference:
                    <div style="font-weight:700; color:#0f2942; border-bottom:1px dotted #94a3b8;">
                      ${Utils.escapeHtml(p.invoice_number)} (Dated: ${Utils.formatDate(p.invoice_date)})
                    </div>
                  </div>
                  <div>
                    Payment Mode &amp; Reference:
                    <div style="font-weight:700; color:#0f2942; border-bottom:1px dotted #94a3b8;">
                      ${Utils.escapeHtml(p.payment_mode)} ${p.reference_number ? `(Ref: ${Utils.escapeHtml(p.reference_number)})` : ''}
                    </div>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:12px;">
                  <div>
                    Remitting Bank:
                    <div style="font-weight:600; color:#0f2942; border-bottom:1px dotted #94a3b8;">
                      ${Utils.escapeHtml(p.bank_name || 'Direct Bank Credit')}
                    </div>
                  </div>
                  <div>
                    Invoice Remaining Balance:
                    <div style="font-weight:700; color:${p.invoice_balance > 0 ? '#b45309' : '#047857'}; border-bottom:1px dotted #94a3b8;">
                      ${p.invoice_balance > 0 ? Utils.formatINR(p.invoice_balance) : 'NIL (Fully Paid)'}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Amount Box & Signatory -->
              <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px; padding-top:20px; border-top:1px solid #e2e8f0;">
                <div style="background:#f8fafc; border:2px solid #0f2942; padding:10px 20px; border-radius:6px;">
                  <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700;">Amount Realised:</div>
                  <div style="font-size:22px; font-weight:900; color:#0f2942;">
                    ${Utils.formatINR(p.amount)}
                  </div>
                </div>

                <div style="text-align:center; width:220px;">
                  <div style="font-weight:700; color:#0f2942;">For ${Utils.escapeHtml(settings.firm_name || 'RSaini & Associates')}</div>
                  <div style="font-size:10px; color:#64748b;">Practicing Company Secretaries</div>
                  <div style="height:45px; border-bottom:1px solid #94a3b8; margin-bottom:4px;"></div>
                  <div style="font-weight:700; color:#0f2942; font-size:11px;">Authorised Signatory</div>
                </div>
              </div>

            </div>
          </div>

          <div class="modal-footer no-print">
            <button class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
    } catch (err) {
      Toast.error('Failed to load receipt voucher: ' + err.message);
    }
  },

  exportCsv() {
    if (!this.payments || !this.payments.length) {
      Toast.warning('No payments to export.');
      return;
    }

    const rows = this.payments.map(p => ({
      'Receipt Number': p.receipt_number,
      'Payment Date': p.payment_date,
      'Client Name': p.client_name,
      'Client Code': p.client_code,
      'Invoice Number': p.invoice_number,
      'Payment Mode': p.payment_mode,
      'Reference Number': p.reference_number || '',
      'Bank Name': p.bank_name || '',
      'Amount': p.amount,
      'Notes': p.notes || ''
    }));

    Utils.exportToCsv(`RSA_Collections_Register_${new Date().toISOString().split('T')[0]}.csv`, rows);
  }
};
