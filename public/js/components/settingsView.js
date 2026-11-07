/**
 * Settings & System Administration View
 */
const SettingsView = {
  currentTab: 'firm',
  settings: {},

  async render(container, options = {}) {
    this.currentTab = (options && options.tab) || 'firm';

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">Practice Configuration &amp; Settings</h3>
          <p style="font-size:12.5px; color:#64748b;">Configure firm credentials, letterhead artwork, bank remittance, and system backups</p>
        </div>
      </div>

      <!-- Settings Tabs -->
      <div class="tabs-header">
        <button class="tab-btn ${this.currentTab === 'firm' ? 'active' : ''}" onclick="SettingsView.switchTab('firm')">
          Firm Profile &amp; PCS
        </button>
        <button class="tab-btn ${this.currentTab === 'bank' ? 'active' : ''}" onclick="SettingsView.switchTab('bank')">
          Bank &amp; Remittance (UPI)
        </button>
        <button class="tab-btn ${this.currentTab === 'numbering' ? 'active' : ''}" onclick="SettingsView.switchTab('numbering')">
          Invoice Numbering &amp; FY
        </button>
        <button class="tab-btn ${this.currentTab === 'letterhead' ? 'active' : ''}" onclick="SettingsView.switchTab('letterhead')">
          Letterhead &amp; Print
        </button>
        <button class="tab-btn ${this.currentTab === 'users' ? 'active' : ''}" onclick="SettingsView.switchTab('users')">
          User Accounts
        </button>
        <button class="tab-btn ${this.currentTab === 'backup' ? 'active' : ''}" onclick="SettingsView.switchTab('backup')">
          Backup &amp; Restore
        </button>
      </div>

      <div id="settings-tab-content">
        <!-- Dynamic content -->
      </div>
    `;

    try {
      const res = await API.get('/api/settings');
      this.settings = res.settings;
      this.renderCurrentTab();
    } catch (err) {
      Toast.error('Failed to load settings');
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tabs-header .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tab.toLowerCase()));
    });
    this.renderCurrentTab();
  },

  renderCurrentTab() {
    const container = document.getElementById('settings-tab-content');
    if (!container) return;

    if (this.currentTab === 'firm') this.renderFirmTab(container);
    else if (this.currentTab === 'bank') this.renderBankTab(container);
    else if (this.currentTab === 'numbering') this.renderNumberingTab(container);
    else if (this.currentTab === 'letterhead') this.renderLetterheadTab(container);
    else if (this.currentTab === 'users') this.renderUsersTab(container);
    else if (this.currentTab === 'backup') this.renderBackupTab(container);
  },

  /**
   * 1. Firm Profile & PCS Credentials
   */
  renderFirmTab(container) {
    const s = this.settings;
    container.innerHTML = `
      <form id="firm-settings-form" onsubmit="SettingsView.saveSettings(event, 'firm')">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Practicing Company Secretary Firm Credentials</span>
          </div>
          <div class="panel-body">
            
            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label">Firm Name *</label>
                <input type="text" id="set-firm_name" class="form-control" required value="${Utils.escapeHtml(s.firm_name || 'RSaini & Associates')}" />
              </div>
              <div class="form-group" style="flex: 1.5;">
                <label class="form-label">Tagline / Professional Specialty</label>
                <input type="text" id="set-firm_tagline" class="form-control" value="${Utils.escapeHtml(s.firm_tagline || 'Practicing Company Secretaries')}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Practicing CS Name</label>
                <input type="text" id="set-practitioner_name" class="form-control" value="${Utils.escapeHtml(s.practitioner_name || 'CS R. Saini')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Professional Qualifications</label>
                <input type="text" id="set-qualifications" class="form-control" value="${Utils.escapeHtml(s.qualifications || 'M.Com, FCS, ACMA, LL.B')}" />
              </div>
              <div class="form-group">
                <label class="form-label">ICSI Membership No (ACS / FCS)</label>
                <input type="text" id="set-membership_no" class="form-control" value="${Utils.escapeHtml(s.membership_no || 'FCS 10842')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Certificate of Practice (CP) No</label>
                <input type="text" id="set-cop_no" class="form-control" value="${Utils.escapeHtml(s.cop_no || 'CP No. 14280')}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label">ICSI Peer Review Status</label>
                <input type="text" id="set-peer_reviewed" class="form-control" value="${Utils.escapeHtml(s.peer_reviewed || 'Peer Reviewed Practice Unit No. 1928/2023')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Firm PAN</label>
                <input type="text" id="set-pan" class="form-control" value="${Utils.escapeHtml(s.pan || 'AAAAA0000A')}" />
              </div>
              <div class="form-group">
                <label class="form-label">GSTIN (Delhi)</label>
                <input type="text" id="set-gstin" class="form-control" value="${Utils.escapeHtml(s.gstin || '07AAAAA0000A1Z5')}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Address Line 1</label>
                <input type="text" id="set-address_line1" class="form-control" value="${Utils.escapeHtml(s.address_line1 || '')}" />
              </div>
              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label">Address Line 2</label>
                <input type="text" id="set-address_line2" class="form-control" value="${Utils.escapeHtml(s.address_line2 || '')}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">City</label>
                <input type="text" id="set-city" class="form-control" value="${Utils.escapeHtml(s.city || 'New Delhi')}" />
              </div>
              <div class="form-group">
                <label class="form-label">State</label>
                <input type="text" id="set-state" class="form-control" value="${Utils.escapeHtml(s.state || 'Delhi')}" />
              </div>
              <div class="form-group">
                <label class="form-label">State Code (GST)</label>
                <input type="text" id="set-state_code" class="form-control" value="${Utils.escapeHtml(s.state_code || '07')}" />
              </div>
              <div class="form-group">
                <label class="form-label">PIN Code</label>
                <input type="text" id="set-pincode" class="form-control" value="${Utils.escapeHtml(s.pincode || '110001')}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Official Phone / Mobile</label>
                <input type="text" id="set-phone" class="form-control" value="${Utils.escapeHtml(s.phone || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Official Email Address</label>
                <input type="email" id="set-email" class="form-control" value="${Utils.escapeHtml(s.email || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Website</label>
                <input type="text" id="set-website" class="form-control" value="${Utils.escapeHtml(s.website || '')}" />
              </div>
            </div>

          </div>
          <div class="modal-footer" style="border-radius:0;">
            <button type="submit" class="btn btn-primary">Save Firm Profile</button>
          </div>
        </div>
      </form>
    `;
  },

  /**
   * 2. Bank & Remittance
   */
  renderBankTab(container) {
    const s = this.settings;
    container.innerHTML = `
      <form id="bank-settings-form" onsubmit="SettingsView.saveSettings(event, 'bank')">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">Bank Remittance &amp; UPI Payment Gateway QR</span>
          </div>
          <div class="panel-body">
            <div class="alert alert-info">
              These details are printed on every invoice. The UPI ID generates a dynamic UPI QR Code on invoice PDFs so clients can scan and pay instantly.
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bank Name</label>
                <input type="text" id="set-bank_name" class="form-control" value="${Utils.escapeHtml(s.bank_name || 'HDFC Bank')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Beneficiary Account Name</label>
                <input type="text" id="set-account_name" class="form-control" value="${Utils.escapeHtml(s.account_name || 'RSaini and Associates')}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bank Account Number</label>
                <input type="text" id="set-account_number" class="form-control" style="font-family:monospace;" value="${Utils.escapeHtml(s.account_number || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Account Type</label>
                <input type="text" id="set-account_type" class="form-control" value="${Utils.escapeHtml(s.account_type || 'Current Account')}" />
              </div>
              <div class="form-group">
                <label class="form-label">RTGS / NEFT / IFSC Code</label>
                <input type="text" id="set-ifsc_code" class="form-control" style="font-family:monospace;" value="${Utils.escapeHtml(s.ifsc_code || 'HDFC0000123')}" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label class="form-label">Bank Branch Address</label>
                <input type="text" id="set-branch" class="form-control" value="${Utils.escapeHtml(s.branch || 'Connaught Place, New Delhi')}" />
              </div>
              <div class="form-group" style="flex: 1.5;">
                <label class="form-label">UPI ID for Direct Scanning (VPA) *</label>
                <input type="text" id="set-upi_id" class="form-control" style="font-weight:700; color:#0284c7;" value="${Utils.escapeHtml(s.upi_id || 'rsaini@hdfcbank')}" placeholder="e.g. rsaini@hdfcbank" />
              </div>
            </div>

          </div>
          <div class="modal-footer" style="border-radius:0;">
            <button type="submit" class="btn btn-primary">Save Remittance Settings</button>
          </div>
        </div>
      </form>
    `;
  },

  /**
   * 3. Numbering & FY
   */
  renderNumberingTab(container) {
    const s = this.settings;
    container.innerHTML = `
      <form id="numbering-settings-form" onsubmit="SettingsView.saveSettings(event, 'numbering')">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">FR-06 Configurable Invoice Numbering &amp; Series</span>
          </div>
          <div class="panel-body">
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Invoice Prefix</label>
                <input type="text" id="set-invoice_prefix" class="form-control" value="${Utils.escapeHtml(s.invoice_prefix || 'RSA/')}" oninput="SettingsView.updateNumberPreview()" />
              </div>
              <div class="form-group">
                <label class="form-label">Financial Year Format</label>
                <select id="set-fy_format" class="form-control" onchange="SettingsView.updateNumberPreview()">
                  <option value="YY-YY" ${s.fy_format === 'YY-YY' ? 'selected' : ''}>26-27 (Short)</option>
                  <option value="YYYY-YY" ${s.fy_format === 'YYYY-YY' ? 'selected' : ''}>2026-27</option>
                  <option value="YYYY-YYYY" ${s.fy_format === 'YYYY-YYYY' ? 'selected' : ''}>2026-2027</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Sequence Digits (Zero Padding)</label>
                <select id="set-sequence_padding" class="form-control" onchange="SettingsView.updateNumberPreview()">
                  <option value="3" ${s.sequence_padding == 3 ? 'selected' : ''}>3 Digits (001, 002...)</option>
                  <option value="4" ${s.sequence_padding == 4 ? 'selected' : ''}>4 Digits (0001, 0002...)</option>
                  <option value="5" ${s.sequence_padding == 5 ? 'selected' : ''}>5 Digits (00001...)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Next Sequence Counter</label>
                <input type="number" id="set-next_sequence" class="form-control" value="${s.next_sequence || 1}" min="1" oninput="SettingsView.updateNumberPreview()" />
              </div>
            </div>

            <!-- Preview Card -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:18px; margin-top:16px;">
              <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Next Generated Invoice Number Preview:</span>
              <div id="number-preview-display" style="font-size:24px; font-weight:900; color:#0f2942; font-family:monospace; margin-top:4px;">
                RSA/26-27/005
              </div>
              <p style="font-size:12px; color:#64748b; margin-top:4px;">
                Each issued invoice permanently binds its unique number in accordance with Indian GST laws and ICSI audit guidelines.
              </p>
            </div>

          </div>
          <div class="modal-footer" style="border-radius:0;">
            <button type="submit" class="btn btn-primary">Save Numbering Rules</button>
          </div>
        </div>
      </form>
    `;

    this.updateNumberPreview();
  },

  updateNumberPreview() {
    const prefix = document.getElementById('set-invoice_prefix')?.value || 'RSA/';
    const padding = Number(document.getElementById('set-sequence_padding')?.value) || 3;
    const seq = Number(document.getElementById('set-next_sequence')?.value) || 1;
    const cleanPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
    const padded = String(seq).padStart(padding, '0');
    const display = document.getElementById('number-preview-display');
    if (display) {
      display.innerText = `${cleanPrefix}26-27/${padded}`;
    }
  },

  /**
   * 4. Letterhead & Print Preferences
   */
  renderLetterheadTab(container) {
    const s = this.settings;
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">Letterhead Artwork &amp; Printing Modes</span>
        </div>
        <div class="panel-body">
          
          <div class="form-group" style="margin-bottom:24px;">
            <label class="form-label">Firm Logo / Letterhead Crest</label>
            <div style="display:flex; align-items:center; gap:20px;">
              <div style="width:100px; height:100px; border:1px solid #cbd5e1; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#ffffff; overflow:hidden;">
                <img id="logo-preview-img" src="${s.logo_url || '/assets/logo.svg'}" style="width:100%; height:100%; object-fit:contain;" alt="Logo" />
              </div>
              <div>
                <input type="file" id="logo-file-input" accept="image/*" class="form-control" style="margin-bottom:8px;" />
                <button type="button" class="btn btn-outline btn-sm" onclick="SettingsView.uploadLogo()">
                  Upload New Logo File
                </button>
                <div style="font-size:11px; color:#64748b; margin-top:4px;">Supported: PNG, JPG, SVG, WebP (Max 5MB)</div>
              </div>
            </div>
          </div>

          <form id="print-settings-form" onsubmit="SettingsView.saveSettings(event, 'print')">
            <div class="form-group">
              <label class="form-label">Default Print Mode</label>
              <select id="set-print_letterhead_artwork" class="form-control">
                <option value="1" ${s.print_letterhead_artwork !== '0' ? 'selected' : ''}>Full Digital Letterhead (Print firm header &amp; logo onto clean white A4 paper)</option>
                <option value="0" ${s.print_letterhead_artwork === '0' ? 'selected' : ''}>Pre-Printed Stationery Mode (Suppresses header/footer for feeding physical printed letterhead)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Default Terms &amp; Conditions (Appears on all invoices)</label>
              <textarea id="set-invoice_terms" class="form-control" rows="6">${Utils.escapeHtml(s.invoice_terms || '')}</textarea>
            </div>

            <div style="text-align:right; margin-top:20px;">
              <button type="submit" class="btn btn-primary">Save Letterhead Settings</button>
            </div>
          </form>

        </div>
      </div>
    `;
  },

  async uploadLogo() {
    const fileInput = document.getElementById('logo-file-input');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      Toast.warning('Please select an image file first.');
      return;
    }

    const formData = new FormData();
    formData.append('logo', fileInput.files[0]);

    try {
      const res = await API.post('/api/settings/upload-logo', formData);
      Toast.success(res.message);
      this.settings.logo_url = res.logoUrl;
      document.getElementById('logo-preview-img').src = res.logoUrl;
    } catch (err) {
      Toast.error(err.message || 'Failed to upload logo');
    }
  },

  /**
   * 5. User Accounts
   */
  async renderUsersTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">Authorized System Users</span>
          <button class="btn btn-primary btn-sm" onclick="SettingsView.openAddUserModal()">+ Add New User</button>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8;">Loading user accounts...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await API.get('/api/settings/users');
      const tbody = document.getElementById('users-table-body');
      tbody.innerHTML = res.users.map(u => `
        <tr>
          <td style="font-weight:700; color:#0f2942;">${Utils.escapeHtml(u.username)}</td>
          <td style="font-weight:600;">${Utils.escapeHtml(u.full_name)}</td>
          <td>
            <span class="badge ${u.role === 'admin' ? 'badge-issued' : 'badge-draft'}">
              ${u.role === 'admin' ? 'Practice Owner / Admin' : 'Billing Staff'}
            </span>
          </td>
          <td>${Utils.escapeHtml(u.email || '-')}</td>
          <td>${Utils.statusBadge(u.status)}</td>
          <td>${u.last_login ? Utils.formatDate(u.last_login) : 'Never'}</td>
        </tr>
      `).join('');
    } catch (err) {
      Toast.error('Could not load users list');
    }
  },

  openAddUserModal() {
    const modalId = 'add-user-modal';
    const backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">Create Authorized User</div>
          <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
        </div>
        <form id="add-user-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Username *</label>
              <input type="text" id="new-u-username" class="form-control" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password *</label>
              <input type="password" id="new-u-password" class="form-control" required minlength="6" />
            </div>
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="new-u-fullname" class="form-control" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="new-u-email" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select id="new-u-role" class="form-control">
                <option value="billing">Billing Staff</option>
                <option value="admin">Practice Owner / Admin</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create User</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(backdrop);

    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        username: document.getElementById('new-u-username').value.trim(),
        password: document.getElementById('new-u-password').value,
        full_name: document.getElementById('new-u-fullname').value.trim(),
        email: document.getElementById('new-u-email').value.trim(),
        role: document.getElementById('new-u-role').value
      };

      try {
        await API.post('/api/settings/users', payload);
        Toast.success('User created successfully');
        backdrop.remove();
        SettingsView.renderCurrentTab();
      } catch (err) {
        Toast.error(err.message || 'Failed to create user');
      }
    });
  },

  /**
   * 6. Backup & Restore
   */
  renderBackupTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">FR-16 Database Backup &amp; Disaster Recovery</span>
        </div>
        <div class="panel-body">
          <div class="alert alert-info">
            All practice data (clients, invoices, payments, services, settings, and audit logs) can be exported and safely restored on any machine.
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:20px;">
            
            <!-- Download Backup Panel -->
            <div style="border:1px solid #cbd5e1; border-radius:8px; padding:20px; background:#f8fafc;">
              <h4 style="font-size:15px; font-weight:700; color:#0f2942; margin-bottom:8px;">1. Export Full Backup</h4>
              <p style="font-size:12px; color:#64748b; margin-bottom:16px;">
                Download an encrypted JSON file or raw SQLite database containing all client masters, invoices, receipts, and audit trail.
              </p>
              <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn btn-primary" onclick="SettingsView.downloadJsonBackup()">
                  Download Complete JSON Backup
                </button>
                <button class="btn btn-outline" onclick="SettingsView.downloadDbFile()">
                  Download Raw SQLite Database (.db)
                </button>
              </div>
            </div>

            <!-- Restore Backup Panel -->
            <div style="border:1px solid #cbd5e1; border-radius:8px; padding:20px; background:#f8fafc;">
              <h4 style="font-size:15px; font-weight:700; color:#0f2942; margin-bottom:8px;">2. Restore from Backup</h4>
              <p style="font-size:12px; color:#64748b; margin-bottom:16px;">
                Upload a previously saved JSON backup file to restore records. All transactions are restored safely with audit trail.
              </p>
              <input type="file" id="restore-file-input" accept=".json" class="form-control" style="margin-bottom:12px;" />
              <button class="btn btn-danger" onclick="SettingsView.restoreJsonBackup()">
                Restore Database from File
              </button>
            </div>

          </div>
        </div>
      </div>
    `;
  },

  downloadJsonBackup() {
    window.location.href = '/api/backup/export-json';
  },

  downloadDbFile() {
    window.location.href = '/api/backup/download-db';
  },

  restoreJsonBackup() {
    const fileInput = document.getElementById('restore-file-input');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      Toast.warning('Please select a valid .json backup file.');
      return;
    }

    if (!confirm('CAUTION: Restoring a backup will merge/overwrite database records with the backup file data. Continue?')) {
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const res = await API.post('/api/backup/restore-json', json);
        Toast.success(res.message);
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        Toast.error('Invalid backup file or restore failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  /**
   * Universal save settings helper
   */
  async saveSettings(e, section) {
    if (e) e.preventDefault();

    const payload = {};
    const inputs = document.querySelectorAll(`[id^="set-"]`);
    inputs.forEach(inp => {
      const key = inp.id.replace('set-', '');
      payload[key] = inp.value;
    });

    try {
      await API.put('/api/settings', payload);
      Toast.success('Settings updated successfully');
      Object.assign(this.settings, payload);
    } catch (err) {
      Toast.error(err.message || 'Failed to update settings');
    }
  }
};

