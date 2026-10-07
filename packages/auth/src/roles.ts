/**
 * @vanni/auth — Roles & Permission Hierarchy
 */

import { UserRole } from '@vanni/shared';

export type Permission =
  // Organization lifecycle
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:billing'
  // Member management
  | 'member:read'
  | 'member:invite'
  | 'member:update'
  | 'member:remove'
  // Agents (AI Employees)
  | 'agent:read'
  | 'agent:write'
  | 'agent:delete'
  // Calls & Transcripts
  | 'call:read'
  | 'call:write'
  | 'call:delete'
  // Leads & CRM
  | 'lead:read'
  | 'lead:write'
  // Appointments
  | 'appointment:read'
  | 'appointment:write'
  // Knowledge & Business Brain
  | 'knowledge:read'
  | 'knowledge:write'
  // Outbound Campaigns
  | 'campaign:read'
  | 'campaign:write'
  // Integrations (WhatsApp, CRM, Telephony)
  | 'integration:read'
  | 'integration:write'
  // Audit Logs
  | 'audit:read';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  VIEWER: 1,
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    'org:read',
    'org:update',
    'org:delete',
    'org:billing',
    'member:read',
    'member:invite',
    'member:update',
    'member:remove',
    'agent:read',
    'agent:write',
    'agent:delete',
    'call:read',
    'call:write',
    'call:delete',
    'lead:read',
    'lead:write',
    'appointment:read',
    'appointment:write',
    'knowledge:read',
    'knowledge:write',
    'campaign:read',
    'campaign:write',
    'integration:read',
    'integration:write',
    'audit:read',
  ],
  ADMIN: [
    'org:read',
    'org:update',
    'org:billing',
    'member:read',
    'member:invite',
    'member:update',
    'agent:read',
    'agent:write',
    'agent:delete',
    'call:read',
    'call:write',
    'lead:read',
    'lead:write',
    'appointment:read',
    'appointment:write',
    'knowledge:read',
    'knowledge:write',
    'campaign:read',
    'campaign:write',
    'integration:read',
    'integration:write',
    'audit:read',
  ],
  MANAGER: [
    'org:read',
    'member:read',
    'agent:read',
    'agent:write',
    'call:read',
    'call:write',
    'lead:read',
    'lead:write',
    'appointment:read',
    'appointment:write',
    'knowledge:read',
    'campaign:read',
    'campaign:write',
    'audit:read',
  ],
  VIEWER: [
    'org:read',
    'member:read',
    'agent:read',
    'call:read',
    'lead:read',
    'appointment:read',
    'knowledge:read',
    'campaign:read',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function canManageBilling(role: UserRole): boolean {
  return hasPermission(role, 'org:billing');
}

export function isRoleAtLeast(currentRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[currentRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}
