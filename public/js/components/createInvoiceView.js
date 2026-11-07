/**
 * Create / Edit Invoice View
 */
const CreateInvoiceView = {
  clients: [],
  services: [],
  settings: {},
  currentDraftId: null,

  async render(container, invoiceId = null) {
    this.currentDraftId = invoiceId;

    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height:300px;">
        <div style="text-align:center; color:#64748b;">
          <div style="font-size:24px; margin-bottom:8px;">⏳</div>
          Loading Invoice Builder...
        </div>
      </div>
    `;

    try {
      // Load dependencies in parallel
      const [clientsRes, servicesRes, settingsRes] = await Promise.all([
        API.get('/api/clients', { status: 'active' }),
        API.get('/api/services', { active_only: 'true' }),
        API.get('/api/settings')
      ]);

      this.clients = clientsRes.clients;
      this.services = servicesRes.services;
      this.settings = settingsRes.settings;

      let initialData = {
        client_id: this.clients[0]?.id || '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        supply_type: 'intra_state',
        place_of_supply: '07-Delhi',
        discount_type: 'fixed',
        discount_value: 0,
        notes: '',
        terms: this.settings.invoice_terms || '',
        items: [
          {
            service_id: this.services[0]?.id || null,
            service_code: this.services[0]?.code || '',
            item_name: this.services[0]?.name || 'Professional Retainership Services',
            sac_code: this.services[0]?.sac_code || '998242',
            description: this.services[0]?.description || '',
            quantity: 1,
            rate: this.services[0]?.default_fee || 15000,
            discount_percent: 0,
            tax_rate: 18
          }
        ]
      };

      if (invoiceId) {
        const invDetail = await API.get(`/api/invoices/${invoiceId}`);
        const inv = invDetail.invoice;
        if (inv.status !== 'draft') {
          Toast.error('Only draft invoices can be edited.');
          App.navigate('invoices');
          return;
        }

        initialData = {
          client_id: inv.client_id,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          supply_type: inv.supply_type || 'intra_state',
          place_of_supply: inv.place_of_supply,
          discount_type: inv.discount_type || 'fixed',
          discount_value: inv.discount_value || 0,
          notes: inv.notes || '',
          terms: inv.terms || this.settings.invoice_terms,
          items: invDetail.items.map(it => ({
            service_id: it.service_id,
            service_code: it.service_code,
            item_name: it.item_name,
            sac_code: it.sac_code,
            description: it.description,
            quantity: it.quantity,
            rate: it.rate,
            discount_percent: it.discount_percent,
            tax_rate: it.tax_rate
          }))
        };
      }

      this.renderForm(container, initialData);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Failed to initialize invoice builder: ${Utils.escapeHtml(err.message)}</div>`;
    }
  },

  renderForm(container, data) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">
            ${this.currentDraftId ? `Editing Draft Invoice #${this.currentDraftId}` : 'Create Professional Invoice'}
          </h3>
          <p style="font-size:12.5px; color:#64748b;">Prepare invoice for Practicing Company Secretary services on approved letterhead</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-outline" onclick="App.navigate('invoices')">Cancel</button>
          <button class="btn btn-outline" id="btn-save-draft" onclick="CreateInvoiceView.saveInvoice('save_draft')">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
            Save as Draft
          </button>
          <button class="btn btn-primary" id="btn-issue-now" onclick="CreateInvoiceView.saveInvoice('issue')">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Issue Invoice Immediately
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">1. Client &amp; Billing Details</span>
        </div>
        <div class="panel-body">
          <div class="form-row">
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Select Client *</label>
              <select id="inv-client-select" class="form-control" onchange="CreateInvoiceView.handleClientChange()">
                ${this.clients.map(c => `
                  <option value="${c.id}" ${c.id == data.client_id ? 'selected' : ''}>
                    ${Utils.escapeHtml(c.legal_name)} (${c.client_code}) - ${c.city}, ${c.state}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Invoice Date *</label>
              <input type="date" id="inv-date" class="form-control" value="${data.invoice_date}" onchange="CreateInvoiceView.recalculate()" />
            </div>
            <div class="form-group">
              <label class="form-label">Due Date *</label>
              <input type="date" id="inv-due-date" class="form-control" value="${data.due_date}" />
            </div>
          </div>

          <!-- Client Auto Info Card -->
          <div id="client-info-preview" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:16px; font-size:12px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
            <!-- Rendered by handleClientChange -->
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">GST Supply Type</label>
              <select id="inv-supply-type" class="form-control" onchange="CreateInvoiceView.recalculate()">
                <option value="intra_state" ${data.supply_type === 'intra_state' ? 'selected' : ''}>Intra-State (CGST 9% + SGST 9%)</option>
                <option value="inter_state" ${data.supply_type === 'inter_state' ? 'selected' : ''}>Inter-State (IGST 18%)</option>
                <option value="exempt" ${data.supply_type === 'exempt' ? 'selected' : ''}>Exempt / Non-Taxable Supply (0%)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Place of Supply (State &amp; Code)</label>
              <input type="text" id="inv-place-supply" class="form-control" value="${Utils.escapeHtml(data.place_of_supply || '07-Delhi')}" />
            </div>
          </div>
        </div>
      </div>

      <!-- Line Items Panel -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">2. Professional Service Line Items</span>
          <button class="btn btn-outline btn-sm" onclick="CreateInvoiceView.addItemRow()">
            + Add Another Service Line
          </button>
        </div>
        <div class="panel-body" style="padding:0;">
          <div class="table-responsive">
            <table class="table" id="line-items-table">
              <thead>
                <tr>
                  <th style="width:40px;">#</th>
                  <th style="min-width:240px;">Service / Item Name</th>
                  <th style="width:110px;">SAC Code</th>
                  <th style="width:90px; text-align:right;">Qty</th>
                  <th style="width:130px; text-align:right;">Fee Rate (₹)</th>
                  <th style="width:90px; text-align:right;">Disc %</th>
                  <th style="width:130px; text-align:right;">Taxable (₹)</th>
                  <th style="width:110px;">GST %</th>
                  <th style="width:130px; text-align:right;">Line Total (₹)</th>
                  <th style="width:50px; text-align:center;"></th>
                </tr>
              </thead>
              <tbody id="line-items-body">
                <!-- Dynamically rendered -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Totals & Notes Section -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:24px; margin-bottom:24px;">
        
        <!-- Left: Notes & Terms -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">3. Invoice Remarks &amp; Terms</span>
          </div>
          <div class="panel-body">
            <div class="form-group">
              <label class="form-label">Invoice Notes / Description for Client</label>
              <textarea id="inv-notes" class="form-control" rows="3" placeholder="e.g. Annual filing for FY 2025-26 and certification of e-forms AOC-4 and MGT-7.">${Utils.escapeHtml(data.notes || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Terms &amp; Conditions (appears on invoice)</label>
              <textarea id="inv-terms" class="form-control" rows="4">${Utils.escapeHtml(data.terms || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- Right: Real-time Live Calculations -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">4. Calculations &amp; Tax Summary</span>
          </div>
          <div class="panel-body">
            
            <div class="inv-total-row">
              <span style="color:#64748b;">Subtotal (Taxable Value of Services):</span>
              <strong id="calc-subtotal" style="color:#0f2942;">₹0.00</strong>
            </div>

            <div class="inv-total-row" style="align-items:center;">
              <span style="color:#64748b; display:flex; align-items:center; gap:8px;">
                Special Discount:
                <select id="inv-discount-type" class="form-control" style="width:100px; padding:2px 6px; font-size:12px;" onchange="CreateInvoiceView.recalculate()">
                  <option value="fixed" ${data.discount_type === 'fixed' ? 'selected' : ''}>Fixed (₹)</option>
                  <option value="percentage" ${data.discount_type === 'percentage' ? 'selected' : ''}>Percent (%)</option>
                </select>
              </span>
              <input type="number" id="inv-discount-val" class="form-control" style="width:110px; text-align:right; padding:4px 8px;" min="0" value="${data.discount_value}" oninput="CreateInvoiceView.recalculate()" />
            </div>

            <div class="inv-total-row">
              <span style="color:#64748b;">Discount Amount:</span>
              <span id="calc-discount" style="color:#dc2626;">- ₹0.00</span>
            </div>

            <div class="inv-total-row" style="background:#f8fafc;">
              <span style="font-weight:600;">Net Taxable Base:</span>
              <strong id="calc-taxable" style="font-weight:700;">₹0.00</strong>
            </div>

            <div id="calc-tax-breakdown">
              <!-- Dynamically rendered taxes (CGST+SGST or IGST) -->
            </div>

            <div class="inv-total-row">
              <span style="color:#64748b;">Round Off Adjustment:</span>
              <span id="calc-roundoff">₹0.00</span>
            </div>

            <div class="inv-total-row grand-total" style="background:#0f2942; color:#ffffff; padding:12px 14px; border-radius:6px; margin-top:8px;">
              <span style="font-size:14px; font-weight:700;">Grand Total Payable:</span>
              <span id="calc-grandtotal" style="font-size:18px; font-weight:800; color:#e5be4a;">₹0.00</span>
            </div>

            <!-- Amount in words preview -->
            <div style="margin-top:14px; padding:10px 14px; background:#fef9ed; border:1px solid #f3d068; border-radius:6px;">
              <div style="font-size:10.5px; text-transform:uppercase; color:#855d04; font-weight:700; letter-spacing:0.5px;">Amount in Words (INR):</div>
              <div id="calc-words" style="font-size:12px; font-weight:700; color:#0f2942; margin-top:2px;">Zero Rupees Only</div>
            </div>

          </div>
        </div>

      </div>
    `;

    // Render items rows
    const tbody = document.getElementById('line-items-body');
    tbody.innerHTML = '';
    data.items.forEach((item, index) => {
      this.renderItemRow(tbody, item, index);
    });

    this.handleClientChange(false);
    this.recalculate();
  },

  handleClientChange(shouldRecalc = true) {
    const clientId = document.getElementById('inv-client-select').value;
    const client = this.clients.find(c => c.id == clientId);
    if (!client) return;

    const preview = document.getElementById('client-info-preview');
    if (preview) {
      preview.innerHTML = `
        <div>
          <span style="color:#64748b; font-weight:600;">Legal Entity:</span>
          <div style="font-weight:700; color:#0f2942;">${Utils.escapeHtml(client.legal_name)}</div>
          <div style="color:#64748b;">${Utils.escapeHtml(client.entity_type)}</div>
        </div>
        <div>
          <span style="color:#64748b; font-weight:600;">Identification:</span>
          <div>${client.cin_llpin ? `CIN: <span style="font-family:monospace; font-weight:600;">${Utils.escapeHtml(client.cin_llpin)}</span>` : '<span style="color:#94a3b8;">No CIN</span>'}</div>
          <div>${client.gstin ? `GST: <span style="font-family:monospace; font-weight:600; color:#0369a1;">${Utils.escapeHtml(client.gstin)}</span>` : '<span style="color:#94a3b8;">Unregistered</span>'}</div>
        </div>
        <div>
          <span style="color:#64748b; font-weight:600;">Address &amp; State:</span>
          <div>${Utils.escapeHtml(client.city || '')}, ${Utils.escapeHtml(client.state || '')} - ${Utils.escapeHtml(client.pincode || '')}</div>
          <div style="color:#0f2942; font-weight:600;">State Code: ${Utils.escapeHtml(client.state_code || '07')}</div>
        </div>
        <div>
          <span style="color:#64748b; font-weight:600;">Contact Person:</span>
          <div>${Utils.escapeHtml(client.contact_person || '-')}</div>
          <div style="color:#64748b;">${Utils.escapeHtml(client.phone || client.email || '')}</div>
        </div>
      `;
    }

    // Auto set Place of Supply and Supply Type based on State
    const firmStateCode = this.settings.state_code || '07';
    const clientStateCode = client.state_code || '07';

    document.getElementById('inv-place-supply').value = `${clientStateCode}-${client.state || 'Delhi'}`;

    if (clientStateCode === firmStateCode) {
      document.getElementById('inv-supply-type').value = 'intra_state';
    } else {
      document.getElementById('inv-supply-type').value = 'inter_state';
    }

    if (shouldRecalc) {
      this.recalculate();
    }
  },

  addItemRow() {
    const tbody = document.getElementById('line-items-body');
    const idx = tbody.children.length;
    const defaultService = this.services[0] || {};

    const newItem = {
      service_id: defaultService.id || null,
      service_code: defaultService.code || '',
      item_name: defaultService.name || 'Company Secretarial Service',
      sac_code: defaultService.sac_code || '998242',
      description: defaultService.description || '',
      quantity: 1,
      rate: defaultService.default_fee || 5000,
      discount_percent: 0,
      tax_rate: 18
    };

    this.renderItemRow(tbody, newItem, idx);
    this.recalculate();
  },

  renderItemRow(tbody, item, index) {
    const row = document.createElement('tr');
    row.className = 'line-item-row';
    row.dataset.index = index;

    row.innerHTML = `
      <td style="font-weight:700; color:#64748b; text-align:center;">${index + 1}</td>
      <td>
        <div style="margin-bottom:6px;">
          <select class="form-control item-service-select" style="font-size:12px; padding:4px 8px; font-weight:600; color:#0f2942;" onchange="CreateInvoiceView.onServiceSelect(this)">
            <option value="">-- Custom Line Item --</option>
            ${this.services.map(s => `
              <option value="${s.id}" ${s.id == item.service_id ? 'selected' : ''} data-sac="${s.sac_code}" data-fee="${s.default_fee}" data-tax="${s.default_tax_rate}" data-desc="${Utils.escapeHtml(s.description)}">
                ${Utils.escapeHtml(s.name)} [₹${s.default_fee}]
              </option>
            `).join('')}
          </select>
        </div>
        <input type="text" class="form-control item-name" style="font-weight:600; margin-bottom:4px;" value="${Utils.escapeHtml(item.item_name)}" placeholder="Service item title" oninput="CreateInvoiceView.recalculate()" />
        <textarea class="form-control item-desc" rows="2" style="font-size:11.5px;" placeholder="Scope of service or statutory filing details...">${Utils.escapeHtml(item.description || '')}</textarea>
      </td>
      <td>
        <input type="text" class="form-control item-sac" style="font-family:monospace; font-size:12px;" value="${Utils.escapeHtml(item.sac_code || '998242')}" />
      </td>
      <td>
        <input type="number" class="form-control item-qty" style="text-align:right;" min="0.01" step="1" value="${item.quantity}" oninput="CreateInvoiceView.recalculate()" />
      </td>
      <td>
        <input type="number" class="form-control item-rate" style="text-align:right; font-weight:600;" min="0" step="100" value="${item.rate}" oninput="CreateInvoiceView.recalculate()" />
      </td>
      <td>
        <input type="number" class="form-control item-disc" style="text-align:right;" min="0" max="100" step="1" value="${item.discount_percent}" oninput="CreateInvoiceView.recalculate()" />
      </td>
      <td style="text-align:right; font-weight:600; vertical-align:middle;">
        <span class="item-taxable-display">₹0.00</span>
      </td>
      <td>
        <select class="form-control item-tax-rate" style="font-size:12px; padding:4px 6px;" onchange="CreateInvoiceView.recalculate()">
          <option value="18" ${item.tax_rate == 18 ? 'selected' : ''}>18%</option>
          <option value="12" ${item.tax_rate == 12 ? 'selected' : ''}>12%</option>
          <option value="5" ${item.tax_rate == 5 ? 'selected' : ''}>5%</option>
          <option value="0" ${item.tax_rate == 0 ? 'selected' : ''}>0%</option>
        </select>
      </td>
      <td style="text-align:right; font-weight:700; color:#0f2942; vertical-align:middle;">
        <span class="item-total-display">₹0.00</span>
      </td>
      <td style="text-align:center; vertical-align:middle;">
        <button type="button" class="btn btn-icon" style="color:#ef4444;" title="Remove Line Item" onclick="CreateInvoiceView.removeItemRow(this)">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    `;

    tbody.appendChild(row);
  },

  onServiceSelect(selectEl) {
    const row = selectEl.closest('tr');
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;

    row.querySelector('.item-name').value = selectedOption.text.split(' [₹')[0];
    row.querySelector('.item-sac').value = selectedOption.dataset.sac || '998242';
    row.querySelector('.item-rate').value = selectedOption.dataset.fee || 0;
    row.querySelector('.item-desc').value = selectedOption.dataset.desc || '';
    if (selectedOption.dataset.tax) {
      row.querySelector('.item-tax-rate').value = selectedOption.dataset.tax;
    }

    this.recalculate();
  },

  removeItemRow(buttonEl) {
    const tbody = document.getElementById('line-items-body');
    if (tbody.children.length <= 1) {
      Toast.warning('At least one service line item is required on the invoice.');
      return;
    }
    buttonEl.closest('tr').remove();

    // Renumber
    Array.from(tbody.children).forEach((r, i) => {
      r.children[0].innerText = i + 1;
    });

    this.recalculate();
  },

  recalculate() {
    const rows = Array.from(document.querySelectorAll('.line-item-row'));
    const supplyType = document.getElementById('inv-supply-type')?.value || 'intra_state';
    const discountType = document.getElementById('inv-discount-type')?.value || 'fixed';
    const discountVal = Number(document.getElementById('inv-discount-val')?.value) || 0;

    let subtotal = 0;

    rows.forEach(r => {
      const qty = Math.max(0.01, Number(r.querySelector('.item-qty')?.value) || 1);
      const rate = Number(r.querySelector('.item-rate')?.value) || 0;
      const discPct = Math.min(100, Math.max(0, Number(r.querySelector('.item-disc')?.value) || 0));
      const taxRate = supplyType === 'exempt' ? 0 : Number(r.querySelector('.item-tax-rate')?.value || 18);

      const gross = qty * rate;
      const itemDisc = (gross * discPct) / 100;
      const taxable = Math.round((gross - itemDisc) * 100) / 100;
      const taxAmt = Math.round((taxable * (taxRate / 100)) * 100) / 100;
      const total = Math.round((taxable + taxAmt) * 100) / 100;

      subtotal += taxable;

      r.querySelector('.item-taxable-display').innerText = Utils.formatINR(taxable);
      r.querySelector('.item-total-display').innerText = Utils.formatINR(total);
    });

    subtotal = Math.round(subtotal * 100) / 100;

    let discAmount = 0;
    if (discountType === 'percentage') {
      discAmount = Math.round((subtotal * (discountVal / 100)) * 100) / 100;
    } else {
      discAmount = Math.round(discountVal * 100) / 100;
    }
    if (discAmount > subtotal) discAmount = subtotal;

    const taxableBase = Math.round((subtotal - discAmount) * 100) / 100;

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (supplyType === 'intra_state') {
      cgstAmt = Math.round((taxableBase * 0.09) * 100) / 100;
      sgstAmt = Math.round((taxableBase * 0.09) * 100) / 100;
    } else if (supplyType === 'inter_state') {
      igstAmt = Math.round((taxableBase * 0.18) * 100) / 100;
    }

    const totalTax = Math.round((cgstAmt + sgstAmt + igstAmt) * 100) / 100;
    const rawGrand = taxableBase + totalTax;
    const roundedGrand = Math.round(rawGrand);
    const roundOff = Math.round((roundedGrand - rawGrand) * 100) / 100;

    document.getElementById('calc-subtotal').innerText = Utils.formatINR(subtotal);
    document.getElementById('calc-discount').innerText = `- ${Utils.formatINR(discAmount)}`;
    document.getElementById('calc-taxable').innerText = Utils.formatINR(taxableBase);

    // Tax breakdown container
    const taxContainer = document.getElementById('calc-tax-breakdown');
    if (supplyType === 'intra_state') {
      taxContainer.innerHTML = `
        <div class="inv-total-row">
          <span style="color:#64748b;">Central GST (CGST @ 9%):</span>
          <span>${Utils.formatINR(cgstAmt)}</span>
        </div>
        <div class="inv-total-row">
          <span style="color:#64748b;">State GST (SGST @ 9%):</span>
          <span>${Utils.formatINR(sgstAmt)}</span>
        </div>
      `;
    } else if (supplyType === 'inter_state') {
      taxContainer.innerHTML = `
        <div class="inv-total-row">
          <span style="color:#64748b;">Integrated GST (IGST @ 18%):</span>
          <span>${Utils.formatINR(igstAmt)}</span>
        </div>
      `;
    } else {
      taxContainer.innerHTML = `
        <div class="inv-total-row">
          <span style="color:#64748b;">GST Exempt / Non-Taxable:</span>
          <span>₹0.00</span>
        </div>
      `;
    }

    document.getElementById('calc-roundoff').innerText = `${roundOff >= 0 ? '+' : ''}${Utils.formatINR(roundOff)}`;
    document.getElementById('calc-grandtotal').innerText = Utils.formatINR(roundedGrand);
    document.getElementById('calc-words').innerText = Utils.numberToWords(roundedGrand);
  },

  async saveInvoice(action = 'save_draft') {
    const clientId = document.getElementById('inv-client-select').value;
    if (!clientId) {
      Toast.error('Please select a client.');
      return;
    }

    const rows = Array.from(document.querySelectorAll('.line-item-row'));
    if (!rows.length) {
      Toast.error('At least one service line item is required.');
      return;
    }

    const items = rows.map((r, i) => {
      const select = r.querySelector('.item-service-select');
      return {
        service_id: select.value ? Number(select.value) : null,
        service_code: select.options[select.selectedIndex]?.dataset.code || '',
        item_name: r.querySelector('.item-name').value.trim() || 'Professional Service',
        sac_code: r.querySelector('.item-sac').value.trim() || '998242',
        description: r.querySelector('.item-desc').value.trim(),
        quantity: Math.max(0.01, Number(r.querySelector('.item-qty').value) || 1),
        rate: Number(r.querySelector('.item-rate').value) || 0,
        discount_percent: Number(r.querySelector('.item-disc').value) || 0,
        tax_rate: Number(r.querySelector('.item-tax-rate').value) || 18,
        sort_order: i + 1
      };
    });

    const payload = {
      client_id: Number(clientId),
      invoice_date: document.getElementById('inv-date').value,
      due_date: document.getElementById('inv-due-date').value,
      supply_type: document.getElementById('inv-supply-type').value,
      place_of_supply: document.getElementById('inv-place-supply').value,
      discount_type: document.getElementById('inv-discount-type').value,
      discount_value: Number(document.getElementById('inv-discount-val').value) || 0,
      notes: document.getElementById('inv-notes').value.trim(),
      terms: document.getElementById('inv-terms').value.trim(),
      action: action, // 'save_draft' or 'issue'
      items
    };

    const draftBtn = document.getElementById('btn-save-draft');
    const issueBtn = document.getElementById('btn-issue-now');
    draftBtn.disabled = true;
    issueBtn.disabled = true;

    try {
      if (this.currentDraftId) {
        if (action === 'issue') {
          // Update draft first, then issue
          await API.put(`/api/invoices/${this.currentDraftId}`, payload);
          const issueRes = await API.post(`/api/invoices/${this.currentDraftId}/issue`);
          Toast.success(`Invoice ${issueRes.invoice_number} issued successfully!`);
          InvoiceModal.open(this.currentDraftId);
          App.navigate('invoices');
        } else {
          await API.put(`/api/invoices/${this.currentDraftId}`, payload);
          Toast.success('Draft invoice updated successfully');
          App.navigate('invoices');
        }
      } else {
        const res = await API.post('/api/invoices', payload);
        Toast.success(res.message);
        if (action === 'issue') {
          InvoiceModal.open(res.invoice_id);
        }
        App.navigate('invoices');
      }
    } catch (err) {
      Toast.error(err.message || 'Failed to save invoice');
      draftBtn.disabled = false;
      issueBtn.disabled = false;
    }
  }
};

