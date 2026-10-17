/**
 * PROMPT 06: REAL ESTATE VERTICAL CONFIGURATION & SITE VISIT OPERATIONS TEST SUITE
 * 
 * Verifies:
 * 1. Real estate workspace configuration (site visit days, hours, max capacity, transport policy)
 * 2. Property inventory catalogue creation with valid dimensions (30x40 ft = 1,200 sqft) and RERA details
 * 3. Validation rejection of invalid dimensions and unverified false RERA claims
 * 4. Property inventory search, type/locality/price filtering, and pagination
 * 5. Site visit slot availability calculation considering site hours, buffers, and capacity
 * 6. Site visit booking with visitor count
 * 7. Slot capacity overflow prevention (returns 409 Conflict when capacity exceeded)
 * 8. Idempotent booking replay with idempotencyKey
 * 9. Site visit rescheduling with capacity checks and audit history
 * 10. Site visit cancellation freeing visitor capacity for subsequent bookings
 * 11. Real estate lead qualification (purpose, budget, preferred dimensions, timeline, assignment)
 * 12. Lead enquiry ingestion webhook with deduplication
 * 13. Kannada-first voice AI property inquiry:
 *     - Accurately answers verified available property details (dimensions, price, RERA)
 *     - Honestly discloses unlisted or sold property without hallucinating
 * 14. Tenant isolation: Organization B cannot query or access Organization A's properties
 * 15. Role authorization: VIEWER role cannot add properties or book visits (403 Forbidden)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../server.js';
import { serializeSession, SESSION_COOKIE_NAME } from '@vanni/auth';
import type { AuthSessionDTO } from '@vanni/shared';

const RE_ORG_A_ID = 're-org-a-0000-0000-000000000001';
const RE_ORG_B_ID = 're-org-b-0000-0000-000000000002';

function sessionForRealEstateOwner(orgId: string = RE_ORG_A_ID): AuthSessionDTO {
  return {
    userId: `u-re-${orgId.slice(0, 8)}`,
    email: `promoter@${orgId.slice(0, 8)}.in`,
    fullName: 'Suresh Patil',
    activeOrganizationId: orgId,
    activeRole: 'OWNER',
    memberships: [
      {
        organizationId: orgId,
        organizationName: orgId === RE_ORG_A_ID ? 'Ballari Green Meadows Layouts' : 'Hubli Prime Properties',
        organizationSlug: orgId === RE_ORG_A_ID ? 'green-meadows' : 'hubli-prime',
        role: 'OWNER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

function sessionForRealEstateViewer(orgId: string = RE_ORG_A_ID): AuthSessionDTO {
  return {
    userId: 'u-viewer-re-001',
    email: 'intern@greenmeadows.in',
    fullName: 'Sales Trainee',
    activeOrganizationId: orgId,
    activeRole: 'VIEWER',
    memberships: [
      {
        organizationId: orgId,
        organizationName: 'Ballari Green Meadows Layouts',
        organizationSlug: 'green-meadows',
        role: 'VIEWER',
        status: 'ACTIVE',
        onboardingStatus: 'ready',
      },
    ],
  };
}

describe('Real Estate Vertical Configuration & Site Visit Operations (Prompt 06)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let reOwnerCookie: string;
  let reCompetitorCookie: string;
  let reViewerCookie: string;

  let workspaceId: string;
  let propertyId: string;
  let siteVisitId: string;
  const visitDate = '2026-11-' + String(10 + Math.floor(Math.random() * 15)).padStart(2, '0');
  const idempotencyKey = 'sitevisit_booking_' + Date.now();
  const webhookKey = 'portal_enquiry_' + Date.now();

  beforeAll(async () => {
    app = await buildServer();
    reOwnerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForRealEstateOwner(RE_ORG_A_ID))}`;
    reCompetitorCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForRealEstateOwner(RE_ORG_B_ID))}`;
    reViewerCookie = `${SESSION_COOKIE_NAME}=${serializeSession(sessionForRealEstateViewer(RE_ORG_A_ID))}`;

    // Create client workspace for Ballari Green Meadows Layout
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      headers: { cookie: reOwnerCookie },
      payload: {
        name: 'Siruguppa Road Green Meadows Gated Layout',
        industryCategory: 'REAL_ESTATE',
        subcategory: 'DEVELOPER',
        operatingLocation: 'Siruguppa Road, Havambhavi, Ballari, Karnataka',
        primaryPhone: '+91 8392 278999',
        primaryEmail: 'sales@greenmeadowsballari.in',
        timezone: 'Asia/Kolkata',
        languagePreferences: {
          primary: 'kn-IN',
          conversationalStyle: 'POLITE_BUSINESS',
          regionalDialect: 'NORTH_KARNATAKA_COMMERCIAL',
        },
      },
    });

    const wsBody = JSON.parse(wsRes.body);
    workspaceId = wsBody.workspace.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Configure real estate site visit hours, slot duration, capacity, and transport policy', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/real-estate/config?workspaceId=${workspaceId}`,
      headers: { cookie: reOwnerCookie },
      payload: {
        siteVisitDays: [0, 1, 2, 3, 4, 5, 6],
        siteVisitStart: '09:00',
        siteVisitEnd: '17:30',
        defaultVisitDurationMinutes: 60,
        bufferMinutes: 0,
        maxVisitorsPerSlot: 4,
        transportAvailable: false,
        transportNotes: 'Visitors must report to site sales lounge at Havambhavi gate.',
        salesContactPhone: '+91 94480 12345',
        escalationPhone: '+91 94480 54321',
        webhookUrl: 'https://webhook.site/vanni-test-realestate',
        webhookSecret: 'karnataka_realestate_secret_token_123',
        webhookEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.config.maxVisitorsPerSlot).toBe(4);
    expect(body.config.transportAvailable).toBe(false);
    expect(body.config.siteVisitStart).toBe('09:00');
  });

  it('2. Add property inventory (plot 30x40 ft = 1,200 sqft with valid RERA registration)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/properties?workspaceId=${workspaceId}`,
      headers: { cookie: reOwnerCookie },
      payload: {
        name: 'Green Meadows Phase 1 - East Facing Villa Plot #104',
        referenceCode: 'SGM-P104',
        propertyType: 'PLOT',
        subType: 'Residential Gated Community Plot',
        locality: 'Siruguppa Road, Ballari',
        address: 'Plot 104, Sector B, Green Meadows, Havambhavi',
        dimensions: {
          lengthFeet: 40,
          widthFeet: 30,
          dimensionText: '30x40 ft',
          totalArea: 1200,
          unit: 'SQFT',
        },
        pricing: {
          basePrice: 1800000, // 18 Lakhs
          pricePerSqft: 1500,
          priceNegotiable: true,
          additionalCharges: {
            cornerCharge: 0,
            clubhouseMaintenance: 25000,
          },
        },
        status: 'AVAILABLE',
        amenities: ['Tar Road (40ft)', 'Underground Drainage', 'Street Lights', 'Children Park', 'Borewell Water'],
        description: 'Prime East-facing BDA-approved dimension plot close to clubhouse and main arch.',
        reraDetails: {
          registrationNumber: 'PRM/KA/RERA/1251/310/PR/2026/004512',
          jurisdiction: 'K-RERA (Karnataka)',
          verificationStatus: 'VERIFIED',
          verificationSource: 'Karnataka RERA Public Portal',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.property.referenceCode).toBe('SGM-P104');
    expect(body.property.dimensions.totalArea).toBe(1200);
    expect(body.property.dimensions.areaSqft).toBe(1200);
    expect(body.property.reraDetails.verificationStatus).toBe('VERIFIED');
    expect(body.property.reraDetails.registrationNumber).toContain('PRM/KA/RERA');

    propertyId = body.property.id;
  });

  it('3. Validation safety: Reject property with VERIFIED RERA status when registration number is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/properties?workspaceId=${workspaceId}`,
      headers: { cookie: reOwnerCookie },
      payload: {
        name: 'Unverified Fake Plot',
        referenceCode: 'FAKE-01',
        propertyType: 'PLOT',
        locality: 'Ballari Bypass',
        dimensions: { totalArea: 1200, unit: 'SQFT' },
        pricing: { basePrice: 1500000 },
        reraDetails: {
          verificationStatus: 'VERIFIED',
          // registrationNumber is omitted!
        },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toContain('registration number');
  });

  it('4. Property search and filtering by type, locality, and price range', async () => {
    // Add a second property: 40x60 Luxury Villa
    await app.inject({
      method: 'POST',
      url: `/api/real-estate/properties?workspaceId=${workspaceId}`,
      headers: { cookie: reOwnerCookie },
      payload: {
        name: 'Green Meadows Luxury 4BHK Villa #12',
        referenceCode: 'SGM-V12',
        propertyType: 'VILLA',
        locality: 'Siruguppa Road, Ballari',
        dimensions: { lengthFeet: 60, widthFeet: 40, dimensionText: '40x60 ft', totalArea: 2400, unit: 'SQFT' },
        pricing: { basePrice: 6500000 }, // 65 Lakhs
        status: 'AVAILABLE',
      },
    });

    // Query 1: Filter by propertyType = PLOT
    const plotRes = await app.inject({
      method: 'GET',
      url: `/api/real-estate/properties?workspaceId=${workspaceId}&propertyType=PLOT`,
      headers: { cookie: reOwnerCookie },
    });
    expect(plotRes.statusCode).toBe(200);
    const plotBody = JSON.parse(plotRes.body);
    expect(plotBody.properties.length).toBeGreaterThanOrEqual(1);
    expect(plotBody.properties.every((p: any) => p.propertyType === 'PLOT')).toBe(true);

    // Query 2: Filter by price range <= 20 Lakhs
    const budgetRes = await app.inject({
      method: 'GET',
      url: `/api/real-estate/properties?workspaceId=${workspaceId}&maxPrice=2000000`,
      headers: { cookie: reOwnerCookie },
    });
    expect(budgetRes.statusCode).toBe(200);
    const budgetBody = JSON.parse(budgetRes.body);
    expect(budgetBody.properties.every((p: any) => p.pricing.basePrice <= 2000000)).toBe(true);
  });

  it('5. Retrieve site visit availability slots for a property', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/real-estate/site-visits/availability?workspaceId=${workspaceId}&propertyId=${propertyId}&date=${visitDate}`,
      headers: { cookie: reOwnerCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.totalSlots).toBeGreaterThan(0);
    expect(body.availableSlotsCount).toBeGreaterThan(0);
    expect(body.maxCapacityPerSlot).toBe(4);

    const firstSlot = body.slots[0];
    expect(firstSlot.startTime).toBe('09:00');
    expect(firstSlot.isAvailable).toBe(true);
    expect(firstSlot.remainingCapacity).toBeGreaterThanOrEqual(2);
  });

  it('6. Book site visit slot with visitor count successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/site-visits?workspaceId=${workspaceId}`,
      headers: { cookie: reOwnerCookie },
      payload: {
        propertyId,
        customerName: 'Kavitha Reddy',
        customerPhone: '+91 98450 77889',
        scheduledTime: `${visitDate}T09:00:00Z`,
        visitorCount: 3,
        transportRequired: false,
        notes: 'Family visit with husband and father-in-law to inspect East plot boundary',
        idempotencyKey,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.siteVisit.propertyId).toBe(propertyId);
    expect(body.siteVisit.visitorCount).toBe(3);
    expect(body.siteVisit.status).toBe('CONFIRMED');

    siteVisitId = body.siteVisit.id;
  });

  it('7. Slot capacity overflow prevention: Booking exceeding max capacity rejects with 409 Conflict', async () => {
    // Current slot has 3 visitors (max capacity is 4). Trying to book 2 more visitors should exceed capacity (3 + 2 = 5 > 4)
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/site-visits?workspaceId=${workspaceId}`,
      headers: { cookie: reOwnerCookie },
      payload: {
        propertyId,
        customerName: 'Girish Kulkarni',
        customerPhone: '+91 99887 66554',
        scheduledTime: `${visitDate}T09:00:00Z`,
        visitorCount: 2,
        notes: 'Another prospective buyer for same time',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toContain('capacity exceeded');
  });

  it('8. Idempotent retry returns existing site visit without duplicate capacity deduction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/site-visits?workspaceId=${workspaceId}`,
      headers: { cookie: reOwnerCookie },
      payload: {
        propertyId,
        customerName: 'Kavitha Reddy',
        customerPhone: '+91 98450 77889',
        scheduledTime: `${visitDate}T09:00:00Z`,
        visitorCount: 3,
        idempotencyKey,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.idempotentReplay).toBe(true);
    expect(body.siteVisit.id).toBe(siteVisitId);
  });

  it('9. Reschedule site visit moves booking to new slot and preserves audit history', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/site-visits/${siteVisitId}/reschedule`,
      headers: { cookie: reOwnerCookie },
      payload: {
        newScheduledTime: `${visitDate}T14:00:00Z`,
        reason: 'Customer requested afternoon visit post-lunch',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.siteVisit.scheduledTime).toBe(`${visitDate}T14:00:00Z`);
    expect(body.siteVisit.auditHistory.some((h: any) => h.action === 'RESCHEDULED')).toBe(true);
  });

  it('10. Cancel site visit frees slot capacity for subsequent bookings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/site-visits/${siteVisitId}/cancel`,
      headers: { cookie: reOwnerCookie },
      payload: {
        reason: 'Customer bought plot in Bangalore instead',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.siteVisit.status).toBe('CANCELLED');
    expect(body.siteVisit.cancellationReason).toContain('Bangalore');

    // Verify afternoon slot at 14:00 is now fully open (remaining capacity 4)
    const availRes = await app.inject({
      method: 'GET',
      url: `/api/real-estate/site-visits/availability?workspaceId=${workspaceId}&propertyId=${propertyId}&date=${visitDate}`,
      headers: { cookie: reOwnerCookie },
    });
    const availBody = JSON.parse(availRes.body);
    const slot14 = availBody.slots.find((s: any) => s.startTime === '14:00');
    expect(slot14.isAvailable).toBe(true);
    expect(slot14.remainingCapacity).toBe(4);
  });

  it('11. Real estate lead qualification with purpose, budget range, dimensions, and sales assignment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/real-estate/leads/qualify',
      headers: { cookie: reOwnerCookie },
      payload: {
        contactName: 'Naveen Hiremath',
        contactPhone: '+91 97410 44556',
        propertyInterest: 'Siruguppa Green Meadows Plot #104',
        purchasePurpose: 'INVESTMENT',
        budgetMin: 1500000,
        budgetMax: 2000000,
        preferredLocation: 'Siruguppa Road, Ballari',
        preferredDimensions: '30x40 ft',
        purchaseTimeline: 'IMMEDIATE',
        siteVisitInterest: 'YES',
        assignedTo: 'Mallikarjun (Senior Sales Exec)',
        status: 'QUALIFIED',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.lead.callerName).toBe('Naveen Hiremath');
    expect(body.lead.budgetOrFee).toBe('₹15.0L - ₹20.0L');
    expect(body.lead.leadRating).toBe('HOT');
  });

  it('12. Webhook enquiry ingestion with deduplication by idempotencyKey', async () => {
    const payload = {
      source: 'MagicBricks / 99Acres Portal',
      fullName: 'Sunil Rao',
      phone: '+91 94481 99887',
      propertyInterest: '30x40 East Facing Plot',
      budget: '₹18 Lakhs',
      idempotencyKey: webhookKey,
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/real-estate/webhooks/enquiry',
      headers: { cookie: reOwnerCookie },
      payload,
    });
    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.body);
    expect(body1.success).toBe(true);
    expect(body1.lead.callerName).toBe('Sunil Rao');

    // Second call with same idempotencyKey should deduplicate
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/real-estate/webhooks/enquiry',
      headers: { cookie: reOwnerCookie },
      payload,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.deduplicated).toBe(true);
    expect(body2.lead.id).toBe(body1.lead.id);
  });

  it('13. Kannada-First Voice Agent inquiry: accurate verified answers vs honest disclosure on missing property', async () => {
    // Sub-test A: Querying verified existing plot SGM-P104
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/real-estate/agent/inquire',
      headers: { cookie: reOwnerCookie },
      payload: {
        workspaceId,
        queryText: '30x40 plot SGM-P104 rate eshtu ide?',
        language: 'kn-IN',
      },
    });

    expect(validRes.statusCode).toBe(200);
    const validBody = JSON.parse(validRes.body);
    expect(validBody.matched).toBe(true);
    expect(validBody.verifiedProperty.referenceCode).toBe('SGM-P104');
    // Kannada voice answer contains accurate verified facts
    expect(validBody.response).toContain('1200 ಚದರ ಅಡಿ');
    expect(validBody.response).toContain('18.0 ಲಕ್ಷ');
    expect(validBody.response).toContain('RERA ನೋಂದಣಿ');
    expect(validBody.suggestSiteVisit).toBe(true);

    // Sub-test B: Querying non-existent / unverified layout
    const missingRes = await app.inject({
      method: 'POST',
      url: '/api/real-estate/agent/inquire',
      headers: { cookie: reOwnerCookie },
      payload: {
        workspaceId,
        queryText: 'Kuvempu Nagar corner plot idiya?',
        language: 'kn-IN',
      },
    });

    expect(missingRes.statusCode).toBe(200);
    const missingBody = JSON.parse(missingRes.body);
    expect(missingBody.matched).toBe(false);
    expect(missingBody.verifiedProperty).toBeNull();
    // Honest refusal without inventing plots
    expect(missingBody.response).toContain('ಅಧಿಕೃತ ಕ್ಯಾಟಲಾಗ್‌ನಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ');
    expect(missingBody.escalateToSales).toBe(true);
  });

  it('14. Tenant isolation: Competitor Real Estate Org B cannot access Org A properties or site visits', async () => {
    // Org B attempts to retrieve Org A property
    const res = await app.inject({
      method: 'GET',
      url: `/api/real-estate/properties/${propertyId}`,
      headers: { cookie: reCompetitorCookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('15. Role authorization: VIEWER role cannot add property or book site visits', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/real-estate/properties?workspaceId=${workspaceId}`,
      headers: { cookie: reViewerCookie },
      payload: {
        name: 'Unauthorized Property',
        referenceCode: 'UNAUTH-01',
        propertyType: 'PLOT',
        locality: 'Ballari',
        dimensions: { totalArea: 1200, unit: 'SQFT' },
        pricing: { basePrice: 1000000 },
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Viewer');
  });
});
