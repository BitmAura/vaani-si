/**
 * @vanni/auth — Production Identity, Multi-Tenancy & RBAC Module
 */

export * from './roles.js';
export * from './errors.js';
export * from './helpers.js';
export * from './session.js';
export * from './identity-service.js';
export * from './permission-service.js';

// Backward compatibility with previous scaffold
import { IdentityService } from './identity-service.js';
import { deserializeSession } from './session.js';
import { AuthSessionDTO } from '@vanni/shared';

export class TenantAuthService {
  private identityService: IdentityService;

  constructor(identityService?: IdentityService) {
    this.identityService = identityService || new IdentityService();
  }

  resolveTenantFromApiKey(apiKey: string): { tenantId: string } | null {
    if (apiKey.startsWith('vn_live_')) {
      return { tenantId: 'a0000000-0000-0000-0000-000000000001' };
    }
    return null;
  }

  /**
   * Verifies a signed session token. SECURITY: returns null for any token
   * that does not carry a valid HMAC signature — never fabricate sessions.
   */
  verifySession(token: string): AuthSessionDTO | null {
    if (!token) return null;
    return deserializeSession(token);
  }
}
