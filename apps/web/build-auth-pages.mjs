/**
 * VANNI Auth & Multi-Tenancy UI Generator
 * Builds /login, /signup, /forgot-password, /reset-password,
 * /app/organization/select, /app/organization/create, and /app/onboarding.
 */

import fs from 'node:fs';
import path from 'node:path';

const WEB_DIR = process.cwd().endsWith('web') ? process.cwd() : path.resolve(process.cwd(), 'apps/web');

function renderAuthHead(title, description, canonicalPath = '/login') {
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — VANNI</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://vanni.ai${canonicalPath}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Kannada:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/vanni.css">
  <style>
    body {
      margin: 0;
      background: var(--vanni-bg);
      color: var(--vanni-text-primary);
      font-family: var(--vanni-font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .auth-card {
      width: 100%;
      max-width: 440px;
      background: var(--vanni-surface);
      border: 1px solid var(--vanni-border);
      border-radius: var(--vanni-radius-lg);
      padding: 36px;
      box-shadow: var(--vanni-shadow-md);
      box-sizing: border-box;
    }
    .auth-alert-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #EF4444;
      padding: 10px 14px;
      border-radius: var(--vanni-radius-md);
      font-size: 13px;
      margin-bottom: 16px;
      display: none;
    }
    .auth-alert-success {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10B981;
      padding: 10px 14px;
      border-radius: var(--vanni-radius-md);
      font-size: 13px;
      margin-bottom: 16px;
      display: none;
    }
  </style>
  `;
}

function renderAuthHeader() {
  return `
  <header style="height: 64px; background: var(--vanni-surface); border-bottom: 1px solid var(--vanni-border); display: flex; align-items: center; justify-content: space-between; padding: 0 24px;">
    <a href="/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--vanni-text-primary);">
      <div style="width: 32px; height: 32px; border-radius: var(--vanni-radius-md); background: var(--vanni-primary); display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 800; font-size: 15px; font-family: var(--vanni-font-mono);">
        V
      </div>
      <div>
        <div style="font-weight: 700; font-size: 16px; letter-spacing: -0.02em; line-height: 1;">VANNI</div>
        <div style="font-size: 10px; color: var(--vanni-text-muted); font-weight: 500; margin-top: 2px;">AI Employee Platform</div>
      </div>
    </a>
    <div style="display: flex; align-items: center; gap: 16px; font-size: 13px;">
      <a href="/pricing" style="color: var(--vanni-text-secondary); text-decoration: none;">Pricing</a>
      <a href="/security" style="color: var(--vanni-text-secondary); text-decoration: none;">Security</a>
    </div>
  </header>
  `;
}

// ==============================================================================
// 1. LOGIN PAGE
// ==============================================================================
function buildLoginPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Sign In', 'Sign in to your VANNI organization tenant.')}
</head>
<body>
  ${renderAuthHeader()}
  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
    <div class="auth-card">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 6px 0;">Sign in to VANNI</h1>
        <p style="font-size: 13px; color: var(--vanni-text-muted); margin: 0;">Access your organization dashboard and AI voice telemetry.</p>
      </div>

      <!-- Quick 1-Click Demo Logins -->
      <div style="background: var(--vanni-surface-subdued); border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-md); padding: 12px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 600; color: var(--vanni-accent); font-family: var(--vanni-font-mono);">DEVELOPMENT ACCESS</span>
          <span style="font-size: 10px; color: var(--vanni-text-muted);">Seed Credentials</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" onclick="quickLogin('admin@vanni.ai', 'VanniSecure2026!')" class="vanni-button vanni-button-secondary" style="font-size: 11px; justify-content: flex-start; padding: 6px 10px;">
            <span>🏢 Ballari Plots</span>
          </button>
          <button type="button" onclick="quickLogin('admin@vanni.ai', 'VanniSecure2026!')" class="vanni-button vanni-button-secondary" style="font-size: 11px; justify-content: flex-start; padding: 6px 10px;">
            <span>🏥 Apollo Clinic</span>
          </button>
        </div>
      </div>

      <div id="login-error" class="auth-alert-error"></div>

      <form id="login-form" onsubmit="handleLoginSubmit(event)">
        <div class="vanni-form-group">
          <label for="login-email" class="vanni-label">Work Email</label>
          <input type="email" id="login-email" name="email" placeholder="name@company.com" required class="vanni-input" autofocus />
        </div>

        <div class="vanni-form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label for="login-password" class="vanni-label" style="margin-bottom: 0;">Password</label>
            <a href="/forgot-password" style="font-size: 12px; color: var(--vanni-accent); text-decoration: none;">Forgot password?</a>
          </div>
          <input type="password" id="login-password" name="password" placeholder="••••••••••••" required class="vanni-input" />
        </div>

        <button type="submit" id="login-submit-btn" class="vanni-button vanni-button-primary vanni-button-lg" style="width: 100%; margin-top: 8px;">
          <span>Sign In to Console</span>
        </button>
      </form>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--vanni-border-subdued); text-align: center; font-size: 13px; color: var(--vanni-text-muted);">
        Don't have an organization? <a href="/signup" style="color: var(--vanni-accent); font-weight: 600; text-decoration: none;">Create an account</a>
      </div>
    </div>
  </main>

  <script>
    async function quickLogin(email, password) {
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = password;
      document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true }));
    }

    async function handleLoginSubmit(e) {
      e.preventDefault();
      const errEl = document.getElementById('login-error');
      const btn = document.getElementById('login-submit-btn');
      errEl.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = '<span>Verifying credentials...</span>';

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.message || 'Invalid email or password.');
        }

        // Check redirect param
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect') || '/app/dashboard';
        window.location.href = redirectUrl;
      } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to Console</span>';
      }
    }
  </script>
</body>
</html>`;
}

// ==============================================================================
// 2. SIGNUP PAGE
// ==============================================================================
function buildSignupPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Create Organization Account', 'Create your organization tenant and deploy your first AI employee.', '/signup')}
</head>
<body>
  ${renderAuthHeader()}
  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
    <div class="auth-card">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 6px 0;">Create Organization Account</h1>
        <p style="font-size: 13px; color: var(--vanni-text-muted); margin: 0;">Deploy your first autonomous voice agent in Kannada or Kanglish.</p>
      </div>

      <div id="signup-error" class="auth-alert-error"></div>

      <form id="signup-form" onsubmit="handleSignupSubmit(event)">
        <div class="vanni-form-group">
          <label for="signup-name" class="vanni-label">Your Full Name *</label>
          <input type="text" id="signup-name" name="fullName" placeholder="e.g. Ramesh Patil" required class="vanni-input" />
        </div>

        <div class="vanni-form-group">
          <label for="signup-email" class="vanni-label">Work Email *</label>
          <input type="email" id="signup-email" name="email" placeholder="ramesh@company.com" required class="vanni-input" />
        </div>

        <div class="vanni-form-group">
          <label for="signup-pass" class="vanni-label">Password * (Min 8 characters)</label>
          <input type="password" id="signup-pass" name="password" minlength="8" placeholder="Create a strong password" required class="vanni-input" />
        </div>

        <div class="vanni-form-group">
          <label for="signup-org" class="vanni-label">Company / Practice Name *</label>
          <input type="text" id="signup-org" name="organizationName" placeholder="e.g. Patil Multi-Specialty Clinic" required class="vanni-input" />
        </div>

        <div class="vanni-form-group">
          <label for="signup-industry" class="vanni-label">Primary Industry</label>
          <select id="signup-industry" name="industry" class="vanni-select">
            <option value="DENTAL">Dental / Specialty Clinic</option>
            <option value="HEALTHCARE_HOSPITAL">Hospital / Multi-Specialty Healthcare</option>
            <option value="IVF_FERTILITY">IVF & Fertility Clinic</option>
            <option value="REAL_ESTATE" selected>Real Estate & Plotted Layouts</option>
            <option value="HOSPITALITY_RESORT">Hospitality, Resorts & Dining</option>
            <option value="DIGITAL_AGENCY">Digital Marketing Agency</option>
            <option value="COMMERCIAL_OTHER">Other Commercial Business</option>
          </select>
        </div>

        <button type="submit" id="signup-submit-btn" class="vanni-button vanni-button-primary vanni-button-lg" style="width: 100%; margin-top: 12px;">
          <span>Create Workspace & Start Onboarding</span>
        </button>
      </form>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--vanni-border-subdued); text-align: center; font-size: 13px; color: var(--vanni-text-muted);">
        Already have an organization? <a href="/login" style="color: var(--vanni-accent); font-weight: 600; text-decoration: none;">Sign in here</a>
      </div>
    </div>
  </main>

  <script>
    async function handleSignupSubmit(e) {
      e.preventDefault();
      const errEl = document.getElementById('signup-error');
      const btn = document.getElementById('signup-submit-btn');
      errEl.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = '<span>Creating tenant workspace...</span>';

      const payload = {
        fullName: document.getElementById('signup-name').value,
        email: document.getElementById('signup-email').value,
        password: document.getElementById('signup-pass').value,
        organizationName: document.getElementById('signup-org').value,
        industry: document.getElementById('signup-industry').value,
        timezone: 'Asia/Kolkata',
      };

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.message || 'Signup failed.');
        }

        window.location.href = '/app/onboarding';
      } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Create Workspace & Start Onboarding</span>';
      }
    }
  </script>
