/**
 * @vanni/agent-core — Role System & Industry Defaults
 *
 * Provides intelligent, domain-tailored default configurations for AI Employees
 * across Karnataka and Indian business verticals (Healthcare, Dental, IVF, Real Estate, Hospitality).
 */

import {
  AIEmployeeRole,
  AgentIdentityConfig,
  AgentObjectiveConfig,
  AgentPersonalityConfig,
  AgentLanguageConfig,
  AgentCapabilityConfig,
  AgentKnowledgeAccessConfig,
  AgentToolConfig,
  AgentEscalationConfig,
  AgentEscalationTriggerConfig,
  AgentPolicyConfig,
  AgentConversationRulesConfig,
} from '@vanni/shared';

export interface AgentRoleTemplate {
  role: AIEmployeeRole;
  displayName: string;
  recommendedDescription: string;
  recommendedObjective: string;
  secondaryObjectives: string[];
  successCriteria: string[];
  recommendedCapabilities: AgentCapabilityConfig[];
  recommendedPersonalityPreset: AgentPersonalityConfig['preset'];
  defaultTone: AgentPersonalityConfig['tone'];
  defaultStyle: AgentPersonalityConfig['conversationStyle'];
  defaultEnergy: AgentPersonalityConfig['energy'];
  recommendedTools: AgentToolConfig[];
  recommendedEscalation: AgentEscalationConfig;
  recommendedPolicies: AgentPolicyConfig;
  recommendedConversationRules: AgentConversationRulesConfig;
  industryCompatibility: string[];
}

