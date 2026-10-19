/**
 * PROMPT 06: REAL ESTATE WORKFLOW CONCURRENCY & PERSISTENCE HARDENING TEST SUITE
 * 
 * Verifies:
 * 1. Cross-Tenant Property Isolation: Org B cannot read Org A's property or workspace
 * 2. Property Validation & Guardrails: Rejects invalid propertyType, negative basePrice, invalid status
 * 3. Reassigning workspaceId on PUT is prevented
 * 4. Lead Scoping & Phone Validation: Rejects malformed phones, scopes leads strictly to workspace & org
 * 5. Site-Visit Concurrency & Capacity Protection:
 *    - Rejects booking in the past
 *    - Two concurrent reservation attempts for the last remaining slot: exactly one succeeds, one gets 409 Conflict
 *    - Slot capacity is cleanly released upon cancellation
 * 6. Supabase Real Estate Persistence Methods:
 *    - reserveSiteVisitSlot, releaseSiteVisitSlot, getSiteVisitCapacitySlot
 *    - Database error propagation without fabricated success
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import type { AuthSessionDTO } from '@vanni/shared';
import { SupabaseDatabaseService, DatabaseOperationError } from '@vanni/database';

const RE_ORG_ALPHA_ID = 're-org-alpha-1111-1111-111111111111';
const RE_ORG_BETA_ID = 're-org-beta-2222-2222-222222222222';

function sessionForOrg(orgId: string, role: 'OWNER' | 'ADMIN' | 'VIEWER' = 'OWNER'): AuthSessionDTO {
  return {
    userId: `usr-${orgId.slice(0, 8)}`,
    email: `admin@${orgId.slice(0, 8)}.in`,
    fullName: 'Test Operator',
    activeOrganizationId: orgId,
    activeRole: role,
    memberships: [
      {
        organizationId: orgId,
        organizationName: orgId === RE_ORG_ALPHA_ID ? 'Alpha Developers' : 'Beta Realty',
        organizationSlug: orgId === RE_ORG_ALPHA_ID ? 'alpha-dev' : 'beta-realty',
        role,
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Real Estate Workflow & Concurrency Hardening (Prompt 06)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let alphaOwnerCookie: string;
  let betaOwnerCookie: string;
  let alphaWorkspaceId: string;
  let betaWorkspaceId: string;
  let testPropertyId: string;

  beforeAll(async () => {
    app = await buildServer();
    alphaOwnerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForOrg(RE_ORG_ALPHA_ID))}`;
    betaOwnerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForOrg(RE_ORG_BETA_ID))}`;

    // Create Alpha workspace
    const wsResAlpha = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: alphaOwnerCookie },
      payload: {
        name: 'Alpha Palm Meadows Project',
        industryCategory: 'REAL_ESTATE',
        subcategory: 'DEVELOPER',
        operatingLocation: 'Electronic City, Bengaluru, Karnataka',
      },
    });
    expect(wsResAlpha.statusCode).toBe(201);
    alphaWorkspaceId = wsResAlpha.json().workspace.id;

    // Create Beta workspace
    const wsResBeta = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: betaOwnerCookie },
      payload: {
        name: 'Beta Orchid Enclave',
        industryCategory: 'REAL_ESTATE',
        subcategory: 'DEVELOPER',
        operatingLocation: 'Whitefield, Bengaluru, Karnataka',
      },
    });
    expect(wsResBeta.statusCode).toBe(201);
    betaWorkspaceId = wsResBeta.json().workspace.id;

    // Create test property in Alpha workspace
    const propRes = await app.inject({
      method: 'POST',
      url: `/api/real-estate/properties?workspaceId=${alphaWorkspaceId}`,
      headers: { cookie: alphaOwnerCookie },
      payload: {
        name: 'Palm Meadows Villa Plot 42',
        referenceCode: 'PM-42',
        propertyType: 'PLOT',
        locality: 'Electronic City Phase 1',
        dimensions: {
          dimensionText: '30x50 ft',
          lengthFeet: 50,
          widthFeet: 30,
          totalArea: 1500,
          unit: 'SQFT',
        },
        pricing: {
          basePrice: 4500000,
          pricePerSqft: 3000,
          currency: 'INR',
        },
        status: 'AVAILABLE',
        description: 'Prime East-facing BDA approved layout plot.',
        reraDetails: {
          registrationNumber: 'PRM/KA/RERA/1251/308/PR/220101/004567',
          verificationStatus: 'VERIFIED',
        },
      },
    });
    expect(propRes.statusCode).toBe(201);
    testPropertyId = propRes.json().property.id;
  });

  describe('1. Cross-Tenant Property Isolation', () => {
    it('denies Org B access to Org A property by ID (404/403 isolation)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/real-estate/properties/${testPropertyId}`,
        headers: { cookie: betaOwnerCookie },
      });
      expect([403, 404]).toContain(res.statusCode);
    });

    it('denies Org B listing properties specifying Org A workspaceId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/real-estate/properties?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: betaOwnerCookie },
      });
      expect([403, 404]).toContain(res.statusCode);
    });

    it('denies Org B creating a property in Org A workspaceId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/properties?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: betaOwnerCookie },
        payload: {
          name: 'Malicious Injected Plot',
          referenceCode: 'HACK-01',
          propertyType: 'PLOT',
          locality: 'Electronic City',
          dimensions: { totalArea: 1000, unit: 'SQFT' },
          pricing: { basePrice: 100000 },
        },
      });
      expect([403, 404]).toContain(res.statusCode);
    });
  });

  describe('2. Property Validation & Modification Guardrails', () => {
    it('rejects property creation with invalid propertyType (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/properties?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          name: 'Invalid Space Station',
          referenceCode: 'INV-01',
          propertyType: 'SPACE_STATION',
          locality: 'Orbit',
          dimensions: { totalArea: 1000, unit: 'SQFT' },
          pricing: { basePrice: 5000000 },
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Invalid propertyType');
    });

    it('rejects property creation with negative basePrice (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/properties?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          name: 'Negative Price Plot',
          referenceCode: 'NEG-01',
          propertyType: 'PLOT',
          locality: 'Electronic City',
          dimensions: { totalArea: 1000, unit: 'SQFT' },
          pricing: { basePrice: -500 },
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('positive');
    });

    it('rejects property update with invalid status (400)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/real-estate/properties/${testPropertyId}?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          status: 'DESTROYED_BY_ALIENS',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Invalid status');
    });

    it('strips or rejects attempts to reassign property workspaceId on PUT', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/real-estate/properties/${testPropertyId}?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          workspaceId: betaWorkspaceId,
          description: 'Attempting to reassign property across workspaces',
        },
      });
      expect(res.statusCode).toBe(200);
      // Verify property is still firmly in alphaWorkspaceId
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/real-estate/properties/${testPropertyId}?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().property.workspaceId).toBe(alphaWorkspaceId);
    });
  });

  describe('3. Real-Estate Lead Scoping & Phone Validation', () => {
    it('rejects lead qualification with malformed phone number (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/leads/qualify?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          contactName: 'Ramesh Kumar',
          contactPhone: '12345',
          purchasePurpose: 'INVESTMENT',
          budgetMin: 3000000,
          budgetMax: 5000000,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('contactPhone');
    });

    it('successfully qualifies lead with valid Indian phone number and scopes to workspace', async () => {
      const uniqueLeadPhone = '+9198' + Math.floor(10000000 + Math.random() * 90000000);
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/leads/qualify?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          contactName: 'Ramesh Kumar',
          contactPhone: uniqueLeadPhone,
          purchasePurpose: 'INVESTMENT',
          budgetMin: 3000000,
          budgetMax: 5000000,
          purchaseTimeline: '3_MONTHS',
        },
      });
      expect(res.statusCode).toBe(200);
      const lead = res.json().lead;
      expect(lead.workspaceId).toBe(alphaWorkspaceId);

      // Verify Org B cannot view Alpha leads
      const betaLeadsRes = await app.inject({
        method: 'GET',
        url: `/api/real-estate/leads?workspaceId=${betaWorkspaceId}`,
        headers: { cookie: betaOwnerCookie },
      });
      expect(betaLeadsRes.statusCode).toBe(200);
      const betaLeads = betaLeadsRes.json().leads;
      expect(betaLeads.find((l: any) => l.id === lead.id)).toBeUndefined();
    });
  });

  describe('4. Site-Visit Concurrency & Capacity Protection', () => {
    const futureDate = '2026-11-20';
    const futureSlotTime = `${futureDate}T10:00:00+05:30`;

    it('rejects booking in the past (< today) with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          propertyId: testPropertyId,
          customerName: 'Time Traveler',
          customerPhone: '+919845099999',
          scheduledTime: '2020-01-01T10:00:00+05:30',
          visitorCount: 1,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('past');
    });

    it('handles concurrent booking requests for the last remaining slot atomically', async () => {
      // First configure workspace with maxVisitorsPerSlot = 2
      await app.inject({
        method: 'PUT',
        url: `/api/real-estate/config?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          siteVisitDays: [0, 1, 2, 3, 4, 5, 6],
          siteVisitStart: '09:00',
          siteVisitEnd: '18:00',
          defaultVisitDurationMinutes: 60,
          maxVisitorsPerSlot: 2,
        },
      });

      // Fill 1 slot (now 1 remaining out of 2)
      const firstBooking = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          propertyId: testPropertyId,
          customerName: 'First Visitor',
          customerPhone: '+919845011111',
          scheduledTime: futureSlotTime,
          visitorCount: 1,
        },
      });
      expect(firstBooking.statusCode).toBe(201);

      // Now exactly 1 spot remains. Two buyers simultaneously attempt to book the final spot:
      const reqA = app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          propertyId: testPropertyId,
          customerName: 'Buyer Concurrent A',
          customerPhone: '+919845022222',
          scheduledTime: futureSlotTime,
          visitorCount: 1,
        },
      });

      const reqB = app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          propertyId: testPropertyId,
          customerName: 'Buyer Concurrent B',
          customerPhone: '+919845033333',
          scheduledTime: futureSlotTime,
          visitorCount: 1,
        },
      });

      const [resA, resB] = await Promise.all([reqA, reqB]);

      const statusCodes = [resA.statusCode, resB.statusCode];
      // Exactly one must succeed (201) and one must be rejected with 409 Conflict!
      expect(statusCodes).toContain(201);
      expect(statusCodes).toContain(409);
    });

    it('frees capacity when a site visit is cancelled', async () => {
      // First book a slot on another day
      const altSlotTime = '2026-11-21T11:00:00+05:30';
      const bookRes = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          propertyId: testPropertyId,
          customerName: 'Cancel Test Buyer',
          customerPhone: '+919845044444',
          scheduledTime: altSlotTime,
          visitorCount: 2, // Fills both 2 spots
        },
      });
      expect(bookRes.statusCode).toBe(201);
      const visitId = bookRes.json().siteVisit.id;

      // Another visitor trying right now should be rejected (capacity exhausted)
      const fullRes = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          propertyId: testPropertyId,
          customerName: 'Blocked Visitor',
          customerPhone: '+919845055555',
          scheduledTime: altSlotTime,
          visitorCount: 1,
        },
      });
      expect(fullRes.statusCode).toBe(409);

      // Cancel the first visit
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits/${visitId}/cancel`,
        headers: { cookie: alphaOwnerCookie },
        payload: { reason: 'Client had an emergency' },
      });
      expect(cancelRes.statusCode).toBe(200);

      // Now the blocked visitor can book the slot!
      const retryRes = await app.inject({
        method: 'POST',
        url: `/api/real-estate/site-visits?workspaceId=${alphaWorkspaceId}`,
        headers: { cookie: alphaOwnerCookie },
        payload: {
          propertyId: testPropertyId,
          customerName: 'Blocked Visitor',
          customerPhone: '+919845055555',
          scheduledTime: altSlotTime,
          visitorCount: 1,
        },
      });
      expect(retryRes.statusCode).toBe(201);
    });
  });

  describe('5. Supabase Real Estate Persistence Methods Unit Tests', () => {
    it('executes reserveSiteVisitSlot with Supabase chained query in SupabaseDatabaseService', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'slot_123',
                workspace_id: 'ws_test',
                property_id: 'prop_test',
                slot_time: '2026-11-20T10:00:00+05:30',
                booked_count: 1,
                max_capacity: 5,
              },
              error: null,
            }),
          }),
        }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      const service = new SupabaseDatabaseService('https://mock.supabase.co', 'mock-service-key');
      (service as any).supabaseClient = mockSupabase;

      const result = await service.reserveSiteVisitSlot({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        propertyId: 'prop_test',
        slotTime: '2026-11-20T10:00:00+05:30',
        visitorCount: 1,
        maxCapacity: 5,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('site_visit_capacity_slots');
      expect(result.success).toBe(true);
      expect(result.bookedCount).toBe(1);
    });

    it('executes releaseSiteVisitSlot with Supabase chained query in SupabaseDatabaseService', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'slot_123',
            workspace_id: 'ws_test',
            property_id: 'prop_test',
            slot_time: '2026-11-20T10:00:00+05:30',
            booked_count: 1,
            max_capacity: 5,
            version: 1,
          },
          error: null,
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      const service = new SupabaseDatabaseService('https://mock.supabase.co', 'mock-service-key');
      (service as any).supabaseClient = mockSupabase;

      await service.releaseSiteVisitSlot({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        propertyId: 'prop_test',
        slotTime: '2026-11-20T10:00:00+05:30',
        visitorCount: 1,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('site_visit_capacity_slots');
    });

    it('propagates database error when Supabase query fails', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection terminated unexpectedly' },
        }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      const service = new SupabaseDatabaseService('https://mock.supabase.co', 'mock-service-key');
      (service as any).supabaseClient = mockSupabase;

      await expect(
        service.reserveSiteVisitSlot({
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          propertyId: 'prop_test',
          slotTime: '2026-11-20T10:00:00+05:30',
          visitorCount: 1,
          maxCapacity: 5,
        })
      ).rejects.toThrow(DatabaseOperationError);
    });
  });
});