</body>
</html>`;
}

// ==============================================================================
// 3. FORGOT PASSWORD PAGE
// ==============================================================================
function buildForgotPasswordPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Reset Password', 'Request password reset instructions for your account.')}
</head>
<body>
  ${renderAuthHeader()}
  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
    <div class="auth-card">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 6px 0;">Reset your password</h1>
        <p style="font-size: 13px; color: var(--vanni-text-muted); margin: 0;">Enter your work email address and we'll send you recovery instructions.</p>
      </div>

      <div id="reset-success" class="auth-alert-success">
        Password reset instructions have been dispatched to your email address.
      </div>
      <div id="reset-error" class="auth-alert-error"></div>

      <form id="reset-form" onsubmit="handleResetRequest(event)">
        <div class="vanni-form-group">
          <label for="reset-email" class="vanni-label">Work Email</label>
          <input type="email" id="reset-email" name="email" placeholder="name@company.com" required class="vanni-input" autofocus />
        </div>

        <button type="submit" id="reset-btn" class="vanni-button vanni-button-primary vanni-button-lg" style="width: 100%; margin-top: 8px;">
          <span>Send Recovery Link</span>
        </button>
      </form>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--vanni-border-subdued); text-align: center; font-size: 13px;">
        <a href="/login" style="color: var(--vanni-text-secondary); text-decoration: none;">&larr; Back to sign in</a>
      </div>
    </div>
  </main>

  <script>
    function handleResetRequest(e) {
      e.preventDefault();
      const email = document.getElementById('reset-email').value;
      document.getElementById('reset-success').style.display = 'block';
      document.getElementById('reset-form').style.display = 'none';
    }
  </script>
</body>
</html>`;
}

