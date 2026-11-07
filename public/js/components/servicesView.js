/**
 * Service Catalogue View
 */
const ServicesView = {
  services: [],

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">Service Catalogue &amp; Fees</h3>
          <p style="font-size:12.5px; color:#64748b;">Reusable professional service descriptions, default fee schedules, and SAC codes</p>
        </div>
        <button class="btn btn-primary" onclick="ServicesView.openServiceModal()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add Service to Catalogue
        </button>
      </div>

      <div class="panel">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Service Code</th>
                <th>Service Name</th>
                <th>SAC / HSN</th>
                <th>Standard Scope / Description</th>
                <th style="text-align:right;">Default Fee (₹)</th>
                <th>GST Rate</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="services-table-body">
              <tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">Loading services catalogue...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await ServicesView.loadServices();
  },

  async loadServices() {
    try {
      const res = await API.get('/api/services');
      this.services = res.services;
      this.renderRows(res.services);
    } catch (err) {
      Toast.error('Failed to load services catalogue');
    }
  },

  renderRows(services) {
    const tbody = document.getElementById('services-table-body');
    if (!tbody) return;

    if (!services || services.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No services in catalogue yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = services.map(s => `
      <tr>
        <td style="font-weight:700; font-family:monospace; color:#0f2942;">${Utils.escapeHtml(s.code)}</td>
        <td style="font-weight:600; color:#0f2942;">${Utils.escapeHtml(s.name)}</td>
        <td><span style="font-family:monospace; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px;">${Utils.escapeHtml(s.sac_code || '998242')}</span></td>
        <td style="max-width:320px; font-size:12px; color:#64748b;">${Utils.escapeHtml(s.description || '')}</td>
        <td style="text-align:right; font-weight:700; color:#0f2942;">${Utils.formatINR(s.default_fee)}</td>
        <td><span class="badge badge-issued">${s.default_tax_rate}%</span></td>
        <td>
          <span class="badge ${s.is_active ? 'badge-active' : 'badge-inactive'}">
            ${s.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-outline btn-sm" onclick="ServicesView.openServiceModal(${s.id})">Edit</button>
          <button class="btn btn-outline btn-sm" onclick="ServicesView.toggleService(${s.id})">
            ${s.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  },

  async toggleService(id) {
    try {
      const res = await API.post(`/api/services/${id}/toggle`);
      Toast.success(res.is_active ? 'Service activated' : 'Service deactivated');
      ServicesView.loadServices();
    } catch (err) {
      Toast.error('Failed to change service status');
    }
  },

  async openServiceModal(serviceId = null) {
    let service = {
      code: '', name: '', sac_code: '998242',
      description: '', default_fee: 10000, default_tax_rate: 18, is_active: 1
    };

    if (serviceId) {
      try {
        const res = await API.get(`/api/services/${serviceId}`);
        service = res.service;
      } catch (err) {
        Toast.error('Failed to fetch service details');
        return;
      }
    }

    const modalId = 'service-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = modalId;
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">${serviceId ? 'Edit Service' : 'Add New Service to Catalogue'}</div>
          <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
        </div>

        <form id="service-form">
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Service Code</label>
                <input type="text" id="inp-srv-code" class="form-control" value="${Utils.escapeHtml(service.code)}" placeholder="e.g. PCS-ROC-01" ${serviceId ? 'readonly' : ''} />
              </div>
              <div class="form-group" style="flex: 2;">
                <label class="form-label">Service Name *</label>
                <input type="text" id="inp-srv-name" class="form-control" required value="${Utils.escapeHtml(service.name)}" placeholder="e.g. Annual ROC Filing" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">SAC / HSN Code</label>
                <input type="text" id="inp-srv-sac" class="form-control" value="${Utils.escapeHtml(service.sac_code || '998242')}" placeholder="998242" />
              </div>
              <div class="form-group">
                <label class="form-label">Default Professional Fee (₹) *</label>
                <input type="number" id="inp-srv-fee" class="form-control" required step="100" min="0" value="${service.default_fee}" />
              </div>
              <div class="form-group">
                <label class="form-label">Default GST Rate (%)</label>
                <select id="inp-srv-tax" class="form-control">
                  <option value="18" ${service.default_tax_rate == 18 ? 'selected' : ''}>18% (Standard PCS)</option>
                  <option value="12" ${service.default_tax_rate == 12 ? 'selected' : ''}>12%</option>
                  <option value="5" ${service.default_tax_rate == 5 ? 'selected' : ''}>5%</option>
                  <option value="0" ${service.default_tax_rate == 0 ? 'selected' : ''}>0% (Exempt)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Standard Scope / Itemized Description</label>
              <textarea id="inp-srv-desc" class="form-control" rows="3" placeholder="Scope of professional work, forms filed, certification provided...">${Utils.escapeHtml(service.description || '')}</textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Service</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(backdrop);

    document.getElementById('service-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        code: document.getElementById('inp-srv-code').value.trim(),
        name: document.getElementById('inp-srv-name').value.trim(),
        sac_code: document.getElementById('inp-srv-sac').value.trim(),
        default_fee: Number(document.getElementById('inp-srv-fee').value),
        default_tax_rate: Number(document.getElementById('inp-srv-tax').value),
        description: document.getElementById('inp-srv-desc').value.trim()
      };

      try {
        if (serviceId) {
          await API.put(`/api/services/${serviceId}`, payload);
          Toast.success('Service updated successfully');
        } else {
          await API.post('/api/services', payload);
          Toast.success('Service created successfully');
        }
        backdrop.remove();
        ServicesView.loadServices();
      } catch (err) {
        Toast.error(err.message || 'Failed to save service');
      }
    });
  }
};

