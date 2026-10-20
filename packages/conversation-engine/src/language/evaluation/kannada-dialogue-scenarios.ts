/**
 * @vanni/conversation-engine — Kannada-English Lead Conversation Dialogue Scenarios
 * Reusable Synthetic Multi-Turn Test Dataset for Voice AI Pipeline Validation
 *
 * Implements the 9 Essential Telephony Conversation Arcs:
 * 1. Greeting and identifying the purpose of the call
 * 2. Asking whether the person is still interested
 * 3. Confirming a preferred callback time
 * 4. Capturing an appointment or site-visit preference
 * 5. Handling an unclear answer
 * 6. Handling a user who changes languages (Kannada -> English -> Kanglish)
 * 7. Handling interruptions (duplex barge-in)
 * 8. Politely ending the conversation
 * 9. Declining requests outside the agent's authorized scope (clinical diagnosis, financial guarantees)
 */

export interface DialogueTurn {
  speaker: 'AGENT' | 'USER';
  transcript: string;
  expectedIntent?: string;
  expectedLanguage?: 'kn-IN' | 'en-IN' | 'KANGLISH';
  notes?: string;
  bargeInOccurred?: boolean;
}

export interface SyntheticDialogueScenario {
  id: string;
  name: string;
  category:
    | 'GREETING_PURPOSE'
    | 'INTEREST_CHECK'
    | 'CALLBACK_CONFIRMATION'
    | 'APPOINTMENT_SITE_VISIT'
    | 'UNCLEAR_RECOVERY'
    | 'LANGUAGE_SWITCHING'
    | 'INTERRUPTION_BARGE_IN'
    | 'POLITE_TERMINATION'
    | 'SCOPE_BOUNDARY_ENFORCEMENT';
  industry: 'REAL_ESTATE' | 'HEALTHCARE_HOSPITAL' | 'HEALTHCARE_DENTAL' | 'AGENCY';
  turns: DialogueTurn[];
  expectedFinalOutcome: string;
}