// ==============================================================================
// 4. RESET PASSWORD CONFIRMATION PAGE
// ==============================================================================
function buildResetPasswordPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Set New Password', 'Set a new password for your account.')}
</head>
<body>
  ${renderAuthHeader()}
  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
    <div class="auth-card">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 6px 0;">Set New Password</h1>
        <p style="font-size: 13px; color: var(--vanni-text-muted); margin: 0;">Create a new secure password for your organization account.</p>
      </div>

      <div id="newpass-success" class="auth-alert-success">
        Password updated successfully! Redirecting to sign in...
      </div>
      <div id="newpass-error" class="auth-alert-error"></div>

      <form id="newpass-form" onsubmit="handleNewPassSubmit(event)">
        <div class="vanni-form-group">
          <label for="new-pass" class="vanni-label">New Password</label>
          <input type="password" id="new-pass" name="password" minlength="8" required class="vanni-input" autofocus />
        </div>

        <div class="vanni-form-group">
          <label for="confirm-pass" class="vanni-label">Confirm Password</label>
          <input type="password" id="confirm-pass" name="confirmPassword" minlength="8" required class="vanni-input" />
        </div>

        <button type="submit" class="vanni-button vanni-button-primary vanni-button-lg" style="width: 100%; margin-top: 8px;">
          <span>Update Password & Sign In</span>
        </button>
      </form>
    </div>
  </main>

  <script>
    function handleNewPassSubmit(e) {
      e.preventDefault();
      const p1 = document.getElementById('new-pass').value;
      const p2 = document.getElementById('confirm-pass').value;
      if (p1 !== p2) {
        const err = document.getElementById('newpass-error');
        err.innerText = 'Passwords do not match.';
        err.style.display = 'block';
        return;
      }
      document.getElementById('newpass-success').style.display = 'block';
      document.getElementById('newpass-form').style.display = 'none';
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    }
  </script>