export function getRoleDefaults(
  role: AIEmployeeRole,
  industry: string,
  businessName: string = 'Our Business'
): {
  identity: AgentIdentityConfig;
  objective: AgentObjectiveConfig;
  personality: AgentPersonalityConfig;
  language: AgentLanguageConfig;
  capabilities: AgentCapabilityConfig[];
  knowledgeAccess: AgentKnowledgeAccessConfig;
  tools: AgentToolConfig[];
  escalation: AgentEscalationConfig;
  policies: AgentPolicyConfig;
  conversationRules: AgentConversationRulesConfig;
} {
  const normIndustry = industry.toUpperCase().replace(/\s+/g, '_');

  // Common capabilities catalogue
  const allCapabilities: AgentCapabilityConfig[] = [
    { capability: 'ANSWER_QUESTIONS', enabled: true, requiresPermission: false },
    { capability: 'COLLECT_CONTACT_DETAILS', enabled: true, requiresPermission: false },
    { capability: 'TRANSFER_TO_HUMAN', enabled: true, requiresPermission: false },
    { capability: 'CHECK_AVAILABILITY', enabled: true, requiresPermission: false },
    { capability: 'BOOK_APPOINTMENT', enabled: false, requiresPermission: true },
    { capability: 'QUALIFY_LEAD', enabled: false, requiresPermission: false },
    { capability: 'RESCHEDULE_APPOINTMENT', enabled: false, requiresPermission: true },
    { capability: 'CANCEL_APPOINTMENT', enabled: false, requiresPermission: true },
    { capability: 'CONFIRM_APPOINTMENT', enabled: true, requiresPermission: false },
    { capability: 'FOLLOW_UP', enabled: false, requiresPermission: true },
    { capability: 'SEND_MESSAGE', enabled: true, requiresPermission: false },
    { capability: 'CREATE_LEAD', enabled: false, requiresPermission: false },
    { capability: 'UPDATE_LEAD', enabled: false, requiresPermission: false },
    { capability: 'CREATE_TASK', enabled: true, requiresPermission: false },
  ];

  // Specific adjustments by role & industry
  let roleDisplayName = 'AI Employee';
  let primaryObjective = `Assist customers and represent ${businessName} professionally.`;
  let secondaryObjectives: string[] = ['Answer inquiries accurately', 'Route calls to human staff when needed'];
  let successCriteria: string[] = ['Caller inquiry addressed with zero hallucination', 'Seamless human escalation'];
  let defaultTone: AgentPersonalityConfig['tone'] = 'PROFESSIONAL';
  let defaultPreset: AgentPersonalityConfig['preset'] = 'PROFESSIONAL_RECEPTIONIST';
  let defaultStyle: AgentPersonalityConfig['conversationStyle'] = 'BALANCED';
  let defaultEnergy: AgentPersonalityConfig['energy'] = 'CALM';
  let customInstructions = 'Identify yourself politely as an AI employee. Never fabricate facts.';
  let isHealthcare = normIndustry.includes('HEALTH') || normIndustry.includes('CLINIC') || normIndustry.includes('DENTAL') || normIndustry.includes('IVF') || normIndustry.includes('HOSPITAL');
  let isRealEstate = normIndustry.includes('REAL_ESTATE') || normIndustry.includes('BUILDER') || normIndustry.includes('PROPERTY') || normIndustry.includes('LAYOUT');

  // Enable capabilities based on role
  const capabilities = allCapabilities.map(c => ({ ...c }));

  const setCap = (cap: string, enabled: boolean, requiresPermission = false) => {
    const found = capabilities.find(c => c.capability === cap);
    if (found) {
      found.enabled = enabled;
      found.requiresPermission = requiresPermission;
    }
  };

  switch (role) {
    case 'AI_RECEPTIONIST':
    case 'AI_FRONT_DESK':
      roleDisplayName = isHealthcare ? 'AI Clinic Receptionist' : 'AI Front Desk Assistant';
      primaryObjective = isHealthcare
        ? `Assist patients with clinic timings, doctor schedules, OPD inquiries, and schedule appointments at ${businessName}.`
        : `Answer property and service questions, assist guests, and manage bookings for ${businessName}.`;
      secondaryObjectives = isHealthcare
        ? ['Provide consultation fee & diagnostic info', 'Route medical emergencies to casualty trauma immediately', 'Book appointments with authorized doctors']
        : ['Answer room and amenity questions', 'Qualify booking inquiries', 'Escalate guest requests to front desk staff'];
      successCriteria = isHealthcare
        ? ['Patient queries resolved', 'Zero medical diagnosis provided', 'Casualty emergencies transferred instantly']
        : ['Guest inquiry resolved', 'Booking details gathered accurately'];
      setCap('BOOK_APPOINTMENT', true, true);
      setCap('CHECK_AVAILABILITY', true, false);
      defaultPreset = 'PROFESSIONAL_RECEPTIONIST';
      defaultTone = 'PROFESSIONAL';
      defaultEnergy = 'CALM';
      if (isHealthcare) {
        customInstructions = 'Always maintain calm professionalism. Strictly adhere to medical safety: NEVER diagnose illnesses, recommend drugs, or prescribe treatments. If caller describes acute chest pain, trauma, or emergency, escalate to casualty immediately.';
      }
      break;

    case 'AI_SALES_ASSISTANT':
    case 'AI_LEAD_QUALIFIER':
      roleDisplayName = isRealEstate ? 'AI Real Estate Sales Assistant' : 'AI Sales Assistant';
      primaryObjective = isRealEstate
        ? `Qualify buyers for residential plots/properties at ${businessName} and coordinate site visits.`
        : `Understand customer requirements, qualify high-intent leads, and schedule consultations for ${businessName}.`;
      secondaryObjectives = isRealEstate
        ? ['Explain layout approvals (BUDA/BMRDA/RERA)', 'Share bank loan partners and per sq.ft. pricing', 'Coordinate Sunday site visit cab bookings']
        : ['Explain product offerings', 'Collect customer timeline and budget', 'Create verified lead dossiers in CRM'];
      successCriteria = [
        'Lead intent and budget qualified',
        'Customer contact details verified',
        'Site visit or sales consultation scheduled',
      ];
      setCap('QUALIFY_LEAD', true, false);
      setCap('CREATE_LEAD', true, false);
      setCap('UPDATE_LEAD', true, false);
      setCap('BOOK_APPOINTMENT', true, true);
      defaultPreset = 'CONSULTATIVE_SALES_ASSISTANT';
      defaultTone = 'WARM';
      defaultEnergy = 'ENTHUSIASTIC';
      if (isRealEstate) {
        customInstructions = 'Communicate warmly in English, Kannada, or Kanglish. Emphasize verified government approvals and official amenities. NEVER invent discounts or fabricate plot availability not listed in the verified catalogue.';
      }
      break;

    case 'AI_APPOINTMENT_COORDINATOR':
      roleDisplayName = 'AI Appointment Coordinator';
      primaryObjective = `Seamlessly coordinate, confirm, reschedule, and book appointments for ${businessName}.`;
      secondaryObjectives = ['Verify doctor/specialist availability', 'Send SMS/WhatsApp confirmations', 'Handle rescheduling requests'];
      successCriteria = ['Appointment scheduled within available slots', 'Confirmation details gathered'];
      setCap('BOOK_APPOINTMENT', true, true);
      setCap('RESCHEDULE_APPOINTMENT', true, true);
      setCap('CANCEL_APPOINTMENT', false, true); // cancellation strictly protected by default
      setCap('CHECK_AVAILABILITY', true, false);
      defaultPreset = 'PROFESSIONAL_RECEPTIONIST';
      defaultTone = 'PROFESSIONAL';
      defaultStyle = 'BRIEF';
      break;

    case 'AI_CUSTOMER_SUPPORT':
    case 'AI_FOLLOW_UP_EXECUTIVE':
      roleDisplayName = 'AI Customer Support Executive';
      primaryObjective = `Answer customer questions, troubleshoot standard inquiries, and log support requests for ${businessName}.`;
      secondaryObjectives = ['Search authorized knowledge base', 'Clarify customer issue', 'Escalate complaints to human team'];
      successCriteria = ['Customer question answered with citations', 'Unresolved issues escalated with high priority'];
      setCap('CREATE_TASK', true, false);
      setCap('FOLLOW_UP', true, true);
      defaultPreset = 'CONCISE_SUPPORT_ASSISTANT';
      defaultTone = 'WARM';
      defaultStyle = 'BALANCED';
      break;

    default:
      roleDisplayName = 'AI Business Assistant';
      primaryObjective = `Assist callers and answer questions regarding ${businessName}.`;
      defaultPreset = 'PROFESSIONAL_RECEPTIONIST';
      break;
  }

  // Pre-configured tool suite
  const tools: AgentToolConfig[] = [
    {
      toolName: 'knowledge_search',
      displayName: 'Business Brain & Document Search',
      enabled: true,
      category: 'KNOWLEDGE',
      isImplemented: true,
      permissions: { canExecute: true, requiresConfirmation: false },
    },
    {
      toolName: 'appointment_scheduler',
      displayName: 'Appointment & Slot Scheduler',
      enabled: capabilities.some(c => c.capability === 'BOOK_APPOINTMENT' && c.enabled),
      category: 'CALENDAR',
      isImplemented: true,
      permissions: { canExecute: true, requiresConfirmation: true },
    },
    {
      toolName: 'telephony_transfer',
      displayName: 'Human Voice Transfer',
      enabled: true,
      category: 'TELEPHONY',
      isImplemented: true,
      permissions: { canExecute: true, requiresConfirmation: false },
    },
    {
      toolName: 'crm_lead_capture',
      displayName: 'Lead Dossier Capture',
      enabled: capabilities.some(c => c.capability === 'QUALIFY_LEAD' && c.enabled),
      category: 'CRM',
      isImplemented: true,
      permissions: { canExecute: true, requiresConfirmation: false },
    },
    {
      toolName: 'sms_whatsapp_dispatch',
      displayName: 'SMS & WhatsApp Notification Dispatch',
      enabled: false,
      category: 'COMMUNICATION',
      isImplemented: false, // Marked configuration-ready
      permissions: { canExecute: false, requiresConfirmation: true },
    },
  ];

  // Pre-configured escalation triggers
  const escalationTriggers: AgentEscalationTriggerConfig[] = [
    {
      triggerType: 'CUSTOMER_REQUEST_HUMAN',
      enabled: true,
      destinationType: isHealthcare ? 'RECEPTION' : 'SALES_TEAM',
      destinationTarget: 'Front Desk / Team Manager',
      priority: 'NORMAL',
      transferMessage: 'Connecting you with a team member now. Please hold for a moment.',
    },
    {
      triggerType: 'REPEATED_MISUNDERSTANDING',
      enabled: true,
      destinationType: 'SUPPORT_TEAM',
      destinationTarget: 'Support Supervisor',
      priority: 'HIGH',
      transferMessage: 'Let me connect you directly to our senior staff so they can assist you better.',
    },
  ];

  if (isHealthcare) {
    escalationTriggers.unshift({
      triggerType: 'EMERGENCY',
      enabled: true,
      destinationType: 'SPECIFIC_STAFF',
      destinationTarget: 'Casualty Trauma Desk',
      priority: 'CRITICAL',
      transferMessage: 'This requires immediate medical attention. I am transferring your call to our emergency casualty department immediately.',
    });
  }

  return {
    identity: {
      name: isHealthcare ? 'Ananya' : isRealEstate ? 'Sahana' : 'VANNI',
      displayName: `${isHealthcare ? 'Ananya' : isRealEstate ? 'Sahana' : 'VANNI'} — ${roleDisplayName}`,
      role,
      description: `${roleDisplayName} for ${businessName}`,
      businessIntroduction: `Hello, thank you for reaching out to ${businessName}. I'm ${isHealthcare ? 'Ananya' : isRealEstate ? 'Sahana' : 'VANNI'}, your AI assistant.`,
      identifyAsAI: true,
    },
    objective: {
      primaryObjective,
      secondaryObjectives,
      successCriteria,
    },
    personality: {
      preset: defaultPreset,
      tone: defaultTone,
      conversationStyle: defaultStyle,
      energy: defaultEnergy,
      customInstructions,
    },
    language: {
      primaryLanguage: 'kn-en',
      secondaryLanguages: ['en', 'kn'],
      conversationalMode: 'KANGLISH',
      allowSwitching: true,
    },
    capabilities,
    knowledgeAccess: {
      accessLevel: 'ALL_BUSINESS_KNOWLEDGE',
      allowedSourceIds: [],
      restrictedCategories: isHealthcare
        ? ['INTERNAL_STAFF_NOTES', 'FINANCIAL_REPORTS', 'INTERNAL_AUDITS']
        : isRealEstate
        ? ['INTERNAL_COMMISSIONS', 'STAFF_SALARIES']
        : ['INTERNAL_FINANCE'],
    },
    tools,
    escalation: {
      defaultDestinationType: isHealthcare ? 'RECEPTION' : 'SALES_TEAM',
      defaultDestinationTarget: isHealthcare ? 'Clinic Reception Desk' : 'Sales Lead Coordinator',
      triggers: escalationTriggers,
    },
    policies: {
      enforceHealthcareGuardrails: isHealthcare,
      enforceRealEstateGuardrails: isRealEstate,
      enforceSalesGuardrails: !isHealthcare,
      noHallucinationEnforced: true,
      customPolicyIds: [],
    },
    conversationRules: {
      greetingStyle: isHealthcare ? 'FORMAL' : 'WARM',
      questionStrategy: isHealthcare ? 'ONE_BY_ONE' : 'NATURAL_FLOW',
      responseLength: isHealthcare ? 'BRIEF' : 'BALANCED',
      uncertaintyBehavior: 'STATE_UNCERTAINTY',
      silenceHandling: 'GENTLE_PROMPT',
    },
  };
}
