/**
 * @vanni/auth — Server-Side Authorization Helpers
 *
 * Ensures all resource access is gated by strict tenancy and role checks
 * BEFORE any database mutation or query execution.
 */

import { AuthSessionDTO, UserRole } from '@vanni/shared';
import {
  UnauthorizedError,
  ForbiddenError,
  OrganizationAccessDeniedError,
  InactiveMembershipError,
} from './errors.js';
import { hasPermission, isRoleAtLeast, Permission } from './roles.js';

export interface ResourceWithOrganizationId {
  organizationId?: string;
  tenantId?: string;
}

/**
 * Validates that an authenticated session exists.
 * Throws UnauthorizedError (401) if missing or invalid.
 */
export function requireUser(session: AuthSessionDTO | null | undefined): AuthSessionDTO {
  if (!session || !session.userId) {
    throw new UnauthorizedError('Your session has expired. Please sign in again.');
  }
  return session;
}

/**
 * Validates that the user is an active member of the target organization.
 * Throws ForbiddenError (403) on cross-tenant access attempts.
 */
export function requireOrganizationMember(
  session: AuthSessionDTO | null | undefined,
  targetOrganizationId: string
): { role: UserRole; organizationId: string } {
  const userSession = requireUser(session);

  const membership = userSession.memberships.find(
    (m) => m.organizationId === targetOrganizationId
  );

  if (!membership) {
    throw new OrganizationAccessDeniedError(targetOrganizationId);
  }

  if (membership.status !== 'ACTIVE') {
    throw new InactiveMembershipError();
  }

  return {
    role: membership.role,
    organizationId: membership.organizationId,
  };
}

/**
 * Validates that the user has at least the required role in the target organization.
 * e.g., OWNER > ADMIN > MANAGER > VIEWER
 */
export function requireOrganizationRole(
  session: AuthSessionDTO | null | undefined,
  targetOrganizationId: string,
  minimumRole: UserRole
): { role: UserRole; organizationId: string } {
  const { role } = requireOrganizationMember(session, targetOrganizationId);

  if (!isRoleAtLeast(role, minimumRole)) {
    throw new ForbiddenError(
      `This action requires ${minimumRole} privileges. Your current role is ${role}.`
    );
  }

  return { role, organizationId: targetOrganizationId };
}

/**
 * Validates that the user has specific fine-grained permission in the target organization.
 */
export function requirePermission(
  session: AuthSessionDTO | null | undefined,
  targetOrganizationId: string,
  permission: Permission
): { role: UserRole; organizationId: string } {
  const { role } = requireOrganizationMember(session, targetOrganizationId);

  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`You do not have permission '${permission}' in this organization.`);
  }

  return { role, organizationId: targetOrganizationId };
}

/**
 * Validates that a resource belongs to an organization the user is an active member of.
 * Prevents cross-tenant parameter tampering on GET / POST / PATCH / DELETE.
 */
export function requireOrganizationAccess<T extends ResourceWithOrganizationId>(
  session: AuthSessionDTO | null | undefined,
  resource: T
): T {
  const orgId = resource.organizationId || resource.tenantId;
  if (!orgId) {
    throw new ForbiddenError('Resource does not contain an organization boundary.');
  }

  requireOrganizationMember(session, orgId);
  return resource;
}
