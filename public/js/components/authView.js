/**
 * Authentication View
 */
const AuthView = {
  render(container) {
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f2942 0%, #1e4d79 100%); padding: 20px;">
        <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); width: 100%; max-width: 440px; overflow: hidden;">
          
          <div style="background: #ffffff; padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <div style="width: 70px; height: 70px; margin: 0 auto 16px auto; background: linear-gradient(135deg, #c59b27, #e5be4a); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(197, 155, 39, 0.3);">
              <span style="font-size: 28px; font-weight: 800; color: #0f2942; font-family: 'Cinzel', serif;">RSA</span>
            </div>
            <h1 style="font-size: 20px; font-weight: 800; color: #0f2942; letter-spacing: 0.5px; font-family: 'Cinzel', serif;">RSAINI &amp; ASSOCIATES</h1>
            <p style="font-size: 11.5px; font-weight: 700; color: #c59b27; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">Practicing Company Secretaries</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 6px;">Client, Invoice &amp; Payment Management System</p>
          </div>

          <div style="padding: 28px 32px;">
            <form id="login-form">
              <div class="form-group">
                <label class="form-label">Username</label>
                <div style="position: relative;">
                  <input type="text" id="login-username" class="form-control" style="padding-left: 38px;" placeholder="e.g. admin" required autocomplete="username" />
                  <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  </span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Password</label>
                <div style="position: relative;">
                  <input type="password" id="login-password" class="form-control" style="padding-left: 38px;" placeholder="••••••••" required autocomplete="current-password" />
                  <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </span>
                </div>
              </div>

              <div style="margin-top: 24px;">
                <button type="submit" id="btn-login-submit" class="btn btn-primary" style="width: 100%; padding: 11px; font-size: 14px; font-weight: 700; background: #0f2942;">
                  Sign In to Practice Portal
                </button>
              </div>
            </form>

            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; text-align: center;">
                Quick Demo Access (Click to Fill)
              </p>
              <div style="display: flex; gap: 10px;">
                <button type="button" class="btn btn-outline btn-sm" style="flex: 1; font-size: 11.5px;" onclick="AuthView.fillDemo('admin', 'admin123')">
                  <strong>CS R. Saini</strong> (Owner)
                </button>
                <button type="button" class="btn btn-outline btn-sm" style="flex: 1; font-size: 11.5px;" onclick="AuthView.fillDemo('billing', 'billing123')">
                  <strong>Neha S.</strong> (Billing Desk)
                </button>
              </div>
            </div>

            <div style="margin-top: 20px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8;">
                Authorized practice personnel only • ICSI Peer Reviewed
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const submitBtn = document.getElementById('btn-login-submit');

      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing In...';

      try {
        const res = await API.post('/api/auth/login', { username, password });
        if (res.success) {
          API.setToken(res.token);
          API.setUser(res.user);
          Toast.success(`Welcome back, ${res.user.fullName}!`);
          window.App.init();
        }
      } catch (err) {
        Toast.error(err.message || 'Login failed');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Sign In to Practice Portal';
      }
    });
  },

  fillDemo(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
  }
};