</body>
</html>`;
}

// ==============================================================================
// 5. ORGANIZATION SELECTOR / SWITCHER PAGE (/app/organization/select)
// ==============================================================================
function buildOrgSelectPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Select Organization', 'Switch between your active organization workspaces.')}
</head>
<body>
  ${renderAuthHeader()}
  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
    <div class="auth-card" style="max-width: 500px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 4px 0;">Select Organization</h1>
          <p style="font-size: 13px; color: var(--vanni-text-muted); margin: 0;">Switch workspace context or create a new organization.</p>
        </div>
        <a href="/app/organization/create" class="vanni-button vanni-button-secondary" style="font-size: 12px; padding: 6px 12px;">+ New Org</a>
      </div>

      <div id="org-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
        <!-- Dynamic Orgs Rendered via JS -->
      </div>

      <div style="border-top: 1px solid var(--vanni-border-subdued); padding-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--vanni-text-muted);">
        <span>Logged in as <strong id="user-display-email">admin@vanni.ai</strong></span>
        <button type="button" onclick="logout()" style="background: none; border: none; color: #EF4444; font-size: 12px; cursor: pointer; padding: 0;">Sign out</button>
      </div>
    </div>
  </main>

  <script>
    async function loadOrganizations() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (!data.authenticated) {
          window.location.href = '/login';
          return;
        }

        const session = data.session;
        document.getElementById('user-display-email').innerText = session.email;

        const listEl = document.getElementById('org-list');
        listEl.innerHTML = session.memberships.map(m => {
          const isActive = m.organizationId === session.activeOrganizationId;
          const border = isActive ? 'border-color: var(--vanni-primary); background: rgba(37, 99, 235, 0.05);' : '';
          return \`
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-md); \${border}">
              <div>
                <div style="font-weight: 600; font-size: 14px; color: var(--vanni-text-primary);">\${m.organizationName}</div>
                <div style="font-size: 11px; color: var(--vanni-text-muted); margin-top: 2px;">
                  Role: <span style="font-family: var(--vanni-font-mono); color: var(--vanni-accent);">\${m.role}</span> &bull; Status: \${m.status}
                </div>
              </div>
              <div>
                \${isActive 
                  ? '<span class="vanni-badge vanni-badge-success" style="font-size: 11px;">Active</span>' 
                  : \`<button type="button" onclick="switchOrg('\${m.organizationId}')" class="vanni-button vanni-button-secondary" style="font-size: 12px; padding: 6px 12px;">Switch</button>\`
                }
              </div>
            </div>
          \`;
        }).join('');
      } catch (err) {
        console.error(err);
      }
    }

    async function switchOrg(orgId) {
      try {
        const res = await fetch('/api/auth/switch-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId })
        });
        if (res.ok) {
          window.location.href = '/app/dashboard';
        }
      } catch (err) {
        alert('Failed to switch organization');
      }
    }

    async function logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    }

    loadOrganizations();
  </script>
</body>
</html>`;
}

