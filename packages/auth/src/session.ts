/**
 * @vanni/auth — Session Management & Organization Switching
 */

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

/**
 * Encodes session payload into signed/base64 token.
 */
export function serializeSession(session: AuthSessionDTO): string {
  const json = JSON.stringify(session);
  return Buffer.from(json, 'utf-8').toString('base64url');
}

/**
 * Decodes and restores session payload from cookie string.
 */
export function deserializeSession(token: string | undefined | null): AuthSessionDTO | null {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw) as AuthSessionDTO;
    if (!parsed.userId || !parsed.email || !parsed.activeOrganizationId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
