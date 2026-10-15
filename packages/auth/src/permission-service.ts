/**
 * @vanni/auth — Centralized Permission Service & Server Authorization Guard
 *
 * Enforces server-side authorization:
 * - Session extraction & tenant scoping
 * - Role permission checks
 * - Resource ownership verification
 * - Rejection of unauthenticated or unauthorized operations
 */

import { UserRole, AuthSessionDTO } from '@vanni/shared';
import { canManageBilling, hasPermission, Permission } from './roles.js';
import { deserializeSession, SESSION_COOKIE_NAME } from './session.js';

export interface RequestAuthContext {
  userId: string;
  organizationId: string;
  role: UserRole;
  isAuthenticated: boolean;
}

export class PermissionService {
  /**
   * Resolves authentication and organization tenancy from request headers.
   * Extracts token from vanni_session cookie or Authorization: Bearer <token>.
   * Never trusts client-supplied organizationId or role if unauthenticated.
   * Returns isAuthenticated: false if token is missing or invalid.
   */
  static resolveAuthContext(headers: Record<string, string | string[] | undefined>): RequestAuthContext {
    let token: string | undefined;

    // 1. Check Authorization: Bearer <token>
    const authHeader = (headers['authorization'] as string) || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. If no bearer, check cookie header for vanni_session
    if (!token && headers['cookie']) {
      const cookieHeader = Array.isArray(headers['cookie']) ? headers['cookie'].join('; ') : headers['cookie'];
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      return {
        userId: '',
        organizationId: '',
        role: 'VIEWER',
        isAuthenticated: false,
      };
    }

    const session = deserializeSession(token);
    if (!session) {
      return {
        userId: '',
        organizationId: '',
        role: 'VIEWER',
        isAuthenticated: false,
      };
    }

    return {
      userId: session.userId,
      organizationId: session.activeOrganizationId,
      role: session.activeRole as UserRole,
      isAuthenticated: true,
    };
  }

  /**
   * Asserts user has required permission; throws error if unauthorized
   */
  static assertPermission(role: UserRole, permission: Permission, operationName: string = 'Operation'): void {
    if (!hasPermission(role, permission)) {
      const err = new Error(`Forbidden: Role '${role}' lacks permission '${permission}' for ${operationName}`);
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }
  }

  /**
   * Validates organization ownership of resource
   */
  static assertTenantOwnership(expectedOrgId: string, resourceOrgId: string, resourceType: string = 'Resource'): void {
    if (expectedOrgId !== resourceOrgId) {
      const err = new Error(`Forbidden: Cross-tenant access denied. Cannot access ${resourceType} belonging to another organization.`);
      (err as any).statusCode = 403;
      (err as any).code = 'CROSS_TENANT_ACCESS_DENIED';
      throw err;
    }
  }
}
