import fs from 'node:fs';
import path from 'node:path';
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

  private persistEnabled = false;
  private persistPath: string | null = null;

  constructor(options?: { persist?: boolean; storePath?: string }) {
    // SECURITY: demo accounts and demo organizations are deliberately NOT seeded.
    // Accounts and organizations are created exclusively through signup/admin flows.
    const isTest = process.env.NODE_ENV === 'test';
    this.persistEnabled = options?.persist ?? (!isTest && process.env.DISABLE_AUTH_PERSISTENCE !== 'true');

    if (this.persistEnabled) {
      const customPath = options?.storePath || process.env.AUTH_STORE_PATH;
      if (customPath) {
        this.persistPath = customPath;
      } else if (process.env.VERCEL) {
        // Vercel serverless lambdas have a read-only filesystem except /tmp
        this.persistPath = '/tmp/auth_store.json';
      } else {
        const cwdData = path.resolve(process.cwd(), 'data');
        const rootData = path.resolve(process.cwd(), '../../data');
        const dataDir = fs.existsSync(rootData) ? rootData : cwdData;
        if (!fs.existsSync(dataDir)) {
          try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
        }
        this.persistPath = path.join(dataDir, 'auth_store.json');
      }
      this.loadSnapshot();
      const allowDemo = process.env.ALLOW_DEMO_ACCOUNTS === 'true' || process.env.SEED_DEV_ACCOUNTS === 'true';
      if (this.users.size === 0 && !isTest && (process.env.NODE_ENV !== 'production' || allowDemo) && process.env.SEED_DEV_ACCOUNTS !== 'false') {
        this.seedDevAccountsIfEmpty(allowDemo);
      }
    }
  }

  private loadSnapshot(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          this.users.set(u.id, u);
          this.usersByEmail.set(u.email.toLowerCase().trim(), u.id);
        }
      }
      if (Array.isArray(data.organizations)) {
        for (const o of data.organizations) {
          this.organizations.set(o.id, o);
          this.orgsBySlug.set(o.slug, o.id);
        }
      }
      if (Array.isArray(data.members)) {
        for (const m of data.members) {
          this.members.set(m.id, m);
        }
      }
      if (Array.isArray(data.auditLogs)) {
        this.auditLogs = data.auditLogs;
      }
    } catch (err) {
      console.warn('[IdentityService] Warning: Failed to load auth_store.json snapshot:', err);
    }
  }

  private saveSnapshot(): void {
    if (!this.persistEnabled || !this.persistPath) return;
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      users: Array.from(this.users.values()),
      organizations: Array.from(this.organizations.values()),
      members: Array.from(this.members.values()),
      auditLogs: this.auditLogs.slice(0, 500),
    };
    const tmp = `${this.persistPath}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, this.persistPath);
    } catch {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {}
      try {
        fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), 'utf8');
      } catch {}
    }
  }

  /**
   * Password hashing via scrypt (Node built-in, memory-hard, salted).
   * Format: scrypt$<saltHex>$<hashHex>
   * SECURITY: never use unsalted SHA-256 for passwords (rainbow-table trivial).
   */
  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
  }

  /**
   * Constant-time password verification supporting only the current scrypt format.
   */
  private verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
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
          industry: org.industry,
          role: 'OWNER',
          status: 'ACTIVE',
          onboardingStatus: org.onboardingStatus,
        },
      ],
    };

    this.saveSnapshot();
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
    if (!storedUser || !this.verifyPassword(password, storedUser.passwordHash)) {
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
          industry: org.industry,
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
      industry: org.industry,
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

    this.saveSnapshot();
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

    this.saveSnapshot();
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

    this.saveSnapshot();
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

    this.saveSnapshot();
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

  /**
   * Safely seeds local development demo accounts when running locally without Supabase.
   * EXPLICIT SECURITY INVARIANT:
   * Strictly blocked in production (NODE_ENV === 'production') and during automated test runs.
   * Passwords are cryptographically hashed using scrypt.
   */
  public seedDevAccountsIfEmpty(force?: boolean): boolean {
    const allowDemo = process.env.ALLOW_DEMO_ACCOUNTS === 'true' || process.env.SEED_DEV_ACCOUNTS === 'true';
    if (process.env.NODE_ENV === 'production' && !allowDemo && !force) {
      // STRICT HARD INVARIANT: Demo accounts are NEVER seeded in production unless explicitly enabled via ALLOW_DEMO_ACCOUNTS=true
      return false;
    }
    if (!force && !allowDemo && process.env.NODE_ENV === 'test') {
      return false;
    }
    const now = new Date().toISOString();
    const demoConfigs = [
      {
        userId: 'usr_demo_agency',
        email: 'agency.demo@vanni.ai',
        fullName: 'Aditya Rao (Agency Director)',
        orgId: 'org_demo_agency',
        orgName: 'Apex Growth Marketing Agency',
        slug: 'apex-agency',
        industry: 'AGENCY' as const,
        role: 'OWNER' as const,
      },
      {
        userId: 'usr_demo_real_estate',
        email: 'realestate.demo@vanni.ai',
        fullName: 'Suresh Patil (Managing Partner)',
        orgId: 'org_demo_real_estate',
        orgName: 'Ballari Residential Layouts',
        slug: 'ballari-layouts',
        industry: 'REAL_ESTATE' as const,
        role: 'OWNER' as const,
      },
      {
        userId: 'usr_demo_healthcare',
        email: 'healthcare.demo@vanni.ai',
        fullName: 'Dr. Ramesh Kumar (Medical Director)',
        orgId: 'org_demo_healthcare',
        orgName: 'Apollo Specialty Clinic & Hospital',
        slug: 'apollo-clinic',
        industry: 'HEALTHCARE_HOSPITAL' as const,
        role: 'OWNER' as const,
      },
    ];

    const passwordHash = this.hashPassword('DemoPassword123!');

    for (const d of demoConfigs) {
      const user: StoredUser = {
        id: d.userId,
        email: d.email.toLowerCase().trim(),
        passwordHash,
        fullName: d.fullName,
        timezone: 'Asia/Kolkata',
        locale: 'en-IN',
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(d.userId, user);
      this.usersByEmail.set(d.email.toLowerCase().trim(), d.userId);

      const org: OrganizationDTO = {
        id: d.orgId,
        name: d.orgName,
        slug: d.slug,
        industry: d.industry,
        status: 'ACTIVE',
        timezone: 'Asia/Kolkata',
        onboardingStatus: 'ready',
        billingTier: 'GROWTH',
        createdAt: now,
        updatedAt: now,
      };
      this.organizations.set(d.orgId, org);
      this.orgsBySlug.set(d.slug, d.orgId);

      const memberId = `mem_${d.userId}_${d.orgId}`;
      const member: OrganizationMemberDTO = {
        id: memberId,
        organizationId: d.orgId,
        userId: d.userId,
        role: d.role,
        status: 'ACTIVE',
        userEmail: d.email,
        userFullName: d.fullName,
        createdAt: now,
        updatedAt: now,
      };
      this.members.set(memberId, member);
    }

    this.saveSnapshot();
    return true;
  }

}
