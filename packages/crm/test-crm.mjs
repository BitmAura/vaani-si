/**
 * Test Suite: VANNI CRM, Contacts & Lead Management Engine
 * Tests:
 * 1. Contact resolution & Phone deduplication
 * 2. Contact suppression & Do-Not-Contact server-side enforcement
 * 3. Lead creation & deduplication from same active customer
 * 4. Deterministic qualification & scoring engine
 * 5. Lead pipeline stage transitions
 * 6. Assignment & Follow-up scheduling
 * 7. Unified activity timeline derivation
 * 8. Public website lead ingestion
 * 9. Multi-tenant isolation verification
 * 10. Operational CRM analytics calculations
 */

import { InMemoryDatabaseService } from '../database/dist/index.js';
import { ContactService, LeadService, LeadQualificationEngine, WebLeadIngestionHandler } from './dist/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

async function runCRMTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING VANNI CRM & LEAD MANAGEMENT ENGINE TEST SUITE');
  console.log('================================================================\n');

  const db = new InMemoryDatabaseService();
  const contactService = new ContactService(db);
  const leadService = new LeadService(db);
  const webIngestion = new WebLeadIngestionHandler(contactService, leadService);

  const orgA = 'org_dental_care_blr';
  const orgB = 'org_real_estate_bellary';

  // Test 1: Contact Creation & Phone Deduplication
  console.log('--- TEST 1: Contact Resolution & Deduplication ---');
  const res1 = await contactService.resolveOrCreateContact({
    organizationId: orgA,
    displayName: 'Pooja Hegde',
    phone: '98860 67890',
    email: 'pooja@example.com',
    city: 'Bengaluru',
  });
  assert(res1.isNew === true, 'First interaction created new contact');
  assert(res1.contact.phone === '+919886067890', 'Phone normalized to E.164');

  // Second interaction with varied formatting (leading zero)
  const res2 = await contactService.resolveOrCreateContact({
    organizationId: orgA,
    phone: '098860 67890',
  });
  assert(res2.isNew === false, 'Existing contact matched and reused');
  assert(res2.contact.id === res1.contact.id, 'Same contact ID preserved across formatting variants');

  // Test 2: Contact Suppression & Do-Not-Contact Enforcement
  console.log('\n--- TEST 2: Do-Not-Contact (DNC) Suppression ---');
  const dncContact = await contactService.suppressContact(orgA, res1.contact.id, 'Customer explicitly opted out');
  assert(dncContact.status === 'DO_NOT_CONTACT', 'Contact marked DO_NOT_CONTACT');
  
  const canOutreach = await contactService.isOutreachPermitted(orgA, res1.contact.id);
  assert(canOutreach === false, 'Automated outreach rejected by server-side suppression guard');

  // Test 3: Deterministic Lead Qualification Engine
  console.log('\n--- TEST 3: Deterministic Lead Qualification Engine ---');
  // Case A: High-intent real estate buyer
  const qualResultA = LeadQualificationEngine.evaluate('REAL_ESTATE', {
    requirement: '3BHK Villa Plot',
    location: 'Whitefield',
    budget: '₹1.8 Cr',
    timeline: 'Immediate',
    appointmentOrVisitRequested: true,
    contactablePhone: true,
    emailProvided: true,
  });
  assert(qualResultA.score === 100, `High intent score is 100: ${qualResultA.score}`);
  assert(qualResultA.status === 'QUALIFIED', 'Lead qualified');

  // Case B: General casual inquiry
  const qualResultB = LeadQualificationEngine.evaluate('DENTAL', {
    requirement: 'Clinic timings',
    contactablePhone: true,
  });
  assert(qualResultB.score === 30, `Low intent score is 30: ${qualResultB.score}`);
  assert(qualResultB.status === 'PARTIALLY_QUALIFIED', 'Lead marked partially qualified');

  // Test 4: Lead Creation & Conversational Deduplication
  console.log('\n--- TEST 4: Lead Creation & Lifecycle ---');
  // New contact for lead testing
  const { contact: leadContact } = await contactService.resolveOrCreateContact({
    organizationId: orgA,
    displayName: 'Anand Kulkarni',
    phone: '9845012345',
  });

  const leadRes1 = await leadService.createLead({
    organizationId: orgA,
    contactId: leadContact.id,
    interest: 'Dental Implants Consultation',
    industry: 'DENTAL',
    budget: '₹35,000',
    timeline: 'This weekend',
    appointmentOrVisitRequested: true,
  });
  assert(leadRes1.isNew === true, 'New lead created');
  assert(leadRes1.lead.status === 'QUALIFIED', 'Lead status is QUALIFIED');
  assert(leadRes1.lead.stage === 'APPOINTMENT', 'Lead stage advanced to APPOINTMENT');

  // Subsequent call from same contact updates existing active lead rather than duplicating
  const leadRes2 = await leadService.createLead({
    organizationId: orgA,
    contactId: leadContact.id,
    interest: 'Dental Implants Consultation + Scaling',
    industry: 'DENTAL',
    notes: 'Also requested teeth cleaning quote',
  });
  assert(leadRes2.isNew === false, 'Existing active lead updated instead of creating duplicate');
  assert(leadRes2.lead.id === leadRes1.lead.id, 'Lead ID preserved');

  // Test 5: Pipeline Stage Progression
  console.log('\n--- TEST 5: Pipeline Stage Progression ---');
  const stageLead = await leadService.updateStage(orgA, leadRes1.lead.id, 'PROPOSAL', 'Sent treatment estimate');
  assert(stageLead.stage === 'PROPOSAL', 'Stage advanced to PROPOSAL');

  const wonLead = await leadService.updateStage(orgA, leadRes1.lead.id, 'CONVERTED', 'Treatment deposit paid');
  assert(wonLead.status === 'CONVERTED', 'Status changed to CONVERTED');
  assert(wonLead.convertedAt !== undefined, 'Converted timestamp recorded');

  // Test 6: Assignment & Follow-Up Scheduling
  console.log('\n--- TEST 6: Lead Assignment & Follow-Up ---');
  const assigned = await leadService.assignLead(orgA, leadRes1.lead.id, 'dr_roopa_rao', 'IMPLANTOLOGY_TEAM');
  assert(assigned.assignedTo === 'dr_roopa_rao', 'Lead assigned to Dr. Roopa');
  assert(assigned.assignedTeam === 'IMPLANTOLOGY_TEAM', 'Team assigned');

  const followUpLead = await leadService.scheduleFollowUp(orgA, leadRes1.lead.id, '2026-10-10T10:00:00.000Z', 'Follow-up for post-op check');
  assert(followUpLead.nextFollowUpAt === '2026-10-10T10:00:00.000Z', 'Next follow-up date saved');
  assert(followUpLead.stage === 'FOLLOW_UP', 'Stage transitioned to FOLLOW_UP');

  // Test 7: Activity Timeline
  console.log('\n--- TEST 7: Operational Activity Timeline ---');
  const timeline = await leadService.getTimeline(orgA, { leadId: leadRes1.lead.id });
  assert(timeline.length >= 4, `Timeline recorded ${timeline.length} operational activities (expected >= 4)`);
  assert(timeline.some(a => a.type === 'LEAD_CREATED'), 'LEAD_CREATED activity present');
  assert(timeline.some(a => a.type === 'STAGE_CHANGED'), 'STAGE_CHANGED activity present');

  // Test 8: Public Web Lead Ingestion
  console.log('\n--- TEST 8: Public Website Lead Ingestion ---');
  const webLead = await webIngestion.ingestPublicLead(orgA, {
    name: 'Rohit Sharma',
    phone: '9820011223',
    email: 'rohit@cricket.in',
    interest: 'Consultation for teeth whitening',
    city: 'Bengaluru',
    message: 'Need appointment before tour',
  });
  assert(webLead.success === true, 'Public web lead ingested successfully');
  assert(webLead.contact.phone === '+919820011223', 'Web contact phone normalized');
  assert(webLead.lead.source === 'WEBSITE', 'Lead source attributed to WEBSITE');

  // Test 9: Multi-Tenant Isolation
  console.log('\n--- TEST 9: Multi-Tenant Boundary Isolation ---');
  // Tenant B searches for Tenant A contacts
  const orgBContacts = await contactService.listContacts(orgB);
  assert(orgBContacts.total === 0, 'Tenant B cannot see Tenant A contacts');

  const orgBCrossLookup = await contactService.getContact(orgB, res1.contact.id);
  assert(orgBCrossLookup === null, 'Direct cross-tenant contact lookup returned null');

  // Test 10: Operational CRM Analytics
  console.log('\n--- TEST 10: CRM Operational Analytics ---');
  const analytics = await db.getCRMAnalytics(orgA);
  assert(analytics.totalLeads >= 2, `Total leads computed: ${analytics.totalLeads}`);
  assert(analytics.convertedLeads >= 1, `Converted leads computed: ${analytics.convertedLeads}`);
  assert(analytics.totalContacts >= 3, `Total contacts computed: ${analytics.totalContacts}`);
  assert(analytics.leadSourcesBreakdown['WEBSITE'] >= 1, 'Website attribution in analytics verified');

  console.log('\n================================================================');
  console.log(`🎉 ALL CRM TESTS PASSED: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');
}

runCRMTestSuite().catch(err => {
  console.error('Fatal CRM Test Failure:', err);
  process.exit(1);
});
