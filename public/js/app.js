/**
 * Application Master Controller & Navigation Router
 */
const App = {
  currentView: 'dashboard',

  init() {
    const token = API.getToken();
    if (!token) {
      this.showLogin();
      return;
    }

    this.renderLayout();
    this.navigate('dashboard');
  },

  showLogin(message) {
    const root = document.getElementById('app-root');
    AuthView.render(root);
    if (message) {
      Toast.warning(message);
    }
  },

  renderLayout() {
    const user = API.getUser() || { fullName: 'User', role: 'billing' };
    const root = document.getElementById('app-root');

    root.innerHTML = `
      <div class="app-container">
        
        <!-- Sidebar Navigation -->
        <aside class="sidebar no-print">
          <div class="sidebar-header">
            <div class="sidebar-brand-icon">
              <span>RSA</span>
            </div>
            <div class="sidebar-brand-text">
              <h1>RSAINI &amp; ASSOC.</h1>
              <p>PCS PRACTICE PORTAL</p>
            </div>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section-title">Core Operations</div>
            <a class="nav-item active" data-view="dashboard" onclick="App.navigate('dashboard')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              Dashboard
            </a>
            <a class="nav-item" data-view="clients" onclick="App.navigate('clients')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Client Master
            </a>

            <div class="nav-section-title">Billing &amp; Revenue</div>
            <a class="nav-item" data-view="invoices" onclick="App.navigate('invoices')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Invoice Register
            </a>
            <a class="nav-item" data-view="create-invoice" onclick="App.navigate('create-invoice')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Create New Invoice
            </a>
            <a class="nav-item" data-view="payments" onclick="App.navigate('payments')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Payments &amp; Receipts
            </a>
            <a class="nav-item" data-view="services" onclick="App.navigate('services')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              Services &amp; Fees
            </a>

            <div class="nav-section-title">Compliance &amp; Admin</div>
            <a class="nav-item" data-view="reports" onclick="App.navigate('reports')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              Registers &amp; Reports
            </a>
            <a class="nav-item" data-view="settings" onclick="App.navigate('settings')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
              Settings &amp; Backup
            </a>
            <a class="nav-item" data-view="audit" onclick="App.navigate('audit')">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Audit Trail Log
            </a>
          </nav>

          <div class="sidebar-footer">
            <div class="user-badge">
              <div class="user-avatar">${(user.fullName || 'U').charAt(0)}</div>
              <div class="user-info">
                <div class="user-name" title="${Utils.escapeHtml(user.fullName)}">${Utils.escapeHtml(user.fullName)}</div>
                <div class="user-role">${user.role === 'admin' ? 'Practice Owner' : 'Billing Staff'}</div>
              </div>
            </div>
            <button class="btn btn-icon" style="color:rgba(255,255,255,0.7);" title="Sign Out" onclick="App.logout()">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </button>
          </div>
        </aside>

        <!-- Main Wrapper -->
        <div class="main-wrapper">
          <header class="top-navbar no-print">
            <div class="page-header-title">
              <h2 id="top-title">Practice Dashboard</h2>
              <span class="fy-pill">FY 2026-27</span>
            </div>
            <div class="top-nav-actions">
              <button class="btn btn-primary btn-sm" onclick="App.navigate('create-invoice')">
                + New Invoice
              </button>
            </div>
          </header>

          <main class="content-area" id="main-content">
            <!-- Dynamic View Output -->
          </main>
        </div>

      </div>
    `;
  },

  navigate(viewName, params = {}) {
    this.currentView = viewName;
    const content = document.getElementById('main-content');
    const titleEl = document.getElementById('top-title');

    // Update active state in nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    switch (viewName) {
      case 'dashboard':
        if (titleEl) titleEl.innerText = 'Practice Dashboard';
        DashboardView.render(content);
        break;
      case 'clients':
        if (titleEl) titleEl.innerText = 'Client Master Records';
        ClientsView.render(content, params);
        break;
      case 'invoices':
        if (titleEl) titleEl.innerText = 'Invoice Register';
        InvoicesView.render(content, params);
        break;
      case 'create-invoice':
        if (titleEl) titleEl.innerText = params && params.invoiceId ? 'Edit Draft Invoice' : 'Create Professional Invoice';
        CreateInvoiceView.render(content, params ? params.invoiceId : null);
        break;
      case 'payments':
        if (titleEl) titleEl.innerText = 'Collections & Payment Receipts';
        PaymentsView.render(content);
        break;
      case 'services':
        if (titleEl) titleEl.innerText = 'Service Catalogue & Scope';
        ServicesView.render(content);
        break;
      case 'reports':
        if (titleEl) titleEl.innerText = 'Financial Registers & Reports';
        ReportsView.render(content, params);
        break;
      case 'settings':
        if (titleEl) titleEl.innerText = 'Settings & Practice Configuration';
        SettingsView.render(content, params);
        break;
      case 'audit':
        if (titleEl) titleEl.innerText = 'Compliance Audit Trail';
        AuditView.render(content);
        break;
      default:
        DashboardView.render(content);
    }
  },

  async logout() {
    try {
      await API.post('/api/auth/logout');
    } catch (e) {
      // Ignore
    }
    API.clearAuth();
    Toast.info('Signed out successfully.');
    this.showLogin();
  }
};

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
