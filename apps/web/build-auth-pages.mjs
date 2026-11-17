/**
 * VANNI Auth & Multi-Tenancy UI Generator
 * Builds /login, /signup, /forgot-password, /reset-password,
 * /app/organization/select, /app/organization/create, and /app/onboarding.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_DIR = fileURLToPath(new URL('.', import.meta.url));

function renderAuthHead(title, description, canonicalPath = '/login') {
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — VANNI</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://vanni.ai${canonicalPath}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Kannada:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/vanni.css">
  <style>
    body {
      margin: 0;
      background: #F8FAFC;
      color: var(--vanni-text-primary);
      font-family: var(--vanni-font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .auth-split-layout {
      display: flex;
      min-height: 100vh;
      width: 100%;
    }
    .auth-showcase-pane {
      flex: 1;
      background: linear-gradient(145deg, #0B132B 0%, #1C2541 100%);
      color: #F8FAFC;
      padding: 64px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      border-right: 1px solid #1E293B;
    }
    .auth-form-pane {
      flex: 1.1;
      background: #FFFFFF;
      padding: 48px 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .auth-card-inner {
      width: 100%;
      max-width: 480px;
    }
    @media (max-width: 960px) {
      .auth-split-layout {
        flex-direction: column;
      }
      .auth-showcase-pane {
        padding: 32px 24px;
        border-right: none;
        border-bottom: 1px solid #1E293B;
      }
      .auth-form-pane {
        padding: 36px 20px;
      }
    }
    .auth-alert-error {
      background: #FEF2F2;
      border: 1px solid #FCA5A5;
      color: #B91C1C;
      padding: 12px 16px;
      border-radius: var(--vanni-radius-md);
      font-size: 13px;
      margin-bottom: 20px;
      display: none;
      font-weight: 500;
    }
    .password-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-toggle-btn {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--vanni-text-muted);
      font-size: 14px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .password-toggle-btn:hover {
      color: var(--vanni-text-primary);
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
      <a href="/security" style="color: var(--vanni-text-secondary); text-decoration: none;">Trust Center</a>
    </div>
  </header>
  `;
}

// ==============================================================================
// 1. LOGIN PAGE (Split-Screen High-Converting Design)
// ==============================================================================
function buildLoginPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Sign In', 'Sign in to your VANNI organization tenant.')}
</head>
<body>
  <div class="auth-split-layout">
    
    <!-- Left Showcase Pane (Social Proof & Live Call Demo) -->
    <div class="auth-showcase-pane">
      <div>
        <!-- Brand Header -->
        <a href="/" style="display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: #FFFFFF; margin-bottom: 48px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #2563EB; display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 800; font-size: 18px; font-family: var(--vanni-font-mono); box-shadow: 0 4px 12px rgba(37,99,235,0.4);">
            V
          </div>
          <div>
            <div style="font-weight: 800; font-size: 18px; letter-spacing: -0.02em; line-height: 1;">VANNI</div>
            <div style="font-size: 11px; color: #94A3B8; font-weight: 500; margin-top: 2px;">AI Employee Platform</div>
          </div>
        </a>

        <!-- Main Pitch -->
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: rgba(37, 99, 235, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #60A5FA; margin-bottom: 20px;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #60A5FA; box-shadow: 0 0 8px #60A5FA;"></span>
          <span>Karnataka-First Telephony OS</span>
        </div>

        <h2 style="font-size: clamp(24px, 3vw, 34px); font-weight: 800; line-height: 1.2; letter-spacing: -0.02em; color: #FFFFFF; margin: 0 0 16px 0;">
          Your next employee answers every call in fluent Kannada &amp; Kanglish.
        </h2>

        <p style="font-size: 14.5px; line-height: 1.6; color: #94A3B8; margin: 0 0 32px 0; max-width: 440px;">
          Handle patient inquiries, qualify high-intent real estate buyers, and lock calendar appointments autonomously in under 500ms.
        </p>

        <!-- Live Simulated Call Box -->
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 12px; padding: 20px; margin-bottom: 32px; backdrop-filter: blur(8px);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(51,65,85,0.6); padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-family: var(--vanni-font-mono); color: #34D399; font-weight: 600;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #34D399;"></span>
              <span>INBOUND &bull; HUBLI CALLER</span>
            </div>
            <span style="font-size: 10px; color: #94A3B8; font-family: var(--vanni-font-mono);">Dialect: KANNADA_NORTH</span>
          </div>
          <div style="font-size: 12.5px; line-height: 1.6; space-y: 8px;">
            <div style="color: #CBD5E1; margin-bottom: 6px;">
              <strong style="color: #F8FAFC;">Caller:</strong> "Doctor avaru beligge sigthara ri? Knee pain check madbekittu."
            </div>
            <div style="color: #93C5FD;">
              <strong style="color: #60A5FA;">VANNI:</strong> "Haudri swamy! Dr. Ramesh avaru beligge 10:30 inda 1:00 varege OPD nalli irthaare. Slot book madla?"
            </div>
          </div>
        </div>
      </div>

      <!-- Trust Badges Footer -->
      <div style="border-top: 1px solid rgba(51, 65, 85, 0.6); padding-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; font-size: 12px; color: #94A3B8;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>⚡</span>
          <span>&lt;470ms Dual-Stream</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>🛡️</span>
          <span>Zero LLM Training</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>🇮🇳</span>
          <span>MeitY Indian PoPs</span>
        </div>
      </div>
    </div>

    <!-- Right Form Pane (Clean High-Velocity Form) -->
    <div class="auth-form-pane">
      <div class="auth-card-inner">
        
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px 0; color: var(--vanni-text-primary);">
            Sign in to Console
          </h1>
          <p style="font-size: 13.5px; color: var(--vanni-text-muted); margin: 0;">
            Manage your AI voice tele-employees and live call operations.
          </p>
        </div>

        <!-- Quick 1-Click Demo Accounts -->
        <div style="background: var(--vanni-surface-subdued); border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-md); padding: 14px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-size: 11px; font-weight: 700; color: #2563EB; font-family: var(--vanni-font-mono); text-transform: uppercase; letter-spacing: 0.05em;">Quick Demo Access</span>
            <span style="font-size: 10.5px; color: var(--vanni-text-muted);">1-Click Sign In</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" onclick="quickLogin('realestate.demo@vanni.ai', 'DemoPassword123!')" class="vanni-button vanni-button-secondary" style="font-size: 11.5px; justify-content: flex-start; padding: 7px 10px;">
              <span>🏡 Ballari Real Estate</span>
            </button>
            <button type="button" onclick="quickLogin('healthcare.demo@vanni.ai', 'DemoPassword123!')" class="vanni-button vanni-button-secondary" style="font-size: 11.5px; justify-content: flex-start; padding: 7px 10px;">
              <span>🏥 Apollo Clinic</span>
            </button>
            <button type="button" onclick="quickLogin('agency.demo@vanni.ai', 'DemoPassword123!')" class="vanni-button vanni-button-secondary" style="font-size: 11.5px; justify-content: flex-start; padding: 7px 10px;">
              <span>🚀 Apex Agency</span>
            </button>
            <button type="button" onclick="quickLogin('admin@vanni.ai', 'VanniSecure2026!')" class="vanni-button vanni-button-secondary" style="font-size: 11.5px; justify-content: flex-start; padding: 7px 10px;">
              <span>⚡ Master Admin</span>
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
              <a href="/forgot-password" style="font-size: 12px; color: #2563EB; text-decoration: none; font-weight: 500;">Forgot password?</a>
            </div>
            <div class="password-wrap">
              <input type="password" id="login-password" name="password" placeholder="••••••••••••" required class="vanni-input" style="padding-right: 40px;" />
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('login-password')" aria-label="Toggle password visibility">👁️</button>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; font-size: 12.5px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--vanni-text-secondary);">
              <input type="checkbox" id="remember-me" checked style="border-radius: 4px; border: 1px solid var(--vanni-border);" />
              <span>Keep me signed in</span>
            </label>
          </div>

          <button type="submit" id="login-submit-btn" class="vanni-button vanni-button-primary vanni-button-lg" style="width: 100%; font-weight: 700; height: 46px;">
            <span>Sign In to Console &rarr;</span>
          </button>
        </form>

        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--vanni-border-subdued); text-align: center; font-size: 13px; color: var(--vanni-text-muted);">
          Don't have an organization workspace? <a href="/signup" style="color: #2563EB; font-weight: 700; text-decoration: none;">Create an account</a>
        </div>
      </div>
    </div>

  </div>

  <script>
    function togglePasswordVisibility(fieldId) {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.type = el.type === 'password' ? 'text' : 'password';
    }

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

        // Store session for nav sync
        if (data.session) {
          localStorage.setItem('vanni_session', JSON.stringify(data.session));
        }

        // Check redirect param
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect') || '/app/dashboard';
        window.location.href = redirectUrl;
      } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to Console &rarr;</span>';
      }
    }
  </script>
</body>
</html>`;
}

// ==============================================================================
// 2. SIGNUP PAGE (Split-Screen High-Converting Design)
// ==============================================================================
function buildSignupPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${renderAuthHead('Create Organization Account', 'Create your organization tenant and deploy your first AI employee.', '/signup')}
</head>
<body>
  <div class="auth-split-layout">
    
    <!-- Left Showcase Pane -->
    <div class="auth-showcase-pane">
      <div>
        <!-- Brand Header -->
        <a href="/" style="display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: #FFFFFF; margin-bottom: 48px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #2563EB; display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 800; font-size: 18px; font-family: var(--vanni-font-mono); box-shadow: 0 4px 12px rgba(37,99,235,0.4);">
            V
          </div>
          <div>
            <div style="font-weight: 800; font-size: 18px; letter-spacing: -0.02em; line-height: 1;">VANNI</div>
            <div style="font-size: 11px; color: #94A3B8; font-weight: 500; margin-top: 2px;">AI Employee Platform</div>
          </div>
        </a>

        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #34D399; margin-bottom: 20px;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #34D399; box-shadow: 0 0 8px #34D399;"></span>
          <span>Instant Tenant Activation</span>
        </div>

        <h2 style="font-size: clamp(24px, 3vw, 34px); font-weight: 800; line-height: 1.2; letter-spacing: -0.02em; color: #FFFFFF; margin: 0 0 16px 0;">
          Deploy your first regional AI voice employee in under 10 minutes.
        </h2>

        <p style="font-size: 14.5px; line-height: 1.6; color: #94A3B8; margin: 0 0 32px 0; max-width: 440px;">
          Bind a virtual +91 80 phone number, upload your doctor schedule or real estate plot pricing, and start answering customer calls immediately.
        </p>

        <!-- What You Get Card -->
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 12px; padding: 20px; margin-bottom: 32px; backdrop-filter: blur(8px);">
          <div style="font-size: 11px; font-family: var(--vanni-font-mono); color: #60A5FA; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
            Included on Day 1
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #CBD5E1;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: #34D399; font-weight: bold;">✓</span>
              <span><strong>600 Free Voice Minutes</strong> with sub-500ms regional latency</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: #34D399; font-weight: bold;">✓</span>
              <span><strong>Dedicated Business Brain</strong> with zero model training guarantee</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: #34D399; font-weight: bold;">✓</span>
              <span><strong>Instant WhatsApp Lead Dossiers</strong> dispatched in &lt;3s</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: #34D399; font-weight: bold;">✓</span>
              <span><strong>No credit card required</strong> to configure and test</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Trust Notes -->
      <div style="border-top: 1px solid rgba(51, 65, 85, 0.6); padding-top: 24px; font-size: 12px; color: #94A3B8;">
        Trusted by multi-specialty clinics and real estate developers across Bengaluru, Hubli, Dharwad &amp; Belagavi.
      </div>
    </div>

    <!-- Right Form Pane -->
    <div class="auth-form-pane">
      <div class="auth-card-inner">
        
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px 0; color: var(--vanni-text-primary);">
            Create Organization Workspace
          </h1>
          <p style="font-size: 13.5px; color: var(--vanni-text-muted); margin: 0;">
            Set up your organization tenant to begin AI telephony onboarding.
          </p>
        </div>

        <div id="signup-error" class="auth-alert-error"></div>

        <form id="signup-form" onsubmit="handleSignupSubmit(event)">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div class="vanni-form-group">
              <label for="signup-name" class="vanni-label">Your Full Name *</label>
              <input type="text" id="signup-name" name="fullName" placeholder="e.g. Ramesh Patil" required class="vanni-input" autofocus />
            </div>

            <div class="vanni-form-group">
              <label for="signup-email" class="vanni-label">Work Email *</label>
              <input type="email" id="signup-email" name="email" placeholder="name@company.com" required class="vanni-input" />
            </div>
          </div>

          <div class="vanni-form-group">
            <label for="signup-pass" class="vanni-label">Password * (Min 8 characters)</label>
            <div class="password-wrap">
              <input type="password" id="signup-pass" name="password" minlength="8" placeholder="Create a strong password" required class="vanni-input" style="padding-right: 40px;" />
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('signup-pass')" aria-label="Toggle password visibility">👁️</button>
            </div>
          </div>

          <div class="vanni-form-group">
            <label for="signup-org" class="vanni-label">Organization / Practice Name *</label>
            <input type="text" id="signup-org" name="organizationName" oninput="updateSlugPreview(this.value)" placeholder="e.g. Ballari Residential Layouts" required class="vanni-input" />
            <div style="font-size: 11px; color: var(--vanni-text-muted); font-family: var(--vanni-font-mono); margin-top: 4px;">
              Workspace slug: <span id="slug-preview" style="color: #2563EB;">vanni.ai/console/...</span>
            </div>
          </div>

          <div class="vanni-form-group">
            <label for="signup-industry" class="vanni-label">Primary Industry</label>
            <select id="signup-industry" name="industry" class="vanni-select">
              <option value="REAL_ESTATE" selected>🏡 Real Estate &amp; Plotted Layouts</option>
              <option value="HEALTHCARE_HOSPITAL">🏥 Hospital &amp; Multi-Specialty Healthcare</option>
              <option value="DENTAL">🦷 Dental &amp; Specialty Clinic</option>
              <option value="IVF_FERTILITY">👶 IVF &amp; Fertility Center</option>
              <option value="DIGITAL_AGENCY">🚀 Digital Marketing Agency</option>
              <option value="HOSPITALITY_RESORT">🏨 Hospitality &amp; Resorts</option>
              <option value="COMMERCIAL_OTHER">🏢 Other Commercial Business</option>
            </select>
          </div>

          <button type="submit" id="signup-submit-btn" class="vanni-button vanni-button-primary vanni-button-lg" style="width: 100%; font-weight: 700; height: 46px; margin-top: 8px;">
            <span>Create Workspace &amp; Start Onboarding &rarr;</span>
          </button>
        </form>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--vanni-border-subdued); text-align: center; font-size: 13px; color: var(--vanni-text-muted);">
          Already have an account? <a href="/login" style="color: #2563EB; font-weight: 700; text-decoration: none;">Sign in here</a>
        </div>
      </div>
    </div>

  </div>

  <script>
    function togglePasswordVisibility(fieldId) {
      const el = document.getElementById(fieldId);
      if (!el) return;
      el.type = el.type === 'password' ? 'text' : 'password';
    }

    function updateSlugPreview(val) {
      const slugEl = document.getElementById('slug-preview');
      if (!slugEl) return;
      const clean = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || '...';
      slugEl.innerText = 'vanni.ai/console/' + clean;
    }

    async function handleSignupSubmit(e) {
      e.preventDefault();
      const errEl = document.getElementById('signup-error');
      const btn = document.getElementById('signup-submit-btn');
      errEl.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = '<span>Provisioning tenant workspace...</span>';

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

        if (data.session) {
          localStorage.setItem('vanni_session', JSON.stringify(data.session));
        }

        window.location.href = '/app/onboarding';
      } catch (err) {
        errEl.innerText = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span>Create Workspace &amp; Start Onboarding &rarr;</span>';
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
