/**
 * VANNI Autonomous Voice AI — Canonical Frontend Authentication Guard
 *
 * Implements Phase 2 & Phase 4 session contract:
 * - Server is sole source of truth via HTTP-only HMAC-SHA256 cookie & GET /api/auth/session
 * - Never authenticates solely on client localStorage values
 * - Handles three distinct states:
 *     1. Authenticated: proceeds with session payload
 *     2. Unauthenticated: redirects safely to /login?redirect=<safePath>
 *     3. Validation Failed (network/server error): presents clear banner & retry, never silently authenticates
 * - Safe sanitization of redirects
 * - Clean logout that calls POST /api/auth/logout before clearing local cache and redirecting
 */
(function(window) {
  'use strict';

  function sanitizePath(rawUrl, defaultPath) {
    if (!defaultPath) defaultPath = '/app/dashboard';
    if (!rawUrl || typeof rawUrl !== 'string') return defaultPath;
    var trimmed = rawUrl.trim();
    // Safe relative path: must start with single '/' and not '//' or '/\\'
    // Must not contain ':' before '?' (rejects javascript:, http:, https:, etc.)
    if (/^\/(?!\/|\\)[a-zA-Z0-9_\-\/.?=&%#]*$/.test(trimmed)) {
      var pathPart = trimmed.split('?')[0];
      if (pathPart.indexOf(':') === -1 && pathPart.indexOf('\\') === -1) {
        return trimmed;
      }
    }
    return defaultPath;
  }

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function getSafeRedirectUrl(defaultPath) {
    var redirectParam = getQueryParam('redirect') || getQueryParam('returnUrl');
    return sanitizePath(redirectParam, defaultPath || '/app/dashboard');
  }

  async function checkSession() {
    try {
      var res = await fetch('/api/auth/session', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      if (res.status === 401) {
        return { state: 'unauthenticated', session: null };
      }
      if (!res.ok) {
        return { state: 'error', error: 'Server returned HTTP ' + res.status };
      }
      var data = await res.json();
      if (data && data.authenticated && data.session) {
        return { state: 'authenticated', session: data.session, user: data.user || null };
      }
      return { state: 'unauthenticated', session: null };
    } catch (err) {
      return { state: 'error', error: err && err.message ? err.message : 'Network error verifying session' };
    }
  }

  function showConnectionErrorBanner(message, onRetry) {
    var existing = document.getElementById('vanni-auth-error-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'vanni-auth-error-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#FEF2F2;border-bottom:1px solid #FCA5A5;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;color:#991B1B;font-family:Inter,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.06);';
    
    var textDiv = document.createElement('div');
    textDiv.style.cssText = 'display:flex;align-items:center;gap:10px;';
    textDiv.innerHTML = '<span style="font-size:16px;">⚠️</span> <span><strong>Authentication verification failed:</strong> ' + (message || 'Unable to reach the authentication service.') + '</span>';
    
    var actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display:flex;align-items:center;gap:8px;';
    
    var retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry Connection';
    retryBtn.style.cssText = 'background:#DC2626;color:#FFF;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;';
    retryBtn.onclick = function() {
      banner.remove();
      if (onRetry) onRetry();
      else window.location.reload();
    };

    var loginBtn = document.createElement('a');
    loginBtn.textContent = 'Go to Login';
    loginBtn.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    loginBtn.style.cssText = 'color:#991B1B;text-decoration:underline;font-size:12px;margin-left:8px;';

    actionsDiv.appendChild(retryBtn);
    actionsDiv.appendChild(loginBtn);
    banner.appendChild(textDiv);
    banner.appendChild(actionsDiv);
    document.body.prepend(banner);
  }

  async function requireAuthSession(options) {
    var opts = options || {};
    var onSession = opts.onSession;
    var result = await checkSession();

    if (result.state === 'authenticated') {
      try {
        localStorage.setItem('vanni_org_name', result.session.activeOrganizationName || (result.session.memberships && result.session.memberships[0] && result.session.memberships[0].organizationName) || '');
        localStorage.setItem('vanni_active_tenant', result.session.activeOrganizationId || '');
      } catch (e) {}

      if (typeof onSession === 'function') {
        onSession(result.session);
      }
      return result.session;
    }

    if (result.state === 'unauthenticated') {
      var currentTarget = window.location.pathname + window.location.search;
      var safeRedirect = sanitizePath(currentTarget, '/app/dashboard');
      window.location.href = '/login?redirect=' + encodeURIComponent(safeRedirect);
      return null;
    }

    // result.state === 'error'
    // FAIL-CLOSED: never create an authenticated session on error!
    showConnectionErrorBanner(result.error, function() {
      requireAuthSession(options);
    });
    return null;
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) {
      console.warn('Logout API call exception', e);
    }
    try {
      localStorage.removeItem('vanni_session');
      localStorage.removeItem('vanni_user');
      localStorage.removeItem('vanni_org_name');
      localStorage.removeItem('vanni_active_tenant');
      localStorage.removeItem('dhwani_active_tenant');
    } catch (e) {}
    window.location.href = '/login';
  }

  window.VanniAuth = {
    checkSession: checkSession,
    requireAuthSession: requireAuthSession,
    sanitizePath: sanitizePath,
    getSafeRedirectUrl: getSafeRedirectUrl,
    showConnectionErrorBanner: showConnectionErrorBanner,
    logout: logout
  };
})(window);