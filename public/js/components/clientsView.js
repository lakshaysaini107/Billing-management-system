/**
 * Clients Management View
 */
const ClientsView = {
  currentClients: [],

  async render(container, options = {}) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">Client Master Records</h3>
          <p style="font-size:12.5px; color:#64748b;">Manage corporate entities, LLPs, firms, contact persons, and client ledgers</p>
        </div>
        <button class="btn btn-primary" onclick="ClientsView.openClientModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add New Client
        </button>
      </div>

      <!-- Filters & Search Bar -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="client-search" class="form-control" placeholder="Search by name, CIN, GSTIN, contact or phone..." />
        </div>
        <div style="min-width: 180px;">
          <select id="client-entity-filter" class="form-control">
            <option value="all">All Entity Types</option>
            <option value="Private Limited Company">Private Limited Company</option>
            <option value="Limited Liability Partnership">LLP</option>
            <option value="Public Limited Company">Public Limited Company</option>
            <option value="Sole Proprietorship">Sole Proprietorship</option>
            <option value="Partnership Firm">Partnership Firm</option>
            <option value="One Person Company">One Person Company</option>
            <option value="Section 8 Company">Section 8 Company</option>
          </select>
        </div>
        <div style="min-width: 140px;">
          <select id="client-status-filter" class="form-control">
            <option value="all">All Statuses</option>
            <option value="active" selected>Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button class="btn btn-outline btn-sm" onclick="ClientsView.loadClients()">
          Apply Filter
        </button>
      </div>

      <!-- Table Container -->
      <div class="panel">
        <div class="table-responsive">
          <table class="table" id="clients-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Client Legal Name</th>
                <th>Entity Type</th>
                <th>CIN / LLPIN / GSTIN</th>
                <th>Primary Contact</th>
                <th style="text-align:right;">Billed</th>
                <th style="text-align:right;">Outstanding</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="clients-table-body">
              <tr><td colspan="9" style="text-align:center; padding:30px; color:#94a3b8;">Loading clients...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('client-search').addEventListener('input', () => ClientsView.debouncedFilter());
    document.getElementById('client-entity-filter').addEventListener('change', () => ClientsView.loadClients());
    document.getElementById('client-status-filter').addEventListener('change', () => ClientsView.loadClients());

    await ClientsView.loadClients();

    if (options && options.openNew) {
      ClientsView.openClientModal();
    }
  },

  debouncedTimer: null,
  debouncedFilter() {
    clearTimeout(this.debouncedTimer);
    this.debouncedTimer = setTimeout(() => {
      this.loadClients();
    }, 300);
  },

  async loadClients() {
    const search = document.getElementById('client-search')?.value || '';
    const entity_type = document.getElementById('client-entity-filter')?.value || 'all';
    const status = document.getElementById('client-status-filter')?.value || 'all';

    try {
      const data = await API.get('/api/clients', { search, entity_type, status });
      this.currentClients = data.clients;
      this.renderRows(data.clients);
    } catch (err) {
      Toast.error('Failed to load clients');
    }
  },

  renderRows(clients) {
    const tbody = document.getElementById('clients-table-body');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:#94a3b8;">No clients found matching your query.</td></tr>`;
      return;
    }

    tbody.innerHTML = clients.map(c => `
      <tr>
        <td style="font-weight:700; color:#0f2942;">${Utils.escapeHtml(c.client_code)}</td>
        <td>
          <div style="font-weight:600; color:#0f2942; font-size:13.5px;">${Utils.escapeHtml(c.legal_name)}</div>
          <div style="font-size:11px; color:#64748b;">${Utils.escapeHtml(c.city || '')}${c.state ? `, ${Utils.escapeHtml(c.state)}` : ''}</div>
        </td>
        <td>${Utils.clientTypeBadge(c.entity_type)}</td>
        <td>
          ${c.cin_llpin ? `<div style="font-family:monospace; font-size:11px; color:#334155;">CIN: ${Utils.escapeHtml(c.cin_llpin)}</div>` : ''}
          ${c.gstin ? `<div style="font-family:monospace; font-size:11px; color:#0369a1;">GST: ${Utils.escapeHtml(c.gstin)}</div>` : ''}
          ${!c.cin_llpin && !c.gstin ? `<span style="color:#94a3b8; font-size:11px;">Unregistered</span>` : ''}
        </td>
        <td>
          <div style="font-weight:500;">${Utils.escapeHtml(c.contact_person || '-')}</div>
          <div style="font-size:11px; color:#64748b;">${Utils.escapeHtml(c.phone || c.email || '')}</div>
        </td>
        <td style="text-align:right; font-weight:600;">
          ${Utils.formatINR(c.total_billed)}
        </td>
        <td style="text-align:right; font-weight:700; color:${c.outstanding_balance > 0 ? '#b45309' : '#059669'};">
          ${Utils.formatINR(c.outstanding_balance)}
        </td>
        <td>${Utils.statusBadge(c.status)}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-outline btn-sm" title="Statement of Account / Ledger" onclick="ClientsView.openLedgerModal(${c.id})">
            Ledger
          </button>
          <button class="btn btn-outline btn-sm" title="Edit Client Details" onclick="ClientsView.openClientModal(${c.id})">
            Edit
          </button>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Add / Edit Client Modal with Duplicate Detection
   */
  async openClientModal(clientId = null) {
    let client = {
      legal_name: '', entity_type: 'Private Limited Company',
      cin_llpin: '', gstin: '', pan: '', address: '', city: 'New Delhi',
      state: 'Delhi', state_code: '07', pincode: '110001',
      contact_person: '', designation: 'Managing Director',
      phone: '', email: '', notes: '', status: 'active'
    };

    if (clientId) {
      try {
        const res = await API.get(`/api/clients/${clientId}`);
        client = res.client;
      } catch (err) {
        Toast.error('Could not fetch client details');
        return;
      }
    }

    const modalId = 'client-form-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <div class="modal-title">
            ${clientId ? `Edit Client: ${Utils.escapeHtml(client.legal_name)} (${client.client_code})` : 'Register New Client'}
          </div>
          <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
        </div>

        <form id="client-edit-form">
          <div class="modal-body">
            <!-- Duplicate check alert container -->
            <div id="duplicate-warning-container" style="display:none;" class="alert alert-warning">
              <svg width="20" height="20" fill="none" stroke="#f59e0b" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <div id="duplicate-warning-text" style="flex:1;"></div>
            </div>

            <div class="form-row">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Client Legal Name *</label>
                <input type="text" id="inp-legal-name" class="form-control" required value="${Utils.escapeHtml(client.legal_name)}" placeholder="e.g. Apex Infotech Solutions Private Limited" />
              </div>
              <div class="form-group">
                <label class="form-label">Entity Type</label>
                <select id="inp-entity-type" class="form-control">
                  <option value="Private Limited Company" ${client.entity_type === 'Private Limited Company' ? 'selected' : ''}>Private Limited Company</option>
                  <option value="Limited Liability Partnership" ${client.entity_type === 'Limited Liability Partnership' ? 'selected' : ''}>Limited Liability Partnership (LLP)</option>
                  <option value="Public Limited Company" ${client.entity_type === 'Public Limited Company' ? 'selected' : ''}>Public Limited Company</option>
                  <option value="One Person Company" ${client.entity_type === 'One Person Company' ? 'selected' : ''}>One Person Company (OPC)</option>
                  <option value="Sole Proprietorship" ${client.entity_type === 'Sole Proprietorship' ? 'selected' : ''}>Sole Proprietorship</option>
                  <option value="Partnership Firm" ${client.entity_type === 'Partnership Firm' ? 'selected' : ''}>Partnership Firm</option>
                  <option value="Section 8 Company" ${client.entity_type === 'Section 8 Company' ? 'selected' : ''}>Section 8 Company</option>
                  <option value="Trust / Society" ${client.entity_type === 'Trust / Society' ? 'selected' : ''}>Trust / Society</option>
                  <option value="Individual" ${client.entity_type === 'Individual' ? 'selected' : ''}>Individual</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">CIN / LLPIN (if applicable)</label>
                <input type="text" id="inp-cin" class="form-control" value="${Utils.escapeHtml(client.cin_llpin || '')}" placeholder="e.g. U72200DL2021PTC123456" />
              </div>
              <div class="form-group">
                <label class="form-label">GSTIN (15 Digits)</label>
                <input type="text" id="inp-gstin" class="form-control" maxlength="15" value="${Utils.escapeHtml(client.gstin || '')}" placeholder="e.g. 07AAAAA0000A1Z5" />
              </div>
              <div class="form-group">
                <label class="form-label">Permanent Account Number (PAN)</label>
                <input type="text" id="inp-pan" class="form-control" maxlength="10" value="${Utils.escapeHtml(client.pan || '')}" placeholder="e.g. AAAAA0000A" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Registered Office Address</label>
              <textarea id="inp-address" class="form-control" rows="2" placeholder="Building, Street, Area">${Utils.escapeHtml(client.address || '')}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">City</label>
                <input type="text" id="inp-city" class="form-control" value="${Utils.escapeHtml(client.city || 'New Delhi')}" />
              </div>
              <div class="form-group">
                <label class="form-label">State</label>
                <input type="text" id="inp-state" class="form-control" value="${Utils.escapeHtml(client.state || 'Delhi')}" />
              </div>
              <div class="form-group">
                <label class="form-label">State Code (GST)</label>
                <input type="text" id="inp-state-code" class="form-control" value="${Utils.escapeHtml(client.state_code || '07')}" placeholder="e.g. 07" />
              </div>
              <div class="form-group">
                <label class="form-label">PIN Code</label>
                <input type="text" id="inp-pincode" class="form-control" value="${Utils.escapeHtml(client.pincode || '')}" placeholder="110001" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Contact Person</label>
                <input type="text" id="inp-contact" class="form-control" value="${Utils.escapeHtml(client.contact_person || '')}" placeholder="Mr. / Ms." />
              </div>
              <div class="form-group">
                <label class="form-label">Designation</label>
                <input type="text" id="inp-designation" class="form-control" value="${Utils.escapeHtml(client.designation || '')}" placeholder="Director / Partner" />
              </div>
              <div class="form-group">
                <label class="form-label">Phone / Mobile</label>
                <input type="text" id="inp-phone" class="form-control" value="${Utils.escapeHtml(client.phone || '')}" placeholder="+91 ..." />
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" id="inp-email" class="form-control" value="${Utils.escapeHtml(client.email || '')}" placeholder="accounts@client.com" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label">Practice Notes / Retainership Details</label>
                <input type="text" id="inp-notes" class="form-control" value="${Utils.escapeHtml(client.notes || '')}" placeholder="Special instructions, compliance cycle..." />
              </div>
              ${clientId ? `
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Client Status</label>
                  <select id="inp-status" class="form-control">
                    <option value="active" ${client.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${client.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
            <button type="submit" id="btn-save-client" class="btn btn-primary">
              ${clientId ? 'Save Client Changes' : 'Create Client Record'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Live duplicate check listener
    const runDupCheck = async () => {
      const cin = document.getElementById('inp-cin').value.trim();
      const gstin = document.getElementById('inp-gstin').value.trim();
      const phone = document.getElementById('inp-phone').value.trim();
      const name = document.getElementById('inp-legal-name').value.trim();

      if (!cin && !gstin && !phone && !name) return;

      try {
        const res = await API.get('/api/clients/check-duplicate', {
          cin_llpin: cin,
          gstin: gstin,
          phone: phone,
          legal_name: name,
          exclude_id: clientId || ''
        });

        const warnBox = document.getElementById('duplicate-warning-container');
        const warnText = document.getElementById('duplicate-warning-text');
        if (res.hasDuplicate) {
          warnBox.style.display = 'flex';
          warnText.innerHTML = `<strong>FR-03 Duplicate Warning:</strong><br>${res.warnings.join('<br>')}`;
        } else {
          warnBox.style.display = 'none';
        }
      } catch (e) {
        // Silent
      }
    };

    document.getElementById('inp-cin').addEventListener('blur', runDupCheck);
    document.getElementById('inp-gstin').addEventListener('blur', runDupCheck);
    document.getElementById('inp-phone').addEventListener('blur', runDupCheck);

    // Auto extract State Code from GSTIN (first 2 digits)
    document.getElementById('inp-gstin').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val.length >= 2 && !isNaN(val.substring(0, 2))) {
        document.getElementById('inp-state-code').value = val.substring(0, 2);
      }
      if (val.length >= 10) {
        // Characters 3 to 12 of GSTIN is PAN
        const panPart = val.substring(2, 12);
        if (!document.getElementById('inp-pan').value) {
          document.getElementById('inp-pan').value = panPart;
        }
      }
    });

    document.getElementById('client-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-client');
      btn.disabled = true;

      const payload = {
        legal_name: document.getElementById('inp-legal-name').value.trim(),
        entity_type: document.getElementById('inp-entity-type').value,
        cin_llpin: document.getElementById('inp-cin').value.trim(),
        gstin: document.getElementById('inp-gstin').value.trim(),
        pan: document.getElementById('inp-pan').value.trim(),
        address: document.getElementById('inp-address').value.trim(),
        city: document.getElementById('inp-city').value.trim(),
        state: document.getElementById('inp-state').value.trim(),
        state_code: document.getElementById('inp-state-code').value.trim(),
        pincode: document.getElementById('inp-pincode').value.trim(),
        contact_person: document.getElementById('inp-contact').value.trim(),
        designation: document.getElementById('inp-designation').value.trim(),
        phone: document.getElementById('inp-phone').value.trim(),
        email: document.getElementById('inp-email').value.trim(),
        notes: document.getElementById('inp-notes').value.trim(),
        status: document.getElementById('inp-status') ? document.getElementById('inp-status').value : 'active'
      };

      try {
        if (clientId) {
          await API.put(`/api/clients/${clientId}`, payload);
          Toast.success('Client updated successfully');
        } else {
          await API.post('/api/clients', payload);
          Toast.success('New client created successfully');
        }
        backdrop.remove();
        ClientsView.loadClients();
      } catch (err) {
        Toast.error(err.message || 'Failed to save client');
        btn.disabled = false;
      }
    });
  },

  /**
   * Client Statement & Ledger Modal
   */
  async openLedgerModal(clientId) {
    const modalId = 'client-ledger-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    try {
      const data = await API.get(`/api/clients/${clientId}/ledger`);
      const client = data.client;
      const ledger = data.ledger;
      const summary = data.summary;

      const backdrop = document.createElement('div');
      backdrop.id = modalId;
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-content modal-xl">
          <div class="modal-header">
            <div>
              <div class="modal-title">Client Statement of Account: ${Utils.escapeHtml(client.legal_name)}</div>
              <div style="font-size: 11.5px; color: #64748b;">Code: ${client.client_code} • ${client.city}, ${client.state} • GSTIN: ${client.gstin || 'Unregistered'}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline btn-sm" onclick="window.print()">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Print Statement
              </button>
              <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
            </div>
          </div>

          <div class="modal-body">
            <!-- Summary Badges -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px;">
                <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Total Billed (Debits)</div>
                <div style="font-size:18px; font-weight:800; color:#0f2942;">${Utils.formatINR(summary.totalBilled)}</div>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px;">
                <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Total Realised (Credits)</div>
                <div style="font-size:18px; font-weight:800; color:#047857;">${Utils.formatINR(summary.totalPaid)}</div>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px;">
                <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Net Balance Due</div>
                <div style="font-size:18px; font-weight:800; color:${summary.closingBalance > 0 ? '#b45309' : '#047857'};">${Utils.formatINR(summary.closingBalance)}</div>
              </div>
            </div>

            <!-- Ledger Table -->
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference / Voucher</th>
                    <th>Particulars</th>
                    <th style="text-align:right;">Debit (₹)</th>
                    <th style="text-align:right;">Credit (₹)</th>
                    <th style="text-align:right;">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  ${ledger.length === 0 ? `
                    <tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No billing or payment transactions recorded for this client yet.</td></tr>
                  ` : ledger.map(tx => `
                    <tr>
                      <td>${tx.serialNo}</td>
                      <td>${Utils.formatDate(tx.transaction_date)}</td>
                      <td>
                        ${tx.type === 'INVOICE' 
                          ? '<span class="badge badge-issued">INVOICE</span>' 
                          : '<span class="badge badge-paid">PAYMENT</span>'}
                      </td>
                      <td style="font-weight:700;">${Utils.escapeHtml(tx.reference_number)}</td>
                      <td>${Utils.escapeHtml(tx.particulars)}</td>
                      <td style="text-align:right; font-weight:600; color:${tx.debit > 0 ? '#0f2942' : '#94a3b8'};">
                        ${tx.debit > 0 ? Utils.formatINR(tx.debit) : '-'}
                      </td>
                      <td style="text-align:right; font-weight:600; color:${tx.credit > 0 ? '#047857' : '#94a3b8'};">
                        ${tx.credit > 0 ? Utils.formatINR(tx.credit) : '-'}
                      </td>
                      <td style="text-align:right; font-weight:700; color:${tx.balance > 0 ? '#b45309' : '#047857'};">
                        ${Utils.formatINR(tx.balance)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:#f1f5f9; font-weight:700;">
                    <td colspan="5" style="text-align:right;">Closing Balance:</td>
                    <td style="text-align:right;">${Utils.formatINR(summary.totalBilled)}</td>
                    <td style="text-align:right; color:#047857;">${Utils.formatINR(summary.totalPaid)}</td>
                    <td style="text-align:right; color:${summary.closingBalance > 0 ? '#b45309' : '#047857'};">${Utils.formatINR(summary.closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
    } catch (err) {
      Toast.error('Failed to load ledger: ' + err.message);
    }
  }
};