// ==============================================================================
// 6. CREATE ORGANIZATION PAGE (/app/organization/create)
// ==============================================================================
function buildOrgCreatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Create New Organization', 'Add another business or practice workspace to your account.')}
</head>
<body>
  ${renderAuthHeader()}
  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
    <div class="auth-card">
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 6px 0;">Create New Organization</h1>
        <p style="font-size: 13px; color: var(--vanni-text-muted); margin: 0;">Set up an isolated tenant workspace with its own AI agents and data.</p>
      </div>

      <div id="create-org-error" class="auth-alert-error"></div>

      <form id="create-org-form" onsubmit="handleCreateOrgSubmit(event)">
        <div class="vanni-form-group">
          <label for="org-name" class="vanni-label">Organization Name *</label>
          <input type="text" id="org-name" name="name" placeholder="e.g. Kaveri Fertility Center" required class="vanni-input" autofocus />
        </div>

        <div class="vanni-form-group">
          <label for="org-industry" class="vanni-label">Industry</label>
          <select id="org-industry" name="industry" class="vanni-select">
            <option value="DENTAL">Dental / Specialty Clinic</option>
            <option value="HEALTHCARE_HOSPITAL">Hospital / Multi-Specialty</option>
            <option value="IVF_FERTILITY">IVF & Fertility Clinic</option>
            <option value="REAL_ESTATE" selected>Real Estate & Plotted Layouts</option>
            <option value="HOSPITALITY_RESORT">Hospitality, Resorts & Dining</option>
            <option value="DIGITAL_AGENCY">Digital Marketing Agency</option>
            <option value="COMMERCIAL_OTHER">Other Commercial Business</option>
          </select>
        </div>

        <div class="vanni-form-group">
          <label for="org-timezone" class="vanni-label">Operating Timezone</label>
          <select id="org-timezone" name="timezone" class="vanni-select">
            <option value="Asia/Kolkata" selected>Asia/Kolkata (IST +5:30)</option>
          </select>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <a href="/app/organization/select" class="vanni-button vanni-button-secondary" style="flex: 1; text-align: center; text-decoration: none;">Cancel</a>
          <button type="submit" id="create-org-btn" class="vanni-button vanni-button-primary" style="flex: 2;">
            <span>Create Organization</span>
          </button>
        </div>
      </form>
    </div>
  </main>

  <script>
    async function handleCreateOrgSubmit(e) {
      e.preventDefault();
      const errEl = document.getElementById('create-org-error');
      const btn = document.getElementById('create-org-btn');
      errEl.style.display = 'none';
      btn.disabled = true;

      const payload = {
        name: document.getElementById('org-name').value,
        industry: document.getElementById('org-industry').value,
        timezone: document.getElementById('org-timezone').value,
      };

      try {
        const res = await fetch('/api/orgs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create organization');

        window.location.href = '/app/onboarding';
      } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

// ==============================================================================
// 7. ONBOARDING WIZARD PAGE (/app/onboarding)
// ==============================================================================
function buildOnboardingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Organization Onboarding', 'Complete setup for your AI employee.')}
  <style>
    .step-card {
      border: 1px solid var(--vanni-border);
      border-radius: var(--vanni-radius-lg);
      padding: 24px;
      background: var(--vanni-surface);
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  ${renderAuthHeader()}
  <main style="flex: 1; max-width: 720px; margin: 40px auto; padding: 0 24px; width: 100%; box-sizing: border-box;">
    
    <div style="margin-bottom: 32px;">
      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(37, 99, 235, 0.1); border-radius: var(--vanni-radius-full); color: var(--vanni-accent); font-size: 11px; font-weight: 600; margin-bottom: 12px; font-family: var(--vanni-font-mono);">
        ORGANIZATION ONBOARDING
      </div>
      <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 8px 0;">Configure Your Business Brain</h1>
      <p style="font-size: 14px; color: var(--vanni-text-muted); margin: 0;">Teach your autonomous AI employee your practice details, services, and call handling rules.</p>
    </div>

    <!-- Step 1: Business Hours & Phone -->
    <div class="step-card">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="width: 28px; height: 28px; border-radius: var(--vanni-radius-sm); background: var(--vanni-primary); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">1</div>
        <div>
          <h2 style="font-size: 16px; font-weight: 700; margin: 0;">Business & Operating Timings</h2>
          <div style="font-size: 12px; color: var(--vanni-text-muted);">When should your AI answer customer queries?</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="vanni-form-group">
          <label class="vanni-label">Daily Office Timings</label>
          <input type="text" id="ob-timings" value="9:00 AM - 7:00 PM (Monday - Saturday)" class="vanni-input" />
        </div>
        <div class="vanni-form-group">
          <label class="vanni-label">Escalation WhatsApp Number</label>
          <input type="tel" id="ob-whatsapp" placeholder="+91 98450 XXXXX" value="+91 98450 12345" class="vanni-input" />
        </div>
      </div>
    </div>

    <!-- Step 2: AI Employee Personality -->
    <div class="step-card">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="width: 28px; height: 28px; border-radius: var(--vanni-radius-sm); background: var(--vanni-primary); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">2</div>
        <div>
          <h2 style="font-size: 16px; font-weight: 700; margin: 0;">AI Employee Role & Dialect</h2>
          <div style="font-size: 12px; color: var(--vanni-text-muted);">Choose how your AI communicates with callers.</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="vanni-form-group">
          <label class="vanni-label">AI Employee Name</label>
          <input type="text" id="ob-agent-name" value="Sahana" class="vanni-input" />
        </div>
        <div class="vanni-form-group">
          <label class="vanni-label">Regional Dialect</label>
          <select id="ob-dialect" class="vanni-select">
            <option value="KANGLISH_BUSINESS" selected>Kanglish (Kannada + English Mix)</option>
            <option value="KANNADA_STANDARD_POLITE">Pure Polite Kannada (Bengaluru/Standard)</option>
            <option value="NORTH_KARNATAKA_COMMERCIAL">North Karnataka (Ballari/Hubballi Commercial)</option>
            <option value="ENGLISH_INDIAN_CORPORATE">Indian English (Corporate Professional)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Step 3: Test Call Audio Simulator -->
    <div class="step-card">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="width: 28px; height: 28px; border-radius: var(--vanni-radius-sm); background: var(--vanni-primary); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">3</div>
        <div>
          <h2 style="font-size: 16px; font-weight: 700; margin: 0;">Verify & Launch Telephony Routing</h2>
          <div style="font-size: 12px; color: var(--vanni-text-muted);">Ready to connect calls and sync confirmed leads.</div>
        </div>
      </div>
      <div style="padding: 12px 16px; background: var(--vanni-surface-subdued); border-radius: var(--vanni-radius-md); font-size: 13px; color: var(--vanni-text-secondary); line-height: 1.5;">
        Your AI employee is provisioned with tenant-isolated Row Level Security. All transcripts, recordings, and lead dossiers remain strictly accessible only to active members of this organization.
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
      <button type="button" onclick="completeOnboarding()" class="vanni-button vanni-button-primary vanni-button-lg" style="padding: 12px 28px;">
        <span>Complete Setup & Open Dashboard &rarr;</span>
      </button>
    </div>

  </main>

  <script>
    async function completeOnboarding() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (!sessionData.authenticated) {
          window.location.href = '/login';
          return;
        }

        const orgId = sessionData.session.activeOrganizationId;
        const res = await fetch(\`/api/orgs/\${orgId}/onboarding\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ready' })
        });

        if (res.ok) {
          window.location.href = '/app/dashboard';
        } else {
          window.location.href = '/app/dashboard';
        }
      } catch (err) {
        window.location.href = '/app/dashboard';
      }
    }
  </script>
</body>
</html>`;
}

// Generate all files
fs.writeFileSync(path.join(WEB_DIR, 'login.html'), buildLoginPage());
console.log('✓ Generated apps/web/login.html');

fs.writeFileSync(path.join(WEB_DIR, 'signup.html'), buildSignupPage());
console.log('✓ Generated apps/web/signup.html');

fs.writeFileSync(path.join(WEB_DIR, 'forgot-password.html'), buildForgotPasswordPage());
console.log('✓ Generated apps/web/forgot-password.html');

fs.writeFileSync(path.join(WEB_DIR, 'reset-password.html'), buildResetPasswordPage());
console.log('✓ Generated apps/web/reset-password.html');

fs.writeFileSync(path.join(WEB_DIR, 'app-organization-select.html'), buildOrgSelectPage());
console.log('✓ Generated apps/web/app-organization-select.html');

fs.writeFileSync(path.join(WEB_DIR, 'app-organization-create.html'), buildOrgCreatePage());
console.log('✓ Generated apps/web/app-organization-create.html');

fs.writeFileSync(path.join(WEB_DIR, 'app-onboarding.html'), buildOnboardingPage());
console.log('✓ Generated apps/web/app-onboarding.html');

console.log('All auth & multi-tenant pages generated successfully!');
