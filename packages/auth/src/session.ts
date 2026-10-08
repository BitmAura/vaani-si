/**
 * @vanni/auth — Session Management & Organization Switching
 */

import crypto from 'node:crypto';
import { AuthSessionDTO } from '@vanni/shared';
import { InactiveMembershipError, OrganizationAccessDeniedError } from './errors.js';

export const SESSION_COOKIE_NAME = 'vanni_session';

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export const DEFAULT_COOKIE_OPTIONS: SessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

/**
 * Safely switches the active organization context for an authenticated session.
 * CRITICAL SECURITY INVARIANT:
 * Verifies that the user is an ACTIVE member of targetOrganizationId before switching.
 * Client-supplied organization IDs are NEVER blindly trusted.
 */
export function switchActiveOrganization(
  currentSession: AuthSessionDTO,
  targetOrganizationId: string
): AuthSessionDTO {
  const targetMembership = currentSession.memberships.find(
    (m) => m.organizationId === targetOrganizationId
  );

  if (!targetMembership) {
    throw new OrganizationAccessDeniedError(targetOrganizationId);
  }

  if (targetMembership.status !== 'ACTIVE') {
    throw new InactiveMembershipError();
  }

  return {
    ...currentSession,
    activeOrganizationId: targetMembership.organizationId,
    activeRole: targetMembership.role,
  };
}

// Single dev secret per process.
let cachedDevSecret: string | undefined;

/**
 * Resolves the session signing secret.
 *
 * SECURITY INVARIANT: sessions are HMAC-SHA256 signed. In production a
 * missing COOKIE_SECRET is a hard startup failure — it must never silently
 * fall back to a known constant. In development a random per-process secret
 * is generated (sessions do not survive restarts, which is acceptable for dev).
 */
export function getSessionSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (secret) {
    throw new Error('COOKIE_SECRET is set but too weak — use at least 32 random characters.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('COOKIE_SECRET is required in production. Generate one with: openssl rand -base64 48');
  }
  if (!cachedDevSecret) {
    cachedDevSecret = crypto.randomBytes(48).toString('base64url');
    console.warn('[auth] COOKIE_SECRET not set — using a random per-process dev secret. Sessions will not survive restarts.');
  }
  return cachedDevSecret;
}

/**
 * Encodes the session payload into a signed token: base64url(payload).base64url(HMAC-SHA256)
 * The signature covers the exact payload bytes, preventing tampering with
 * userId / activeOrganizationId / role claims.
 */
export function serializeSession(session: AuthSessionDTO): string {
  const json = JSON.stringify(session);
  const payload = Buffer.from(json, 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Decodes and verifies a signed session token. Returns null for any token
 * with a missing/invalid signature or malformed payload.
 */
export function deserializeSession(token: string | undefined | null): AuthSessionDTO | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  const [payload, signature] = parts;

  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as AuthSessionDTO;
    if (!parsed.userId || !parsed.email || !parsed.activeOrganizationId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
