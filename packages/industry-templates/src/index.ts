/**
 * @vanni/industry-templates — Declarative Domain Industry Templates & Business Brain Blueprints
 * Establishes structured entity schemas, terminologies, default policies, AI guardrails,
 * and knowledge categories for Dental, Healthcare, IVF, Hospitality, Real Estate, and Generic industries.
 */

import { IndustryType, RegionalDialect, PolicyCategory } from '@vanni/shared';

export interface EntityDefinition {
  name: string;
  plural: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'string' | 'number' | 'currency' | 'boolean' | 'array';
    required: boolean;
    description?: string;
  }>;
}

export interface TerminologyMapping {
  canonical: string;
  english: string;
  kannada: string;
  kanglish: string;
  category: 'SERVICE' | 'PERSON' | 'LOCATION' | 'COMMERCIAL' | 'EMERGENCY';
  mustNotTranslate?: boolean;
}

export interface DefaultPolicyTemplate {
  category: PolicyCategory;
  title: string;
  statement: string;
  kannadaStatement?: string;
  enforcementLevel: 'STRICT_BLOCK' | 'ESCALATE_TO_STAFF' | 'INFORMATIONAL';
}

export interface DetailedIndustryTemplate {
  industry: IndustryType;
  displayName: string;
  version: string;
  description: string;
  entities: EntityDefinition[];
  knowledgeCategories: string[];
  terminology: TerminologyMapping[];
  aiDefaults: {
    roleTitle: string;
    primaryDialect: RegionalDialect;
    speechPace: number;
    greetingKannada: string;
    greetingKanglish: string;
    voiceGender: 'FEMALE' | 'MALE';
    voiceSpeakerId: string;
    unknownFallbackPolicy: string;
  };
  defaultPolicies: DefaultPolicyTemplate[];
  capabilities: string[];
  guardrails: string[];
  sampleFaqs: Array<{
    category: string;
    question: string;
    answer: string;
    kannadaQuestion?: string;
    kannadaAnswer?: string;
    language: 'EN' | 'KN' | 'KANGLISH';
  }>;
}

