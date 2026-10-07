/**
 * @vanni/auth — Complete Identity, Organization & Multi-Tenancy Service
 */

import {
  AuditLogDTO,
  AuthSessionDTO,
  BillingTier,
  CreateOrganizationInputSchema,
  InviteMemberInputSchema,
  LoginInputSchema,
  MemberStatus,
  OnboardingStatus,
  OrganizationDTO,
  OrganizationMemberDTO,
  OrganizationStatus,
  SignupInputSchema,
  UserProfileDTO,
  UserRole,
} from '@vanni/shared';
import crypto from 'node:crypto';
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  OrganizationAccessDeniedError,
  UnauthorizedError,
  ValidationError,
} from './errors.js';
import { requireOrganizationRole } from './helpers.js';
import { isRoleAtLeast } from './roles.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  timezone: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

export class IdentityService {
  private users: Map<string, StoredUser> = new Map(); // keyed by id
  private usersByEmail: Map<string, string> = new Map(); // email -> id
  private organizations: Map<string, OrganizationDTO> = new Map(); // keyed by id
  private orgsBySlug: Map<string, string> = new Map(); // slug -> id
  private members: Map<string, OrganizationMemberDTO> = new Map(); // keyed by id
  private auditLogs: AuditLogDTO[] = [];

  constructor() {
    this.seedDefaultTenants();
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private seedDefaultTenants() {
    // Default system seed user
    const adminUser: StoredUser = {
      id: 'u0000000-0000-0000-0000-000000000001',
      email: 'admin@vanni.ai',
      passwordHash: this.hashPassword('VanniSecure2026!'),
      fullName: 'VANNI System Administrator',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(adminUser.id, adminUser);
    this.usersByEmail.set(adminUser.email.toLowerCase(), adminUser.id);

    // Seed default organization 1: Ballari Residential Layouts
    const org1: OrganizationDTO = {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Ballari Residential Layouts',
      slug: 'ballari-plots',
      industry: 'REAL_ESTATE',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'GROWTH',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(org1.id, org1);
    this.orgsBySlug.set(org1.slug, org1.id);

    // Seed default organization 2: Apollo Specialty Clinic
    const org2: OrganizationDTO = {
      id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Apollo Specialty Clinic',
      slug: 'apollo-clinic',
      industry: 'HEALTHCARE_HOSPITAL',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'GROWTH',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(org2.id, org2);
    this.orgsBySlug.set(org2.slug, org2.id);

    // Seed default organization 3: Dr. Sneha Multispecialty Dental
    const org3: OrganizationDTO = {
      id: 'a0000000-0000-0000-0000-000000000003',
      name: 'Dr. Sneha Multispecialty Dental',
      slug: 'sneha-dental',
      industry: 'DENTAL',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      onboardingStatus: 'ready',
      billingTier: 'STARTER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(org3.id, org3);
    this.orgsBySlug.set(org3.slug, org3.id);

    // Add admin as OWNER to all seed orgs
    for (const org of [org1, org2, org3]) {
      const memberId = crypto.randomUUID();
      this.members.set(memberId, {
        id: memberId,
        organizationId: org.id,
        userId: adminUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
        userEmail: adminUser.email,
        userFullName: adminUser.fullName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Generates a collision-resistant URL-safe slug
   */
  public generateUniqueSlug(baseName: string): string {
    const raw = slugify(baseName) || 'organization';
    let candidate = raw;
    let counter = 1;
    while (this.orgsBySlug.has(candidate)) {
      candidate = `${raw}-${counter}`;
      counter++;
    }
    return candidate;
  }

  /**
   * Log an immutable audit event
   */
  public logAudit(log: Omit<AuditLogDTO, 'id' | 'createdAt'>): AuditLogDTO {
    const entry: AuditLogDTO = {
      id: crypto.randomUUID(),
      ...log,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  public getAuditLogs(session: AuthSessionDTO, organizationId: string): AuditLogDTO[] {
    const targetMember = session.memberships.find((m) => m.organizationId === organizationId);
    if (!targetMember || targetMember.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError(organizationId);
    }
    return this.auditLogs.filter((l) => l.organizationId === organizationId);
  }

  /**
   * 1. SIGNUP: Atomic User + Profile + Organization + Owner Membership Creation
   */
  public async signup(input: unknown): Promise<{ session: AuthSessionDTO; user: UserProfileDTO; organization: OrganizationDTO }> {
    const parsed = SignupInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid signup input');
    }

    const { fullName, email, password, organizationName, industry, timezone } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    if (this.usersByEmail.has(normalizedEmail)) {
      throw new AuthError('An account with this email address already exists.', 409, 'USER_EXISTS');
    }

    // 1. Create User
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const storedUser: StoredUser = {
      id: userId,
      email: normalizedEmail,
      passwordHash: this.hashPassword(password),
      fullName: fullName.trim(),
      timezone: timezone || 'Asia/Kolkata',
      locale: 'en-IN',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(userId, storedUser);
    this.usersByEmail.set(normalizedEmail, userId);

    // 2. Create Organization
    const orgId = crypto.randomUUID();
    const slug = this.generateUniqueSlug(organizationName);
    const org: OrganizationDTO = {
      id: orgId,
      name: organizationName.trim(),
      slug,
      industry: industry || 'REAL_ESTATE',
      status: 'ACTIVE',
      timezone: timezone || 'Asia/Kolkata',
      onboardingStatus: 'created',
      billingTier: 'STARTER',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(orgId, org);
    this.orgsBySlug.set(slug, orgId);

    // 3. Create Owner Membership
    const memberId = crypto.randomUUID();
    const membership: OrganizationMemberDTO = {
      id: memberId,
      organizationId: orgId,
      userId,
      role: 'OWNER',
      status: 'ACTIVE',
      userEmail: storedUser.email,
      userFullName: storedUser.fullName,
      createdAt: now,
      updatedAt: now,
    };
    this.members.set(memberId, membership);

    // 4. Record Audit Log
    this.logAudit({
      organizationId: orgId,
      actorUserId: userId,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: orgId,
      metadata: { name: org.name, slug: org.slug, industry: org.industry },
    });

    const userProfile: UserProfileDTO = {
      id: storedUser.id,
      fullName: storedUser.fullName,
      phone: storedUser.phone,
      avatarUrl: storedUser.avatarUrl,
      timezone: storedUser.timezone,
      locale: storedUser.locale,
      createdAt: storedUser.createdAt,
      updatedAt: storedUser.updatedAt,
    };

    const session: AuthSessionDTO = {
      userId,
      email: storedUser.email,
      fullName: storedUser.fullName,
      activeOrganizationId: orgId,
      activeRole: 'OWNER',
      memberships: [
        {
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          role: 'OWNER',
          status: 'ACTIVE',
          onboardingStatus: org.onboardingStatus,
        },
      ],
    };

    return { session, user: userProfile, organization: org };
  }

  /**
   * 2. LOGIN: Credentials verification & multi-organization membership resolution
   */
  public async login(input: unknown): Promise<{ session: AuthSessionDTO; user: UserProfileDTO }> {
    const parsed = LoginInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid login credentials');
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const userId = this.usersByEmail.get(normalizedEmail);

    if (!userId) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const storedUser = this.users.get(userId);
    if (!storedUser || storedUser.passwordHash !== this.hashPassword(password)) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    // Resolve user's memberships
    const userMemberships = Array.from(this.members.values()).filter(
      (m) => m.userId === userId && m.status === 'ACTIVE'
    );

    const activeMemberships = userMemberships
      .map((m) => {
        const org = this.organizations.get(m.organizationId);
        if (!org || org.status !== 'ACTIVE') return null;
        return {
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
          role: m.role,
          status: m.status,
          onboardingStatus: org.onboardingStatus,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const activeOrg = activeMemberships[0];
    const activeOrganizationId = activeOrg?.organizationId || '';
    const activeRole = activeOrg?.role || 'VIEWER';

    const session: AuthSessionDTO = {
      userId: storedUser.id,
      email: storedUser.email,
      fullName: storedUser.fullName,
      activeOrganizationId,
      activeRole,
      memberships: activeMemberships,
    };

    if (activeOrganizationId) {
      this.logAudit({
        organizationId: activeOrganizationId,
        actorUserId: storedUser.id,
        action: 'session.login',
        resourceType: 'session',
        resourceId: storedUser.id,
        metadata: { ip: '127.0.0.1' },
      });
    }

    const userProfile: UserProfileDTO = {
      id: storedUser.id,
      fullName: storedUser.fullName,
      phone: storedUser.phone,
      avatarUrl: storedUser.avatarUrl,
      timezone: storedUser.timezone,
      locale: storedUser.locale,
      createdAt: storedUser.createdAt,
      updatedAt: storedUser.updatedAt,
    };

    return { session, user: userProfile };
  }

  /**
   * 3. CREATE ORGANIZATION for an existing authenticated user
   */
  public async createOrganization(
    session: AuthSessionDTO,
    input: unknown
  ): Promise<{ organization: OrganizationDTO; updatedSession: AuthSessionDTO }> {
    const user = this.users.get(session.userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    const parsed = CreateOrganizationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid organization details');
    }

    const { name, industry, timezone } = parsed.data;
    const orgId = crypto.randomUUID();
    const slug = this.generateUniqueSlug(name);
    const now = new Date().toISOString();

    const org: OrganizationDTO = {
      id: orgId,
      name: name.trim(),
      slug,
      industry: industry || 'REAL_ESTATE',
      status: 'ACTIVE',
      timezone: timezone || 'Asia/Kolkata',
      onboardingStatus: 'created',
      billingTier: 'STARTER',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(orgId, org);
    this.orgsBySlug.set(slug, orgId);

    const memberId = crypto.randomUUID();
    const membership: OrganizationMemberDTO = {
      id: memberId,
      organizationId: orgId,
      userId: user.id,
      role: 'OWNER',
      status: 'ACTIVE',
      userEmail: user.email,
      userFullName: user.fullName,
      createdAt: now,
      updatedAt: now,
    };
    this.members.set(memberId, membership);

    this.logAudit({
      organizationId: orgId,
      actorUserId: user.id,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: orgId,
      metadata: { name: org.name, slug: org.slug },
    });

    const newMembershipItem = {
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: org.slug,
      role: 'OWNER' as UserRole,
      status: 'ACTIVE' as MemberStatus,
      onboardingStatus: org.onboardingStatus,
    };

    const updatedSession: AuthSessionDTO = {
      ...session,
      activeOrganizationId: orgId,
      activeRole: 'OWNER',
      memberships: [...session.memberships, newMembershipItem],
    };

    return { organization: org, updatedSession };
  }

  /**
   * 4. INVITE MEMBER to an organization (Requires ADMIN or OWNER)
   */
  public async inviteMember(
    session: AuthSessionDTO,
    organizationId: string,
    input: unknown
  ): Promise<OrganizationMemberDTO> {
    requireOrganizationRole(session, organizationId, 'ADMIN');

    const parsed = InviteMemberInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid invite parameters');
    }

    const { email, role } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if target user exists; if not, create placeholder user
    let targetUserId = this.usersByEmail.get(normalizedEmail);
    if (!targetUserId) {
      targetUserId = crypto.randomUUID();
      const now = new Date().toISOString();
      const placeholderUser: StoredUser = {
        id: targetUserId,
        email: normalizedEmail,
        passwordHash: this.hashPassword(crypto.randomBytes(16).toString('hex')),
        fullName: normalizedEmail.split('@')[0],
        timezone: 'Asia/Kolkata',
        locale: 'en-IN',
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(targetUserId, placeholderUser);
      this.usersByEmail.set(normalizedEmail, targetUserId);
    }

    // Check if member already exists in this org
    const existing = Array.from(this.members.values()).find(
      (m) => m.organizationId === organizationId && m.userId === targetUserId
    );
    if (existing) {
      throw new AuthError('This user is already a member of this organization.', 409, 'ALREADY_MEMBER');
    }

    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newMember: OrganizationMemberDTO = {
      id: memberId,
      organizationId,
      userId: targetUserId,
      role,
      status: 'INVITED',
      userEmail: normalizedEmail,
      userFullName: this.users.get(targetUserId)?.fullName,
      createdAt: now,
      updatedAt: now,
    };
    this.members.set(memberId, newMember);

    this.logAudit({
      organizationId,
      actorUserId: session.userId,
      action: 'member.invited',
      resourceType: 'member',
      resourceId: memberId,
      metadata: { email: normalizedEmail, role },
    });

    return newMember;
  }

  /**
   * 5. UPDATE MEMBER ROLE (Requires ADMIN or OWNER)
   */
  public async updateMemberRole(
    session: AuthSessionDTO,
    organizationId: string,
    targetUserId: string,
    newRole: UserRole
  ): Promise<OrganizationMemberDTO> {
    requireOrganizationRole(session, organizationId, 'ADMIN');

    const member = Array.from(this.members.values()).find(
      (m) => m.organizationId === organizationId && m.userId === targetUserId
    );
    if (!member) {
      throw new NotFoundError('Member');
    }

    // Only OWNER can promote someone to OWNER or demote an OWNER
    if (newRole === 'OWNER' || member.role === 'OWNER') {
      requireOrganizationRole(session, organizationId, 'OWNER');
    }

    const oldRole = member.role;
    member.role = newRole;
    member.updatedAt = new Date().toISOString();

    this.logAudit({
      organizationId,
      actorUserId: session.userId,
      action: 'member.role_changed',
      resourceType: 'member',
      resourceId: member.id,
      metadata: { targetUserId, oldRole, newRole },
    });

    return member;
  }

  /**
   * 6. UPDATE ONBOARDING STATUS
   */
  public async updateOnboardingStatus(
    session: AuthSessionDTO,
    organizationId: string,
    status: OnboardingStatus
  ): Promise<OrganizationDTO> {
    requireOrganizationRole(session, organizationId, 'ADMIN');

    const org = this.organizations.get(organizationId);
    if (!org) {
      throw new NotFoundError('Organization');
    }

    org.onboardingStatus = status;
    org.updatedAt = new Date().toISOString();

    this.logAudit({
      organizationId,
      actorUserId: session.userId,
      action: 'organization.onboarding_updated',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: { onboardingStatus: status },
    });

    return org;
  }

  /**
   * Helper getters for multi-tenant checks
   */
  public getOrganization(organizationId: string): OrganizationDTO | null {
    return this.organizations.get(organizationId) || null;
  }

  public getOrganizationMembers(session: AuthSessionDTO, organizationId: string): OrganizationMemberDTO[] {
    const targetMember = session.memberships.find((m) => m.organizationId === organizationId);
    if (!targetMember || targetMember.status !== 'ACTIVE') {
      throw new OrganizationAccessDeniedError(organizationId);
    }

    return Array.from(this.members.values()).filter(
      (m) => m.organizationId === organizationId
    );
  }
}
