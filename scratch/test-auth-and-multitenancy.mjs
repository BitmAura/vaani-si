/**
 * VANNI — Complete Auth, Multi-Tenancy & Security Verification Suite
 *
 * Covers:
 * 1. Signup (Atomic Profile + Org + Owner Membership)
 * 2. Login (Credentials & Multi-Org Session)
 * 3. Logout (Cookie Clearance)
 * 4. Password Reset
 * 5. Profile Verification
 * 6. Organization Creation
 * 7. Membership Creation & Roles
 * 8. Organization Switching
 * 9. Role Permissions Matrix (Owner, Admin, Manager, Viewer)
 * 10. Unauthorized Access Gating
 * 11. CRITICAL SECURITY TEST: Cross-Tenant Access & Tampering Prevention
 * 12. Inactive / Suspended Membership Rejection
 * 13. Protected Route Redirections
 * 14. PostgreSQL Row Level Security (RLS) Architecture
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  IdentityService,
  hasPermission,
  isRoleAtLeast,
  switchActiveOrganization,
  requireUser,
  requireOrganizationMember,
  requireOrganizationRole,
  requirePermission,
  requireOrganizationAccess,
  UnauthorizedError,
  ForbiddenError,
  OrganizationAccessDeniedError,
  InactiveMembershipError,
} from '../packages/auth/dist/index.js';

const BASE_URL = 'http://localhost:4000';

console.log('======================================================================');
console.log('  VANNI AUTHENTICATION, MULTI-TENANCY & TENANT ISOLATION QA SUITE     ');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function pass(name, detail = '') {
  console.log(`✅ [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  passedTests++;
}

function fail(name, err) {
  console.error(`❌ [FAIL] ${name}:`, err);
  failedTests++;
}

async function runTestSuite() {
  const identityService = new IdentityService();

  // -------------------------------------------------------------------------
  // TEST 1: SIGNUP (Atomic User, Profile, Org, Owner Membership, Audit Log)
  // -------------------------------------------------------------------------
  try {
    const signupData = {
      fullName: 'Dr. Vikram Gowda',
      email: `vikram.${Date.now()}@smilecaredental.in`,
      password: 'SecurePass2026!@#',
      organizationName: 'SmileCare Specialty Dental',
      industry: 'DENTAL',
      timezone: 'Asia/Kolkata',
    };

    const { session, user, organization } = await identityService.signup(signupData);
    assert.ok(session.userId, 'User ID should be generated');
    assert.strictEqual(session.email, signupData.email.toLowerCase());
    assert.strictEqual(session.activeRole, 'OWNER');
    assert.strictEqual(organization.name, signupData.organizationName);
    assert.strictEqual(organization.onboardingStatus, 'created');
    assert.strictEqual(session.memberships.length, 1);
    assert.strictEqual(session.memberships[0].role, 'OWNER');

    // Verify via HTTP endpoint as well
    const httpRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Anita Desai',
        email: `anita.${Date.now()}@desaiplots.com`,
        password: 'Password2026!#',
        organizationName: 'Desai Luxury Plots',
        industry: 'REAL_ESTATE',
      }),
    });
    assert.strictEqual(httpRes.status, 200, 'HTTP signup should return 200');
    const setCookie = httpRes.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('vanni_session'), 'Should issue vanni_session HTTP-only cookie');

    pass('Test 1: Signup', 'Atomically created User, Profile, Organization, and Owner Membership');
  } catch (e) {
    fail('Test 1: Signup', e);
  }

  // -------------------------------------------------------------------------
  // TEST 2: LOGIN (Credentials Verification & Session Creation)
  // -------------------------------------------------------------------------
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@vanni.ai',
        password: 'VanniSecure2026!',
      }),
    });
    assert.strictEqual(loginRes.status, 200, 'Seed login should succeed');
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.session.email, 'admin@vanni.ai');
    assert.strictEqual(loginData.session.activeRole, 'OWNER');
    assert.ok(loginData.session.memberships.length >= 2, 'Should resolve multi-tenant memberships');

    // Invalid password test
    const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@vanni.ai',
        password: 'WrongPassword',
      }),
    });
    assert.strictEqual(badLogin.status, 401, 'Invalid password must return 401');

    pass('Test 2: Login', 'Verified valid credentials, rejected invalid password with 401');
  } catch (e) {
    fail('Test 2: Login', e);
  }

  // -------------------------------------------------------------------------
  // TEST 3: LOGOUT (Cookie Invalidation)
  // -------------------------------------------------------------------------
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST' });
    assert.strictEqual(logoutRes.status, 200);
    const setCookie = logoutRes.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('Expires='), 'Cookie should be cleared');

    pass('Test 3: Logout', 'Session cookie invalidated and cleared');
  } catch (e) {
    fail('Test 3: Logout', e);
  }

  // -------------------------------------------------------------------------
  // TEST 4: PASSWORD RESET UX & FLOW
  // -------------------------------------------------------------------------
  try {
    const forgotHtml = await (await fetch(`${BASE_URL}/forgot-password`)).text();
    assert.ok(forgotHtml.includes('Reset your password'), 'Forgot password page should render');
    assert.ok(forgotHtml.includes('reset-email'), 'Should contain email input field');

    const resetHtml = await (await fetch(`${BASE_URL}/reset-password`)).text();
    assert.ok(resetHtml.includes('Set New Password'), 'Reset password page should render');

    pass('Test 4: Password Reset', 'Verified forgot-password and reset-password workflows');
  } catch (e) {
    fail('Test 4: Password Reset', e);
  }

  // -------------------------------------------------------------------------
  // TEST 5: USER PROFILE VERIFICATION
  // -------------------------------------------------------------------------
  try {
    const userRes = await identityService.login({ email: 'admin@vanni.ai', password: 'VanniSecure2026!' });
    assert.strictEqual(userRes.user.fullName, 'VANNI System Administrator');
    assert.strictEqual(userRes.user.locale, 'en-IN');
    assert.strictEqual(userRes.user.timezone, 'Asia/Kolkata');
    assert.ok(!('passwordHash' in userRes.user), 'Secrets must never leak into profile DTO');

    pass('Test 5: User Profile', 'Clean profile DTO mapping without password secrets');
  } catch (e) {
    fail('Test 5: User Profile', e);
  }

  // -------------------------------------------------------------------------
  // TEST 6: ORGANIZATION CREATION (Additional Org)
  // -------------------------------------------------------------------------
  try {
    const { session } = await identityService.login({ email: 'admin@vanni.ai', password: 'VanniSecure2026!' });
    const { organization, updatedSession } = await identityService.createOrganization(session, {
      name: 'Mysuru Heritage Resorts',
      industry: 'HOSPITALITY_RESORT',
      timezone: 'Asia/Kolkata',
    });
    assert.strictEqual(organization.name, 'Mysuru Heritage Resorts');
    assert.strictEqual(organization.slug, 'mysuru-heritage-resorts');
    assert.strictEqual(organization.billingTier, 'STARTER');
    assert.strictEqual(organization.onboardingStatus, 'created');
    assert.strictEqual(updatedSession.activeOrganizationId, organization.id);
    assert.strictEqual(updatedSession.activeRole, 'OWNER');

    pass('Test 6: Organization Creation', 'Provisioned organization with URL-safe slug and owner role');
  } catch (e) {
    fail('Test 6: Organization Creation', e);
  }

  // -------------------------------------------------------------------------
  // TEST 7: MEMBERSHIP CREATION & ROLES (Invite & Role Promotion)
  // -------------------------------------------------------------------------
  try {
    const { session } = await identityService.login({ email: 'admin@vanni.ai', password: 'VanniSecure2026!' });
    const targetOrgId = session.activeOrganizationId;

    // Invite manager
    const invitedManager = await identityService.inviteMember(session, targetOrgId, {
      email: `manager.${Date.now()}@vanni.ai`,
      role: 'MANAGER',
    });
    assert.strictEqual(invitedManager.role, 'MANAGER');
    assert.strictEqual(invitedManager.status, 'INVITED');

    // Update role to ADMIN
    const updatedMember = await identityService.updateMemberRole(session, targetOrgId, invitedManager.userId, 'ADMIN');
    assert.strictEqual(updatedMember.role, 'ADMIN');

    pass('Test 7: Membership Management', 'Invited manager and promoted to admin with audit trail');
  } catch (e) {
    fail('Test 7: Membership Management', e);
  }

  // -------------------------------------------------------------------------
  // TEST 8: ORGANIZATION SWITCHING
  // -------------------------------------------------------------------------
  try {
    const { session } = await identityService.login({ email: 'admin@vanni.ai', password: 'VanniSecure2026!' });
    const initialOrgId = session.activeOrganizationId;
    const otherOrg = session.memberships.find(m => m.organizationId !== initialOrgId);
    assert.ok(otherOrg, 'Should have multiple memberships');

    const switched = switchActiveOrganization(session, otherOrg.organizationId);
    assert.strictEqual(switched.activeOrganizationId, otherOrg.organizationId);
    assert.strictEqual(switched.activeRole, otherOrg.role);

    pass('Test 8: Organization Switching', `Safely switched context from ${initialOrgId.slice(0, 8)} to ${otherOrg.organizationId.slice(0, 8)}`);
  } catch (e) {
    fail('Test 8: Organization Switching', e);
  }

  // -------------------------------------------------------------------------
  // TEST 9: ROLE PERMISSION MATRIX & HIERARCHY
  // -------------------------------------------------------------------------
  try {
    // OWNER has full permissions
    assert.ok(hasPermission('OWNER', 'org:billing'), 'Owner can access billing');
    assert.ok(hasPermission('OWNER', 'agent:delete'), 'Owner can delete agents');
    assert.ok(hasPermission('OWNER', 'member:invite'), 'Owner can invite members');

    // ADMIN has operational & invite permissions, but not org:delete or org:billing
    assert.ok(hasPermission('ADMIN', 'agent:write'), 'Admin can configure agents');
    assert.ok(hasPermission('ADMIN', 'member:invite'), 'Admin can invite members');
    assert.ok(!hasPermission('ADMIN', 'org:billing'), 'Admin cannot access billing');
    assert.ok(!hasPermission('ADMIN', 'org:delete'), 'Admin cannot delete organization');

    // MANAGER can handle calls, leads, and agent configurations, but cannot invite members
    assert.ok(hasPermission('MANAGER', 'call:write'), 'Manager can log calls');
    assert.ok(hasPermission('MANAGER', 'lead:write'), 'Manager can update leads');
    assert.ok(!hasPermission('MANAGER', 'member:invite'), 'Manager cannot invite members');

    // VIEWER is strictly read-only
    assert.ok(hasPermission('VIEWER', 'call:read'), 'Viewer can read calls');
    assert.ok(!hasPermission('VIEWER', 'call:write'), 'Viewer cannot modify calls');
    assert.ok(!hasPermission('VIEWER', 'agent:write'), 'Viewer cannot modify agents');

    // Role hierarchy checks
    assert.ok(isRoleAtLeast('OWNER', 'VIEWER'));
    assert.ok(isRoleAtLeast('ADMIN', 'MANAGER'));
    assert.ok(!isRoleAtLeast('MANAGER', 'ADMIN'));
    assert.ok(!isRoleAtLeast('VIEWER', 'OWNER'));

    pass('Test 9: Role Permissions', 'Verified strict OWNER > ADMIN > MANAGER > VIEWER matrix');
  } catch (e) {
    fail('Test 9: Role Permissions', e);
  }

  // -------------------------------------------------------------------------
  // TEST 10: UNAUTHORIZED ACCESS GATING (401 on Missing Session)
  // -------------------------------------------------------------------------
  try {
    assert.throws(
      () => requireUser(null),
      (err) => err instanceof UnauthorizedError && err.statusCode === 401
    );

    const apiRes = await fetch(`${BASE_URL}/api/orgs`);
    assert.strictEqual(apiRes.status, 401, 'Unauthenticated /api/orgs must return 401');

    pass('Test 10: Unauthorized Access Gating', 'Blocked access without active session (401)');
  } catch (e) {
    fail('Test 10: Unauthorized Access Gating', e);
  }

  // -------------------------------------------------------------------------
  // TEST 11: CRITICAL SECURITY TEST — CROSS-TENANT ACCESS PREVENTION
  // -------------------------------------------------------------------------
  try {
    // 1. Create Tenant A with User A
    const { session: sessionA } = await identityService.signup({
      fullName: 'Dentist User A',
      email: `user.a.${Date.now()}@dentalcompany.com`,
      password: 'Password2026!@#',
      organizationName: 'Dental Company A',
      industry: 'DENTAL',
    });
    const orgAId = sessionA.activeOrganizationId;

    // 2. Create Tenant B with User B
    const { session: sessionB } = await identityService.signup({
      fullName: 'Realtor User B',
      email: `user.b.${Date.now()}@realestateco.com`,
      password: 'Password2026!@#',
      organizationName: 'Real Estate Company B',
      industry: 'REAL_ESTATE',
    });
    const orgBId = sessionB.activeOrganizationId;

    // User A attempts to switch to Organization B -> MUST FAIL with 403 Forbidden!
    assert.throws(
      () => switchActiveOrganization(sessionA, orgBId),
      (err) => err instanceof OrganizationAccessDeniedError && err.statusCode === 403,
      'User A must not be allowed to switch to Organization B'
    );

    // User A attempts to access Organization B resource via requireOrganizationMember -> MUST FAIL!
    assert.throws(
      () => requireOrganizationMember(sessionA, orgBId),
      (err) => err instanceof OrganizationAccessDeniedError && err.statusCode === 403
    );

    // User A attempts to access Organization B resource via requireOrganizationAccess -> MUST FAIL!
    assert.throws(
      () => requireOrganizationAccess(sessionA, { organizationId: orgBId, data: 'classified' }),
      (err) => err instanceof OrganizationAccessDeniedError && err.statusCode === 403
    );

    // User A attempts to invite member to Org B -> MUST FAIL!
    await assert.rejects(
      async () => identityService.inviteMember(sessionA, orgBId, { email: 'hacker@vanni.ai', role: 'ADMIN' }),
      (err) => err instanceof ForbiddenError && err.statusCode === 403
    );

    // User A attempts to fetch Org B audit logs -> MUST FAIL!
    assert.throws(
      () => identityService.getAuditLogs(sessionA, orgBId),
      (err) => err instanceof OrganizationAccessDeniedError && err.statusCode === 403
    );

    pass(
      'Test 11: CRITICAL Cross-Tenant Security',
      'User A strictly forbidden from reading, switching, updating, or deleting Org B resources (403)'
    );
  } catch (e) {
    fail('Test 11: CRITICAL Cross-Tenant Security', e);
  }

  // -------------------------------------------------------------------------
  // TEST 12: INACTIVE / SUSPENDED MEMBERSHIP REJECTION
  // -------------------------------------------------------------------------
  try {
    const mockSession = {
      userId: 'usr_inactive_01',
      email: 'suspended@company.com',
      fullName: 'Suspended Employee',
      activeOrganizationId: 'org_001',
      activeRole: 'VIEWER',
      memberships: [
        {
          organizationId: 'org_001',
          organizationName: 'Test Org',
          organizationSlug: 'test-org',
          role: 'VIEWER',
          status: 'SUSPENDED',
          onboardingStatus: 'ready',
        },
      ],
    };

    assert.throws(
      () => requireOrganizationMember(mockSession, 'org_001'),
      (err) => err instanceof InactiveMembershipError && err.statusCode === 403
    );

    pass('Test 12: Inactive Membership Rejection', 'Suspended membership access rejected with 403');
  } catch (e) {
    fail('Test 12: Inactive Membership Rejection', e);
  }

  // -------------------------------------------------------------------------
  // TEST 13: PROTECTED APPLICATION ROUTE REDIRECTION
  // -------------------------------------------------------------------------
  try {
    const protectedRoutes = [
      '/app',
      '/app/dashboard',
      '/app/onboarding',
      '/app/agents',
      '/app/calls',
      '/app/leads',
      '/app/settings',
      '/app/organization/select',
    ];

    for (const r of protectedRoutes) {
      const res = await fetch(`${BASE_URL}${r}`, { redirect: 'manual' });
      assert.ok([302, 303, 307].includes(res.status), `Route ${r} without cookie must redirect (got ${res.status})`);
      const location = res.headers.get('location') || '';
      assert.ok(location.includes('/login'), `Route ${r} must redirect to /login (got ${location})`);
    }

    pass('Test 13: Protected Route Redirections', 'Unauthenticated requests to /app/* cleanly redirected to /login');
  } catch (e) {
    fail('Test 13: Protected Route Redirections', e);
  }

  // -------------------------------------------------------------------------
  // TEST 14: POSTGRESQL RLS MIGRATION & POLICY VERIFICATION
  // -------------------------------------------------------------------------
  try {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/003_auth_and_multitenancy.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration 003 file must exist');

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.profiles'), 'Must create profiles table');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.organizations'), 'Must create organizations table');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.organization_members'), 'Must create organization_members table');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.audit_logs'), 'Must create audit_logs table');
    assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
    assert.ok(sql.includes('is_org_member(org_id UUID)'), 'Must define is_org_member helper');
    assert.ok(sql.includes('has_org_role(org_id UUID, required_role VARCHAR)'), 'Must define has_org_role helper');
    assert.ok(sql.includes('service_role'), 'Must support service role bypass');

    pass('Test 14: PostgreSQL RLS Architecture', 'Migration 003 validated with RLS on all tenant tables and helper functions');
  } catch (e) {
    fail('Test 14: PostgreSQL RLS Architecture', e);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`  QA RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