export const INDUSTRY_TEMPLATES: Record<IndustryType, DetailedIndustryTemplate> = {
  // 1. DENTAL
  DENTAL: {
    industry: 'DENTAL',
    displayName: 'Dental Care & Implantology',
    version: '2.0.0',
    description: 'Bilingual AI receptionist for multi-chair dental clinics, handling toothache triage, root canal bookings, and teeth cleaning schedules.',
    entities: [
      {
        name: 'Dentist',
        plural: 'Dentists',
        description: 'Dental practitioners and specialists available for consultations.',
        fields: [
          { key: 'fullName', label: 'Doctor Name', type: 'string', required: true },
          { key: 'specialization', label: 'Specialization (e.g. Endodontist, Orthodontist)', type: 'string', required: true },
          { key: 'consultationFee', label: 'Consultation Fee (INR)', type: 'currency', required: true },
          { key: 'availableDays', label: 'Working Days', type: 'array', required: true },
        ],
      },
      {
        name: 'Dental Treatment',
        plural: 'Dental Treatments',
        description: 'Dental procedures and standard catalog pricing.',
        fields: [
          { key: 'name', label: 'Treatment Name', type: 'string', required: true },
          { key: 'priceMinimum', label: 'Base Fee (INR)', type: 'currency', required: true },
          { key: 'durationMinutes', label: 'Chair Duration (mins)', type: 'number', required: true },
          { key: 'isBookableByAI', label: 'Instant Booking Allowed', type: 'boolean', required: true },
        ],
      },
    ],
    knowledgeCategories: [
      'Appointments & Slots',
      'Toothache & Emergency',
      'Root Canal & Crowns',
      'Teeth Cleaning & Whitening',
      'Braces & Aligners',
      'Insurance & Payment Modes',
    ],
    terminology: [
      { canonical: 'ROOT_CANAL', english: 'Root Canal Treatment', kannada: 'ರೂಟ್ ಕೆನಾಲ್ ಚಿಕಿತ್ಸೆ', kanglish: 'Root canal treatment', category: 'SERVICE', mustNotTranslate: true },
      { canonical: 'TEETH_CLEANING', english: 'Teeth Cleaning / Scaling', kannada: 'ಹಲ್ಲು ಸ್ವಚ್ಛಗೊಳಿಸುವಿಕೆ', kanglish: 'Teeth cleaning / Scaling', category: 'SERVICE' },
      { canonical: 'CONSULTATION_FEE', english: 'Doctor Consultation Fee', kannada: 'ವೈದ್ಯರ ತಪಾಸಣಾ ಶುಲ್ಕ', kanglish: 'Doctor consultation fee', category: 'COMMERCIAL' },
      { canonical: 'ACUTE_TOOTHACHE', english: 'Severe Tooth Pain', kannada: 'ತೀವ್ರವಾದ ಹಲ್ಲುನೋವು', kanglish: 'Severe tooth pain / emergency', category: 'EMERGENCY' },
    ],
    aiDefaults: {
      roleTitle: 'Dental Front-Desk Care Coordinator',
      primaryDialect: 'KANGLISH_BUSINESS',
      speechPace: 1.05,
      greetingKannada: 'ನಮಸ್ಕಾರ, ಡೆಂಟಲ್ ಕ್ಲಿನಿಕ್‌ಗೆ ಸ್ವಾಗತ. ನಾನು ಡಾಕ್ಟರ್ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಲು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
      greetingKanglish: 'Namaskara! Dental clinic ge welcome. Doctor appointment check maadbeka sir?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'If specific treatment pricing or crown quote is not in catalog, clarify that precise fees require clinical X-ray evaluation and offer to schedule consultation.',
    },
    defaultPolicies: [
      {
        category: 'EMERGENCY',
        title: 'Acute Tooth Pain Escalation',
        statement: 'Emergency trauma or severe swelling calls must be immediately prioritized for today’s urgent chair slot or transferred to the on-call doctor.',
        kannadaStatement: 'ತೀವ್ರವಾದ ನೋವು ಅಥವಾ ಊತವಿದ್ದರೆ ತಕ್ಷಣ ಇಂದಿನ ತುರ್ತು ಸ್ಲಾಟ್ ಕಾಯ್ದಿರಿಸಿ ಅಥವಾ ವೈದ್ಯರಿಗೆ ಸಂಪರ್ಕಿಸಿ.',
        enforcementLevel: 'ESCALATE_TO_STAFF',
      },
      {
        category: 'CANCELLATION',
        title: '2-Hour Notice for Rescheduling',
        statement: 'Patients are requested to notify at least 2 hours in advance to reschedule dental chair appointments.',
        enforcementLevel: 'INFORMATIONAL',
      },
      {
        category: 'AI_RESTRICTION',
        title: 'Zero Prescription Rule',
        statement: 'AI must NEVER prescribe antibiotics, painkillers, or declare medical diagnoses. Only licensed dental surgeons may diagnose.',
        enforcementLevel: 'STRICT_BLOCK',
      },
    ],
    capabilities: [
      'Check dentist OPD hours',
      'Schedule cleanings and check-up visits',
      'Provide verified treatment base pricing',
      'Capture patient pain symptoms for doctor triage',
      'Send WhatsApp clinic directions and timing cards',
    ],
    guardrails: [
      'Never prescribe painkillers (e.g. Paracetamol, Ketorolac, Amoxicillin)',
      'Never guarantee painless root canal without doctor examination',
      'Never invent unapproved promotional discounts',
    ],
    sampleFaqs: [
      {
        category: 'Root Canal & Crowns',
        question: 'Root canal consultation fee eshtu?',
        answer: 'Consultation fee ₹400 aaguththe sir. Complete root canal starting from ₹3,500 based on tooth condition.',
        language: 'KANGLISH',
      },
      {
        category: 'Appointments & Slots',
        question: 'Doctor avaru yaava time ge sigthare?',
        answer: 'Doctor avaru prati dina beligge 10:00 AM inda 1:30 PM mathu sanje 5:00 PM inda 8:30 PM varagu available irthare sir.',
        language: 'KANGLISH',
      },
    ],
  },

  // 2. HEALTHCARE_HOSPITAL
  HEALTHCARE_HOSPITAL: {
    industry: 'HEALTHCARE_HOSPITAL',
    displayName: 'Multi-Specialty Hospital & Clinic',
    version: '2.0.0',
    description: 'High-throughput OPD telephone receptionist and triage executive managing multi-department doctor consultations, lab timings, and emergency routing.',
    entities: [
      {
        name: 'Doctor',
        plural: 'Doctors',
        description: 'Specialists, surgeons, and physicians across departments.',
        fields: [
          { key: 'fullName', label: 'Doctor Name', type: 'string', required: true },
          { key: 'specialization', label: 'Department / Specialty', type: 'string', required: true },
          { key: 'consultationFee', label: 'OPD Fee (INR)', type: 'currency', required: true },
          { key: 'availableDays', label: 'OPD Days', type: 'array', required: true },
        ],
      },
      {
        name: 'Department',
        plural: 'Departments',
        description: 'Clinical specialties (Cardiology, Orthopedics, Pediatrics, etc.)',
        fields: [
          { key: 'name', label: 'Department Name', type: 'string', required: true },
          { key: 'floorOrBlock', label: 'Building Floor / Wing', type: 'string', required: true },
        ],
      },
    ],
    knowledgeCategories: [
      'Doctor OPD Schedules',
      'Emergency & Ambulance 24x7',
      'Diagnostic Lab & Radiology',
      'Insurance TPA Desk',
      'Visiting Hours & Wards',
    ],
    terminology: [
      { canonical: 'OPD_CONSULTATION', english: 'OPD Consultation', kannada: 'ಹೊರರೋಗಿ ವಿಭಾಗದ ತಪಾಸಣೆ', kanglish: 'OPD consultation', category: 'SERVICE', mustNotTranslate: true },
      { canonical: 'EMERGENCY_CASUALTY', english: '24x7 Casualty & Emergency', kannada: '24 ಗಂಟೆ ತುರ್ತು ಚಿಕಿತ್ಸಾ ಘಟಕ', kanglish: '24x7 Casualty & Emergency', category: 'EMERGENCY' },
      { canonical: 'INSURANCE_TPA', english: 'Cashless Insurance Desk', kannada: 'ವಿಮಾ ಕೌಂಟರ್', kanglish: 'Cashless Insurance TPA Desk', category: 'COMMERCIAL', mustNotTranslate: true },
    ],
    aiDefaults: {
      roleTitle: 'OPD Receptionist & Patient Care Coordinator',
      primaryDialect: 'KANNADA_STANDARD_POLITE',
      speechPace: 1.0,
      greetingKannada: 'ನಮಸ್ಕಾರ, ಆಸ್ಪತ್ರೆಗೆ ಸ್ವಾಗತ. ತಾವು ಯಾವ ತಜ್ಞ ವೈದ್ಯರನ್ನು ಭೇಟಿಯಾಗಬೇಕಿತ್ತು ತಿಳಿಸುತ್ತೀರಾ?',
      greetingKanglish: 'Namaskara, Apollo Clinic ge welcome. Yaava doctor consultation appointment bekithu sir?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'Inform caller that specific medical condition requires in-person doctor assessment and offer available OPD slot.',
    },
    defaultPolicies: [
      {
        category: 'EMERGENCY',
        title: 'Trauma & Cardiac Emergency Protocol',
        statement: 'Immediate verbal guidance to rush to Casualty Block A or transfer directly to Emergency Hotline +91 80 4719 2000.',
        kannadaStatement: 'ತುರ್ತು ಚಿಕಿತ್ಸೆಗೆ ನೇರವಾಗಿ ಕ್ಯಾಶುವಾಲ್ಟಿ ವಿಭಾಗಕ್ಕೆ ಬನ್ನಿ ಅಥವಾ ತುರ್ತು ಸಂಖ್ಯೆಗೆ ಕರೆ ಮಾಡಿ.',
        enforcementLevel: 'ESCALATE_TO_STAFF',
      },
      {
        category: 'AI_RESTRICTION',
        title: 'Zero Diagnostic Claim Policy',
        statement: 'AI is strictly prohibited from interpreting lab reports, diagnosing illnesses, or advising on drug dosages.',
        enforcementLevel: 'STRICT_BLOCK',
      },
    ],
    capabilities: [
      'Provide doctor OPD consultation hours and room numbers',
      'Schedule doctor appointments in open calendar slots',
      'Provide diagnostic lab test fasting prerequisites',
      'Direct emergency callers to 24x7 casualty staff',
    ],
    guardrails: [
      'Strictly NO medical diagnosis under any circumstance',
      'Never recommend specific medications or alter existing prescriptions',
      'Never dispute physician recommendations',
    ],
    sampleFaqs: [
      {
        category: 'Doctor OPD Schedules',
        question: 'Cardiologist Dr. Ramesh Patil avara appointment bekitthu',
        answer: 'Haudu sir, Dr. Ramesh Patil avaru Mon-Sat beligge 10:00 AM inda 1:00 PM mathu sanje 5:00 PM inda 8:00 PM varagu consultation madthare. OPD fee ₹750.',
        language: 'KANGLISH',
      },
    ],
  },

  // 3. IVF_FERTILITY
  IVF_FERTILITY: {
    industry: 'IVF_FERTILITY',
    displayName: 'Fertility & Reproductive Medicine',
    version: '2.0.0',
    description: 'Empathetic, discreet, and highly confidential intake coordinator for couples seeking fertility assessments, IUI, and IVF treatment options.',
    entities: [
      {
        name: 'Fertility Specialist',
        plural: 'Fertility Specialists',
        description: 'Reproductive endocrinologists and embryologists.',
        fields: [
          { key: 'fullName', label: 'Doctor Name', type: 'string', required: true },
          { key: 'specialization', label: 'Specialization (e.g. IVF Specialist)', type: 'string', required: true },
          { key: 'consultationFee', label: 'Couple Consultation Fee (INR)', type: 'currency', required: true },
        ],
      },
      {
        name: 'Consultation Package',
        plural: 'Consultation Packages',
        description: 'Initial couple diagnostic assessments.',
        fields: [
          { key: 'name', label: 'Package Name', type: 'string', required: true },
          { key: 'durationMinutes', label: 'Session Length (mins)', type: 'number', required: true },
        ],
      },
    ],
    knowledgeCategories: [
      'Couple Consultations',
      'Confidentiality & Privacy',
      'Diagnostic Tests & Scans',
      'Center Locations & Timings',
    ],
    terminology: [
      { canonical: 'COUPLE_CONSULTATION', english: 'Couple Consultation', kannada: 'ದಂಪತಿ ಸಮಾಲೋಚನೆ', kanglish: 'Couple consultation', category: 'SERVICE' },
      { canonical: 'CONFIDENTIALITY', english: 'Strict Confidentiality', kannada: 'ಸಂಪೂರ್ಣ ಗೌಪ್ಯತೆ', kanglish: 'Complete privacy & confidentiality', category: 'SERVICE' },
    ],
    aiDefaults: {
      roleTitle: 'Confidential Care & Intake Coordinator',
      primaryDialect: 'KANNADA_STANDARD_POLITE',
      speechPace: 0.95,
      greetingKannada: 'ನಮಸ್ಕಾರ, ಫರ್ಟಿಲಿಟಿ ಸೆಂಟರ್‌ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಗೌಪ್ಯತೆಗೆ ನಾವು ಮೊದಲ ಪ್ರಾಧಾನ್ಯತೆ ನೀಡುತ್ತೇವೆ. ಮೊದಲ ಸಮಾಲೋಚನೆಗಾಗಿ ಸಮಯ ನಿಗದಿಪಡಿಸಬೇಕೆ?',
      greetingKanglish: 'Namaskara! Fertility Center ge welcome. Doctor jothe confidential first consultation book maadona sir?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'Reassure the patient warmly and connect them with the Senior Care Counselor for personal guidance.',
    },
    defaultPolicies: [
      {
        category: 'PRIVACY',
        title: 'Absolute Patient Privacy Protocol',
        statement: 'Never reveal patient names or records to third parties. All inquiries are strictly private and confidential.',
        enforcementLevel: 'STRICT_BLOCK',
      },
      {
        category: 'AI_RESTRICTION',
        title: 'Zero Success Rate Guarantee',
        statement: 'AI must never quote specific percentage success guarantees. Every biological case is determined exclusively by the medical team.',
        enforcementLevel: 'STRICT_BLOCK',
      },
    ],
    capabilities: [
      'Schedule 45-minute comprehensive couple consultations',
      'Explain clinic timings, locations, and parking facilities',
      'Provide empathetic reassurance without clinical claims',
    ],
    guardrails: [
      'Never promise guaranteed pregnancy or treatment success rates',
      'Never recommend medications or hormone therapies over the phone',
    ],
    sampleFaqs: [
      {
        category: 'Couple Consultations',
        question: 'First consultation ge iddaru barbeka?',
        answer: 'Haudu madam, detailed clinical assessment ge dambathiyaru (couple) iddaru bandhare olleyadhu. Consultation 45 minutes iruththe.',
        language: 'KANGLISH',
      },
    ],
  },

  // 4. HOSPITALITY_RESORT
  HOSPITALITY_RESORT: {
    industry: 'HOSPITALITY_RESORT',
    displayName: 'Luxury Resorts, Hotels & Stays',
    version: '2.0.0',
    description: 'Bilingual hospitality concierge handling room inquiries, meal inclusions, check-in policies, corporate day-outs, and weekend getaway packages.',
    entities: [
      {
        name: 'Room Category',
        plural: 'Room Categories',
        description: 'Cottages, villas, and suites available for booking.',
        fields: [
          { key: 'name', label: 'Room / Cottage Name', type: 'string', required: true },
          { key: 'priceMinimum', label: 'Tariff Per Night (INR)', type: 'currency', required: true },
          { key: 'maxOccupancy', label: 'Maximum Occupancy', type: 'number', required: true },
          { key: 'amenities', label: 'Included Amenities', type: 'array', required: true },
        ],
      },
      {
        name: 'Dining & Activities',
        plural: 'Dining & Activities',
        description: 'Buffets, pool timings, trekking, and indoor sports.',
        fields: [
          { key: 'name', label: 'Activity Name', type: 'string', required: true },
          { key: 'timing', label: 'Timings', type: 'string', required: true },
        ],
      },
    ],
    knowledgeCategories: [
      'Room Tariff & Packages',
      'Check-in & Check-out Policies',
      'Buffet Meals & Dining',
      'Swimming Pool & Activities',
      'Location & Route Directions',
    ],
    terminology: [
      { canonical: 'CHECK_IN_TIME', english: 'Check-in Time (1:00 PM)', kannada: 'ಚೆಕ್-ಇನ್ ಸಮಯ ಮಧ್ಯಾಹ್ನ 1:00', kanglish: 'Check-in time 1:00 PM', category: 'SERVICE', mustNotTranslate: true },
      { canonical: 'CHECK_OUT_TIME', english: 'Check-out Time (11:00 AM)', kannada: 'ಚೆಕ್-ಔಟ್ ಸಮಯ ಬೆಳಗ್ಗೆ 11:00', kanglish: 'Check-out time 11:00 AM', category: 'SERVICE', mustNotTranslate: true },
      { canonical: 'MEAL_PACKAGE', english: 'All Meals Included (Buffet)', kannada: 'ಊಟ ಸಹಿತ ಪ್ಯಾಕೇಜ್', kanglish: 'All meals buffet package (Breakfast, Lunch, Dinner)', category: 'COMMERCIAL' },
    ],
    aiDefaults: {
      roleTitle: 'Resort Concierge & Booking Executive',
      primaryDialect: 'KANGLISH_BUSINESS',
      speechPace: 1.05,
      greetingKannada: 'ನಮಸ್ಕಾರ, ರೆಸಾರ್ಟ್ ಬುಕಿಂಗ್ಸ್‌ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ರಜಾದಿನಗಳ ವಾಸ್ತವ್ಯದ ಬಗ್ಗೆ ಮಾಹಿತಿ ಬೇಕಿತ್ತೇ ಸರ್?',
      greetingKanglish: 'Namaskara sir! Resort booking details check maadla? Yaava dates ge plan maadtha iddira?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'State that live room availability on peak weekends must be confirmed with the reservation desk, and transfer.',
    },
    defaultPolicies: [
      {
        category: 'CANCELLATION',
        title: '72-Hour Cancellation Window',
        statement: 'Full refund for cancellations made 72 hours prior to check-in date. Within 72 hours, 1 night retention applies.',
        enforcementLevel: 'INFORMATIONAL',
      },
      {
        category: 'APPOINTMENT',
        title: 'Government ID Mandatory',
        statement: 'All adult guests must present government photo identification (Aadhaar, Passport, or Driving License) during physical check-in.',
        enforcementLevel: 'INFORMATIONAL',
      },
    ],
    capabilities: [
      'Provide package rates with meal plan breakdown',
      'State strict check-in (1:00 PM) and check-out (11:00 AM) timings',
      'Explain swimming pool rules, dress code, and pet policies',
      'Send WhatsApp location maps and booking payment links',
    ],
    guardrails: [
      'Never invent unlisted room availability when fully booked',
      'Never promise early check-in before 1:00 PM without manager clearance',
    ],
    sampleFaqs: [
      {
        category: 'Room Tariff & Packages',
        question: 'Weekend couple package rate eshtu?',
        answer: 'Couple cottage package ₹6,500 per night sir. Ithara olage breakfast, lunch, high tea mathu dinner buffet include aaguththe.',
        language: 'KANGLISH',
      },
    ],
  },

  // 5. REAL_ESTATE
  REAL_ESTATE: {
    industry: 'REAL_ESTATE',
    displayName: 'Residential Layouts & Commercial Real Estate',
    version: '2.0.0',
    description: 'High-conversion qualification agent for plotted developments, villa communities, and apartments, booking free Sunday cab pickups and site visits.',
    entities: [
      {
        name: 'Plot Dimension',
        plural: 'Plot Dimensions',
        description: 'Available site cuts and prices (30x40, 30x50, 40x60).',
        fields: [
          { key: 'dimension', label: 'Dimensions (e.g. 30x40)', type: 'string', required: true },
          { key: 'priceMinimum', label: 'Base Cost (INR)', type: 'currency', required: true },
          { key: 'approvalAuthority', label: 'Approval (e.g. BUDA, BDA, RERA)', type: 'string', required: true },
        ],
      },
      {
        name: 'Layout Project',
        plural: 'Layout Projects',
        description: 'Master township development and location.',
        fields: [
          { key: 'name', label: 'Project Name', type: 'string', required: true },
          { key: 'location', label: 'Road / Highway Location', type: 'string', required: true },
          { key: 'bankApprovals', label: 'Approved Loan Banks', type: 'array', required: true },
        ],
      },
    ],
    knowledgeCategories: [
      'Site Dimensions & Pricing',
      'BUDA / RERA Approvals',
      'Bank Loans & EMI Support',
      'Sunday Site Visit & Free Cab',
      'Project Amenities & Club House',
    ],
    terminology: [
      { canonical: 'SITE_DIMENSION_30X40', english: '30x40 Site (1,200 sq.ft)', kannada: '30x40 ಅಳತೆಯ ನಿವೇಶನ (1,200 ಚದರಡಿ)', kanglish: '30x40 site (1,200 sq.ft)', category: 'SERVICE', mustNotTranslate: true },
      { canonical: 'SITE_DIMENSION_40X60', english: '40x60 Site (2,400 sq.ft)', kannada: '40x60 ಅಳತೆಯ ನಿವೇಶನ (2,400 ಚದರಡಿ)', kanglish: '40x60 site (2,400 sq.ft)', category: 'SERVICE', mustNotTranslate: true },
      { canonical: 'RERA_APPROVAL', english: 'RERA Approved Project', kannada: 'ರೇರಾ ಅನುಮೋದಿತ ಲೇಔಟ್', kanglish: 'RERA approved layout', category: 'SERVICE', mustNotTranslate: true },
      { canonical: 'SUNDAY_SITE_VISIT', english: 'Free Sunday Site Visit Cab', kannada: 'ಉಚಿತ ಭಾನುವಾರದ ಸೈಟ್ ವೀಕ್ಷಣೆ ವಾಹನ', kanglish: 'Free Sunday cab pickup site visit', category: 'SERVICE' },
    ],
    aiDefaults: {
      roleTitle: 'Inbound Qualifier & Site Visit Booking Executive',
      primaryDialect: 'KANGLISH_BUSINESS',
      speechPace: 1.05,
      greetingKannada: 'ನಮಸ್ಕಾರ ಸರ್, ರೆಸಿಡೆನ್ಶಿಯಲ್ ಲೇಔಟ್ಸ್ ಕಡೆಯಿಂದ ಶಹಾನಾ ಮಾತಾಡ್ತಾ ಇದ್ದೀನಿ. ಸಿರುಗುಪ್ಪ ಬೈಪಾಸ್ ಲೇಔಟ್ ಸೈಟ್ ಡೀಟೇಲ್ಸ್ ನೋಡಿದ್ರಾ?',
      greetingKanglish: 'Namaskara sir! Ballari Layouts kadeyinda mathadtha iddini. Siruguppa bypass road plots details check maadidra sir?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'Confirm that exact plot numbers and corner premiums require site map inspection and book a Sunday visit.',
    },
    defaultPolicies: [
      {
        category: 'APPOINTMENT',
        title: 'Sunday Free Cab Pickup Policy',
        statement: 'Prospective buyers who confirm site visits are provided complimentary door-to-door cab transport on Sundays at 11:00 AM.',
        enforcementLevel: 'INFORMATIONAL',
      },
      {
        category: 'AI_RESTRICTION',
        title: 'Zero Unapproved Price Invention Rule',
        statement: 'VANNI must NEVER fabricate plot availability, unapproved discounts, or promise unverified possession dates.',
        enforcementLevel: 'STRICT_BLOCK',
      },
    ],
    capabilities: [
      'Qualify buyer timeline and plot size preference',
      'Explain BUDA / RERA approval status and bank loan eligibility (SBI, HDFC)',
      'Confirm and book Sunday site visits with family pickup coordinates',
      'Dispatch verified project brochure and Google Maps link via WhatsApp',
    ],
    guardrails: [
      'Never invent unlisted inventory or quote non-existent discount rates',
      'Never make unauthorized legal or registration guarantee claims',
    ],
    sampleFaqs: [
      {
        category: 'Site Dimensions & Pricing',
        question: '30x40 site rate eshtu start aaguththe?',
        answer: 'Siruguppa bypass layout nalli 30x40 DC Converted BUDA approved sites ₹18 Lakhs inda start aaguththe sir. SBI mathu HDFC bank inda 80% loan approval ide.',
        language: 'KANGLISH',
      },
      {
        category: 'Sunday Site Visit & Free Cab',
        question: 'Site visit maadbeku, transport ideya?',
        answer: 'Haudu sir! Prati Sunday beligge 11:00 AM ge free cab pickup ide. Nimma location inda direct layout ge karkondu hogi thorthivi.',
        language: 'KANGLISH',
      },
    ],
  },

  // 6. COMMERCIAL_OTHER (GENERIC SAAS FOUNDATION)
  COMMERCIAL_OTHER: {
    industry: 'COMMERCIAL_OTHER',
    displayName: 'General Business & Commercial Services',
    version: '2.0.0',
    description: 'Adaptable multi-purpose business voice employee for local retail, professional agencies, trading firms, and general enterprises.',
    entities: [
      {
        name: 'Offering',
        plural: 'Offerings',
        description: 'Services, products, or consulting engagements.',
        fields: [
          { key: 'name', label: 'Service / Offering Name', type: 'string', required: true },
          { key: 'priceMinimum', label: 'Price (INR)', type: 'currency', required: false },
          { key: 'description', label: 'Description', type: 'string', required: false },
        ],
      },
      {
        name: 'Team Member',
        plural: 'Team Members',
        description: 'Staff, executives, or representatives.',
        fields: [
          { key: 'fullName', label: 'Name', type: 'string', required: true },
          { key: 'designation', label: 'Designation / Role', type: 'string', required: true },
        ],
      },
    ],
    knowledgeCategories: [
      'Operating Hours & Contact',
      'Products & Services',
      'Pricing & Payment Methods',
      'Location & Office Directions',
    ],
    terminology: [
      { canonical: 'BUSINESS_HOURS', english: 'Business Hours', kannada: 'ವ್ಯಾಪಾರ ಸಮಯ', kanglish: 'Office timings', category: 'SERVICE' },
      { canonical: 'OFFICE_LOCATION', english: 'Office Address & Landmark', kannada: 'ಕಚೇರಿ ವಿಳಾಸ', kanglish: 'Office address & landmark', category: 'LOCATION' },
    ],
    aiDefaults: {
      roleTitle: 'General Business Assistant & Executive',
      primaryDialect: 'KANGLISH_BUSINESS',
      speechPace: 1.05,
      greetingKannada: 'ನಮಸ್ಕಾರ, ನಮ್ಮ ಕಚೇರಿಗೆ ಸ್ವಾಗತ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
      greetingKanglish: 'Namaskara! How can I assist you today sir?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'Politely inform the caller that specific details will be confirmed by the team and take down their contact number.',
    },
    defaultPolicies: [
      {
        category: 'ESCALATION',
        title: 'Customer Callback Promise',
        statement: 'If caller inquiries cannot be resolved from the Business Brain, an executive will return their call within 1 business hour.',
        enforcementLevel: 'INFORMATIONAL',
      },
    ],
    capabilities: [
      'State official business opening and closing hours',
      'Share business location and key landmarks',
      'Collect caller contact information and inquiry notes for staff follow-up',
    ],
    guardrails: [
      'Never invent unlisted product specs or pricing',
      'Never promise unauthorized commercial deals',
    ],
    sampleFaqs: [
      {
        category: 'Operating Hours & Contact',
        question: 'Office yaavaga open iruththe?',
        answer: 'Namma office Somavara inda Shanivara beligge 9:30 AM inda sanje 6:30 PM varagu open iruththe sir.',
        language: 'KANGLISH',
      },
    ],
  },

  // 7. AUTOMOTIVE_DEALER
  AUTOMOTIVE_DEALER: {
    industry: 'AUTOMOTIVE_DEALER',
    displayName: 'Automotive Dealership & Service',
    version: '2.0.0',
    description: 'Vehicle showroom assistant for test drive scheduling, vehicle variants, on-road price estimates, and periodic service bookings.',
    entities: [
      {
        name: 'Vehicle Model',
        plural: 'Vehicle Models',
        description: 'Car or bike models in inventory.',
        fields: [
          { key: 'name', label: 'Model Name', type: 'string', required: true },
          { key: 'priceMinimum', label: 'Ex-Showroom Starting Price', type: 'currency', required: true },
        ],
      },
    ],
    knowledgeCategories: ['Test Drive Booking', 'Vehicle Pricing', 'Periodic Service & Maintenance'],
    terminology: [
      { canonical: 'TEST_DRIVE', english: 'Home Test Drive', kannada: 'ಟೆಸ್ಟ್ ಡ್ರೈವ್', kanglish: 'Test drive slot', category: 'SERVICE', mustNotTranslate: true },
    ],
    aiDefaults: {
      roleTitle: 'Dealership Coordinator',
      primaryDialect: 'KANGLISH_BUSINESS',
      speechPace: 1.05,
      greetingKannada: 'ನಮಸ್ಕಾರ, ಆಟೋಮೊಬೈಲ್ ಶೋರೂಮ್‌ಗೆ ಸ್ವಾಗತ. ಟೆಸ್ಟ್ ಡ್ರೈವ್ ಬುಕ್ ಮಾಡಬೇಕಿತ್ತಾ ಸರ್?',
      greetingKanglish: 'Namaskara! Dealership ge welcome. Test drive slot book maadla sir?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'Connect directly with the Sales Manager for exact variant availability.',
    },
    defaultPolicies: [
      {
        category: 'APPOINTMENT',
        title: 'Valid Driving License Mandatory',
        statement: 'Customers must show a valid Driving License before any test drive vehicle can be operated.',
        enforcementLevel: 'STRICT_BLOCK',
      },
    ],
    capabilities: ['Book showroom or home test drives', 'Explain ex-showroom vs on-road pricing components'],
    guardrails: ['Never promise vehicle delivery dates without showroom inventory confirmation'],
    sampleFaqs: [],
  },

  // 8. DIGITAL_AGENCY
  DIGITAL_AGENCY: {
    industry: 'DIGITAL_AGENCY',
    displayName: 'Digital Marketing & Software Agency',
    version: '2.0.0',
    description: 'Speed-to-lead qualification specialist for ad agencies, software houses, and performance marketing firms.',
    entities: [
      {
        name: 'Service Package',
        plural: 'Service Packages',
        description: 'Retainer packages and software deliverables.',
        fields: [
          { key: 'name', label: 'Package Name', type: 'string', required: true },
        ],
      },
    ],
    knowledgeCategories: ['Agency Capabilities', 'Project Discovery Calls', 'Pricing Retainers'],
    terminology: [
      { canonical: 'DISCOVERY_CALL', english: 'Discovery Call', kannada: 'ಪ್ರಾಜೆಕ್ಟ್ ಚರ್ಚೆ', kanglish: 'Discovery Call', category: 'SERVICE', mustNotTranslate: true },
    ],
    aiDefaults: {
      roleTitle: 'Agency Inbound Qualifier',
      primaryDialect: 'KANGLISH_BUSINESS',
      speechPace: 1.05,
      greetingKannada: 'ನಮಸ್ಕಾರ, ಡಿಜಿಟಲ್ ಏಜೆನ್ಸಿಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಪ್ರಾಜೆಕ್ಟ್ ಬಗ್ಗೆ ಚರ್ಚಿಸಬೇಕಿತ್ತೇ?',
      greetingKanglish: 'Namaskara sir! Digital agency inquiry follow up maadtha iddini. Discovery call schedule maadona?',
      voiceGender: 'FEMALE',
      voiceSpeakerId: 'meera',
      unknownFallbackPolicy: 'Schedule a discovery call with the agency account director.',
    },
    defaultPolicies: [],
    capabilities: ['Qualify inbound ad leads within 10 seconds', 'Schedule discovery calls on Google Meet / Zoom'],
    guardrails: ['Never quote fixed software contract costs without technical scoping document'],
    sampleFaqs: [],
  },
};

/**
 * Helper to fetch an industry template with fallback to COMMERCIAL_OTHER
 */
export function getIndustryTemplate(industry: string): DetailedIndustryTemplate {
  const normalized = (industry || '').toUpperCase() as IndustryType;
  return INDUSTRY_TEMPLATES[normalized] || INDUSTRY_TEMPLATES.COMMERCIAL_OTHER;
}

/**
 * Returns list of all supported industry templates
 */
export function getAllIndustryTemplates(): DetailedIndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES);
}
