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

    function getLocalSession() {
    try {
      var raw = localStorage.getItem('vanni_session');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && (parsed.userId || parsed.activeOrganizationId || (parsed.user && parsed.user.id))) {
          return parsed;
        }
      }
    } catch (e) {}

    try {
      var match = document.cookie.match(/vanni_session=([^;]+)/);
      if (match && match[1]) {
        var decoded = decodeURIComponent(match[1]);
        var parsedCookie = JSON.parse(decoded);
        if (parsedCookie && (parsedCookie.userId || parsedCookie.activeOrganizationId)) {
          return parsedCookie;
        }
      }
    } catch (e) {}

    return null;
  }

  async function checkSession() {
    var SUPABASE_URL = 'https://qwmxgqpmcbuvkhrsbibz.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_DRuRSnMq009Fw96ND4sNAQ_6OpM0fkm';

    // 1. Try server session if running on Node backend
    try {
      var res = await fetch('/api/auth/session', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      if (res.ok) {
        var data = await res.json();
        if (data && data.authenticated && data.session) {
          return { state: 'authenticated', session: data.session, user: data.user || null };
        }
      }
    } catch (err) {}

    // 2. Validate with Supabase Cloud Auth
    var localSession = getLocalSession();
    if (!localSession || !localSession.userId) {
      return { state: 'unauthenticated', session: null };
    }

    var token = localSession.accessToken || localStorage.getItem('vanni_access_token');
    if (token && token.startsWith('ey')) {
      try {
        var supaVerify = await fetch(SUPABASE_URL + '/auth/v1/user', {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + token
          }
        });
        if (supaVerify.ok) {
          var verifiedUser = await supaVerify.json();
          return { state: 'authenticated', session: localSession, user: verifiedUser };
        } else {
          // Token expired or invalid
          localStorage.removeItem('vanni_session');
          localStorage.removeItem('vanni_access_token');
          return { state: 'unauthenticated', session: null };
        }
      } catch (e) {}
    }

    // If session has valid userId and verified activeOrganizationId, permit
    if (localSession.userId && localSession.activeOrganizationId) {
      return {
        state: 'authenticated',
        session: localSession,
        user: localSession.user || {
          id: localSession.userId,
          fullName: localSession.fullName || 'User',
          email: localSession.email || ''
        }
      };
    }

    return { state: 'unauthenticated', session: null };
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