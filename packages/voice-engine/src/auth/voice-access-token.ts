/**
 * Voice Access Tokens — short-lived signed credentials for opening a
 * WebSocket voice stream against a specific tenant + agent.
 *
 * SECURITY: the voice-gateway WS endpoint must never accept an unauthenticated
 * org/agent selection in production. The API server mints a token for an
 * authenticated user session; the gateway verifies the HMAC before wiring a
 * session. Tokens expire by default after 15 minutes.
 */

import crypto from 'node:crypto';

export interface VoiceAccessTokenClaims {
  organizationId: string;
  agentId: string;
  /** Expiry, epoch ms. */
  exp: number;
  /** Issued at, epoch ms. */
  iat: number;
}

export interface VoiceAccessTokenOptions {
  /** Token lifetime in ms. Default 15 minutes. */
  ttlMs?: number;
}

// Single dev key per process.
let cachedDevKey: string | undefined;

function getSigningKey(): string {
  const secret = process.env.VOICE_TOKEN_SECRET || process.env.COOKIE_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'VOICE_TOKEN_SECRET (or COOKIE_SECRET) is required in production for voice stream auth. Generate one with: openssl rand -base64 48'
    );
  }
  // Dev fallback: random per-process key so dev WS connections work out of the box.
  if (!cachedDevKey) {
    cachedDevKey = crypto.randomBytes(48).toString('base64url');
  }
  return cachedDevKey;
}

/**
 * Mints a signed voice access token: base64url(claimsJson).base64url(HMAC-SHA256)
 */
export function createVoiceAccessToken(
  claims: { organizationId: string; agentId: string },
  options: VoiceAccessTokenOptions = {}
): string {
  const now = Date.now();
  const full: VoiceAccessTokenClaims = {
    organizationId: claims.organizationId,
    agentId: claims.agentId,
    iat: now,
    exp: now + (options.ttlMs ?? 15 * 60 * 1000),
  };
  const payload = Buffer.from(JSON.stringify(full), 'utf-8').toString('base64url');
  const signature = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export interface VoiceTokenVerification {
  valid: boolean;
  reason?: string;
  claims?: VoiceAccessTokenClaims;
}

/**
 * Verifies signature + expiry. Constant-time comparison.
 */
export function verifyVoiceAccessToken(token: string | undefined | null): VoiceTokenVerification {
  if (!token) {
    return { valid: false, reason: 'MISSING_TOKEN' };
  }
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }
  const [payload, signature] = parts;

  const expected = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as VoiceAccessTokenClaims;
    if (!claims.organizationId || !claims.agentId || typeof claims.exp !== 'number') {
      return { valid: false, reason: 'INVALID_CLAIMS' };
    }
    if (Date.now() > claims.exp) {
      return { valid: false, reason: 'TOKEN_EXPIRED' };
    }
    return { valid: true, claims };
  } catch {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }
}
