/**
 * Audit Trail Logs View
 */
const AuditView = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:700; color:#0f2942;">FR-14 Compliance Audit Trail</h3>
          <p style="font-size:12.5px; color:#64748b;">Chronological audit log of all system events, client updates, invoice changes, and receipts</p>
        </div>
      </div>

      <div class="panel">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width:170px;">Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Details / Changes</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              <tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Loading audit records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await API.get('/api/audit');
      const tbody = document.getElementById('audit-table-body');
      if (!res.logs.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">No audit logs found.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.logs.map(log => `
        <tr>
          <td style="font-size:11.5px; color:#64748b; font-family:monospace;">
            ${new Date(log.created_at).toLocaleString('en-IN')}
          </td>
          <td style="font-weight:600; color:#0f2942;">
            ${Utils.escapeHtml(log.user_full_name || log.username || 'System')}
          </td>
          <td>
            <span class="badge ${log.action.includes('CANCEL') ? 'badge-cancelled' : log.action.includes('PAYMENT') ? 'badge-paid' : 'badge-issued'}">
              ${Utils.escapeHtml(log.action)}
            </span>
          </td>
          <td>
            <span style="font-size:11px; text-transform:uppercase; color:#475569; font-weight:600;">
              ${Utils.escapeHtml(log.entity_type)} #${log.entity_id}
            </span>
          </td>
          <td style="font-size:12px; color:#334155;">
            ${Utils.escapeHtml(log.details)}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      Toast.error('Failed to load audit logs');
    }
  }
};