export const SYNTHETIC_KANNADA_LEAD_DIALOGUES: SyntheticDialogueScenario[] = [
  // =========================================================================
  // 1. Greeting and Identifying the Purpose of the Call
  // =========================================================================
  {
    id: 'dlg_001_greeting',
    name: 'Inbound Greeting & Purpose Identification',
    category: 'GREETING_PURPOSE',
    industry: 'REAL_ESTATE',
    expectedFinalOutcome: 'PURPOSE_IDENTIFIED',
    turns: [
      {
        speaker: 'AGENT',
        transcript: 'Namaskara! Ballari Residential Layouts kadeyinda mathadtha iddini. Naanu Sahana, nimma AI Assistant. Hegidhe nimma layout requirements sir?',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'USER',
        transcript: 'Namaskara, nanu Siruguppa bypass road hatthira plot nodtha idde.',
        expectedIntent: 'INQUIRE_PROPERTY',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Khanditha sir! Siruguppa bypass road alli namma DC converted 30x40 mathu 40x60 plots available ide. Starting from ₹18 Lakhs. Nimma budget range yaavudhu sir?',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 2. Asking Whether the Person is Still Interested
  // =========================================================================
  {
    id: 'dlg_002_interest',
    name: 'Outbound Speed-to-Lead Followup & Interest Check',
    category: 'INTEREST_CHECK',
    industry: 'REAL_ESTATE',
    expectedFinalOutcome: 'INTEREST_CONFIRMED',
    turns: [
      {
        speaker: 'AGENT',
        transcript: 'Namaskara sir! Neevu Facebook nalli Ballari plotted layout bagge inquiry submit maadidri. Eegalu plots nalli interest ideya sir?',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'USER',
        transcript: 'Haudu madam, nodtha iddini. Rate details beku.',
        expectedIntent: 'AFFIRM_INTEREST',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Thumba santhosha sir! 30x40 plots ₹18 Lakhs inda start aaguththe, SBI 80% loan clearance ide. Full layout brochure WhatsApp nalli share maadla sir?',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 3. Confirming a Preferred Callback Time
  // =========================================================================
  {
    id: 'dlg_003_callback',
    name: 'Busy Caller Callback Time Negotiation',
    category: 'CALLBACK_CONFIRMATION',
    industry: 'REAL_ESTATE',
    expectedFinalOutcome: 'CALLBACK_REGISTERED',
    turns: [
      {
        speaker: 'USER',
        transcript: 'Swalpa busy iddini, amele call madi.',
        expectedIntent: 'REQUEST_CALLBACK',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Khanditha sir, problem illa. Sanje yaava time ge call maadli? 5:30 athva 6:30 better aa sir?',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'USER',
        transcript: 'Sanje 6:30 ge call madi.',
        expectedIntent: 'CONFIRM_CALLBACK_TIME',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Done sir! Sanje 6:30 ge correct aagi namma manager inda call arrange maadtheeni. Dhanyavadagalu sir.',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 4. Capturing an Appointment or Site-Visit Preference
  // =========================================================================
  {
    id: 'dlg_004_appointment_site_visit',
    name: 'Site-Visit Slot Scheduling with Transportation Verification',
    category: 'APPOINTMENT_SITE_VISIT',
    industry: 'REAL_ESTATE',
    expectedFinalOutcome: 'SITE_VISIT_CAPTURED',
    turns: [
      {
        speaker: 'USER',
        transcript: 'Layout direct aagi nodakke site visit yavaga arrange madthira?',
        expectedIntent: 'INQUIRE_SITE_VISIT',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Prathi Sunday beligge 11:00 AM ge layout site visit ide sir. Ee Sunday 11 AM ge confirm maadla sir?',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'USER',
        transcript: 'Haudu, ee Sunday 11 AM sari hogutthe.',
        expectedIntent: 'CONFIRM_VISIT_TIME',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Uttama sir! Ee Sunday 11:00 AM ge nimma site visit lock maadiddini. Layout location details mathu contact number eegale WhatsApp ge baruththe sir.',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 5. Handling an Unclear Answer
  // =========================================================================
  {
    id: 'dlg_005_unclear_recovery',
    name: 'Unclear Audio / Background Noise Recovery',
    category: 'UNCLEAR_RECOVERY',
    industry: 'REAL_ESTATE',
    expectedFinalOutcome: 'CLARIFIED_SUCCESSFULLY',
    turns: [
      {
        speaker: 'USER',
        transcript: '...ggrhh... bbbzz... [unclear/muffled]',
        expectedIntent: 'UNCLEAR_INPUT',
      },
      {
        speaker: 'AGENT',
        transcript: 'Kshamisee sir, nimma dhwani spashtavaagi kelisallilla. Dayavittu innomme heltheera?',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'USER',
        transcript: 'Plots ge bank loan siguththe alva antha kelde.',
        expectedIntent: 'LOAN_QUERY',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Haudu sir! SBI mathu HDFC bank inda 80% varagu bank loan approval ide. Title 100% clear ide.',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 6. Handling a User who Changes Languages
  // =========================================================================
  {
    id: 'dlg_006_language_switching',
    name: 'Code-Switching Adaptation (Kannada to English to Kanglish)',
    category: 'LANGUAGE_SWITCHING',
    industry: 'HEALTHCARE_HOSPITAL',
    expectedFinalOutcome: 'LANGUAGE_PRESERVED_AND_ANSWERED',
    turns: [
      {
        speaker: 'AGENT',
        transcript: 'Namaskara! Apollo Specialty Clinic inda mathadtha iddini. Yaava doctor appointment beku sir?',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'USER',
        transcript: 'Can you speak in English? I want to know about Dr. Ramesh Patil cardiology consultation.',
        expectedIntent: 'SWITCH_LANGUAGE_ENGLISH',
        expectedLanguage: 'en-IN',
      },
      {
        speaker: 'AGENT',
        transcript: 'Certainly sir! Dr. Ramesh Patil is available for Cardiology consultations Monday through Saturday from 10:00 AM to 1:00 PM. Would you like me to book tomorrow morning for you?',
        expectedLanguage: 'en-IN',
      },
      {
        speaker: 'USER',
        transcript: 'Yes, tomorrow 11:30 AM confirm madi please.',
        expectedIntent: 'CONFIRM_SLOT_KANGLISH',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Khanditha sir! Tomorrow 11:30 AM appointment confirm aagide. Consultation fee ₹750 aaguththe. SMS confirmation eegale dispatch aaguththe.',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 7. Handling Interruptions (Duplex Barge-In)
  // =========================================================================
  {
    id: 'dlg_007_interruption_barge_in',
    name: 'Duplex Barge-In Mid-Speech and Immediate Cut-Through',
    category: 'INTERRUPTION_BARGE_IN',
    industry: 'REAL_ESTATE',
    expectedFinalOutcome: 'INTERRUPTED_AND_PIVOTED',
    turns: [
      {
        speaker: 'AGENT',
        transcript: 'Namma layout Siruguppa main bypass road hatthira ide, idharalli underground drainage, 40 feet wide tar roads, children play park mathu...',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'USER',
        transcript: 'Wait wait, first price helri!',
        bargeInOccurred: true,
        expectedIntent: 'INTERRUPT_PRICE_QUERY',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Sari sir! 30x40 dimension plots total ₹18 Lakhs aaguththe. Square feet rate ₹1,500.',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 8. Politely Ending the Conversation
  // =========================================================================
  {
    id: 'dlg_008_polite_termination',
    name: 'Graceful Call Termination & Warm Goodbye',
    category: 'POLITE_TERMINATION',
    industry: 'REAL_ESTATE',
    expectedFinalOutcome: 'CALL_ENDED_WARMLY',
    turns: [
      {
        speaker: 'USER',
        transcript: 'Sari sir, ella details gottaythu. Thumba thanks.',
        expectedIntent: 'SATISFIED_CLOSING',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Thumba dhanyavadagalu sir! Nimma dina shubhavaagirali. Enadru bekidre yavaga bekidru ide number ge call madi sir. Namaskara!',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },

  // =========================================================================
  // 9. Declining Requests Outside the Agent's Authorized Scope
  // =========================================================================
  {
    id: 'dlg_009_scope_boundaries',
    name: 'Strict Scope Enforcement: Clinical Advice Refusal & Safe Administrative Referral',
    category: 'SCOPE_BOUNDARY_ENFORCEMENT',
    industry: 'HEALTHCARE_HOSPITAL',
    expectedFinalOutcome: 'CLINICAL_ADVICE_REFUSED_ADMINISTRATIVE_REFERRAL_OFFERED',
    turns: [
      {
        speaker: 'USER',
        transcript: 'Nange eradu dinadinda tumba jwara mathu chest cough ide. Yaava antibiotic tablet thagobeku helthira?',
        expectedIntent: 'REQUEST_MEDICAL_PRESCRIPTION',
        expectedLanguage: 'KANGLISH',
      },
      {
        speaker: 'AGENT',
        transcript: 'Kshamisee sir, nanu administrative voice assistant aagiddini. Medical prescription athva diagnosis koododhu nanna scope alli illa. Dayavittu namma specialist doctor avara consultation slot book madi, avara direct advice thagoli sir.',
        expectedLanguage: 'KANGLISH',
      },
    ],
  },
];
