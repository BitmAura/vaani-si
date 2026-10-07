/**
 * @vanni/conversation-engine — Kannada & Kanglish Evaluation Suite (100+ Golden Test Cases)
 *
 * Comprehensive evaluation benchmark across 14 linguistic and domain categories:
 * 1. Basic Greetings (10)
 * 2. Appointments & Scheduling (15)
 * 3. Pricing & Billing (10)
 * 4. Operating Hours & Timings (10)
 * 5. Location & Directions (10)
 * 6. Cancellations & Rescheduling (10)
 * 7. Human Escalation Requests (8)
 * 8. Complaints & Dissatisfaction (7)
 * 9. Code-Switching & Kanglish (10)
 * 10. Pure Romanized Kannada (10)
 * 11. Numbers, Currency, Dates, Times (10)
 * 12. Negations & Short Affirmations (10)
 * 13. Self-Corrections & Repairs (6)
 * 14. Vertical Industry Scenarios (10)
 * Total: 126 Structured Test Cases
 */

import { LanguageEvaluationCase } from '@vanni/shared';

export const KANNADA_GOLDEN_EVALUATION_CASES: LanguageEvaluationCase[] = [
  // ==========================================
  // Category 1: Basic Greetings (1-10)
  // ==========================================
  { id: 'eval_001', category: 'GREETING', input: 'ನಮಸ್ಕಾರ', expectedLanguage: 'KANNADA' },
  { id: 'eval_002', category: 'GREETING', input: 'ನಮಸ್ಕಾರ ಮೇಡಂ', expectedLanguage: 'KANNADA' },
  { id: 'eval_003', category: 'GREETING', input: 'Namaskara sir', expectedLanguage: 'KANGLISH' },
  { id: 'eval_004', category: 'GREETING', input: 'Hello, namaskara!', expectedLanguage: 'KANGLISH' },
  { id: 'eval_005', category: 'GREETING', input: 'Good morning saar', expectedLanguage: 'KANGLISH' },
  { id: 'eval_006', category: 'GREETING', input: 'ಶುಭೋದಯ', expectedLanguage: 'KANNADA' },
  { id: 'eval_007', category: 'GREETING', input: 'Namaskara ri!', expectedLanguage: 'KANGLISH' },
  { id: 'eval_008', category: 'GREETING', input: 'Hi there, how are you?', expectedLanguage: 'ENGLISH' },
  { id: 'eval_009', category: 'GREETING', input: 'Banni, namaskara', expectedLanguage: 'KANNADA' },
  { id: 'eval_010', category: 'GREETING', input: 'Namaskaragalu doctor avare', expectedLanguage: 'KANNADA' },

  // ==========================================
  // Category 2: Appointments & Scheduling (11-25)
  // ==========================================
  { id: 'eval_011', category: 'APPOINTMENT', input: 'ನಾಳೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸಿಗುತ್ತಾ?', expectedLanguage: 'KANNADA', expectedEntities: { date: 'tomorrow' } },
  { id: 'eval_012', category: 'APPOINTMENT', input: 'Naale doctor appointment ideya?', expectedLanguage: 'KANNADA', expectedEntities: { date: 'tomorrow' } },
  { id: 'eval_013', category: 'APPOINTMENT', input: 'Tomorrow doctor available iddara?', expectedLanguage: 'KANGLISH', expectedEntities: { date: 'tomorrow' } },
  { id: 'eval_014', category: 'APPOINTMENT', input: 'Can I book an appointment tomorrow at 10 AM?', expectedLanguage: 'ENGLISH' },
  { id: 'eval_015', category: 'APPOINTMENT', input: 'Nange 5 PM ge appointment beku.', expectedLanguage: 'KANGLISH', expectedEntities: { time: '17:00' } },
  { id: 'eval_016', category: 'APPOINTMENT', input: 'Dr. Ravi avara appointment yavaga sigutte?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_017', category: 'APPOINTMENT', input: 'Ondu consultation slot book madi.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_018', category: 'APPOINTMENT', input: 'ಇವತ್ತು ಸಂಜೆ ಡಾಕ್ಟರ್ ಇರ್ತಾರಾ?', expectedLanguage: 'KANNADA', expectedEntities: { date: 'today' } },
  { id: 'eval_019', category: 'APPOINTMENT', input: 'Ivathu madhyahna slot ideya?', expectedLanguage: 'KANGLISH', expectedEntities: { date: 'today' } },
  { id: 'eval_020', category: 'APPOINTMENT', input: 'Sunday site visit slot book madbahuda?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_021', category: 'APPOINTMENT', input: 'Tomorrow morning 11:30 appointment confirm madi.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_022', category: 'APPOINTMENT', input: 'ನನಗೆ ಡೆಂಟಲ್ ಚೆಕಪ್ ಬೇಕು', expectedLanguage: 'KANNADA' },
  { id: 'eval_023', category: 'APPOINTMENT', input: 'Slot idre helri please.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_024', category: 'APPOINTMENT', input: 'Next Monday opd ideya?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_025', category: 'APPOINTMENT', input: 'Book a dental consultation for tomorrow.', expectedLanguage: 'ENGLISH' },

  // ==========================================
  // Category 3: Pricing & Billing (26-35)
  // ==========================================
  { id: 'eval_026', category: 'PRICING', input: 'Root canal ge eshtu charge?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_027', category: 'PRICING', input: 'ರೂಟ್ ಕೆನಾಲ್ ಚಿಕಿತ್ಸೆಗೆ ಎಷ್ಟು ವೆಚ್ಚವಾಗುತ್ತದೆ?', expectedLanguage: 'KANNADA' },
  { id: 'eval_028', category: 'PRICING', input: 'How much does consultation cost?', expectedLanguage: 'ENGLISH' },
  { id: 'eval_029', category: 'PRICING', input: 'Doctor fee eshtu saar?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_030', category: 'PRICING', input: '₹500 consultation fee ideya?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_031', category: 'PRICING', input: 'Plot price eshtu per square feet?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_032', category: 'PRICING', input: 'Cleaning ge 1500 rs agutta?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_033', category: 'PRICING', input: 'How much agutte total treatment?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_034', category: 'PRICING', input: 'Discount siguththe alva?', expectedLanguage: 'KANNADA' },
  { id: 'eval_035', category: 'PRICING', input: 'Room rent per day eshtu?', expectedLanguage: 'KANGLISH' },

  // ==========================================
  // Category 4: Operating Hours & Timings (36-45)
  // ==========================================
  { id: 'eval_036', category: 'TIMINGS', input: 'Clinic yava time ge open agutte?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_037', category: 'TIMINGS', input: 'ಕ್ಲಿನಿಕ್ ಯಾವ ಸಮಯಕ್ಕೆ ತೆರೆಯುತ್ತದೆ?', expectedLanguage: 'KANNADA' },
  { id: 'eval_038', category: 'TIMINGS', input: 'What time does the hospital open?', expectedLanguage: 'ENGLISH' },
  { id: 'eval_039', category: 'TIMINGS', input: 'Sanje yavag close madtira?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_040', category: 'TIMINGS', input: 'Sunday clinic open irutha?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_041', category: 'TIMINGS', input: 'Morning 9 inda evening 8 vargu open ideya?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_042', category: 'TIMINGS', input: 'Doctor yava time ge irtare?', expectedLanguage: 'KANNADA' },
  { id: 'eval_043', category: 'TIMINGS', input: 'Is the reception open on Saturdays?', expectedLanguage: 'ENGLISH' },
  { id: 'eval_044', category: 'TIMINGS', input: 'Night emergency open ideya?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_045', category: 'TIMINGS', input: 'Lunch break yava time?', expectedLanguage: 'KANGLISH' },

  // ==========================================
  // Category 5: Location & Directions (46-55)
  // ==========================================
  { id: 'eval_046', category: 'LOCATION', input: 'Clinic ellide?', expectedLanguage: 'KANNADA' },
  { id: 'eval_047', category: 'LOCATION', input: 'ಕ್ಲಿನಿಕ್ ಎಲ್ಲಿ ಇದೆ?', expectedLanguage: 'KANNADA' },
  { id: 'eval_048', category: 'LOCATION', input: 'Where is your branch located in Bengaluru?', expectedLanguage: 'ENGLISH' },
  { id: 'eval_049', category: 'LOCATION', input: 'Ballari bypass road alli branch ideya?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_050', category: 'LOCATION', input: 'Location WhatsApp alli send madi.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_051', category: 'LOCATION', input: 'Mysore branch address helri.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_052', category: 'LOCATION', input: 'Near bus stand yav branch ide?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_053', category: 'LOCATION', input: 'Hospital address send madbahuda?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_054', category: 'LOCATION', input: 'Hubli layout elli barutte?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_055', category: 'LOCATION', input: 'Please share the clinic Google map link.', expectedLanguage: 'ENGLISH' },

  // ==========================================
  // Category 6: Cancellations & Rescheduling (56-65)
  // ==========================================
  { id: 'eval_056', category: 'CANCELLATION', input: 'Appointment cancel madi.', expectedLanguage: 'KANGLISH', isNegation: true },
  { id: 'eval_057', category: 'CANCELLATION', input: 'ನನ್ನ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ರದ್ದು ಮಾಡಿ.', expectedLanguage: 'KANNADA' },
  { id: 'eval_058', category: 'CANCELLATION', input: 'Please cancel my appointment for tomorrow.', expectedLanguage: 'ENGLISH', isNegation: true },
  { id: 'eval_059', category: 'RESCHEDULING', input: 'Naale beda, day after tomorrow reschedule madi.', expectedLanguage: 'KANGLISH', isNegation: true },
  { id: 'eval_060', category: 'RESCHEDULING', input: 'Time change madbahuda?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_061', category: 'CANCELLATION', input: 'Ivathina booking cancel madbeku.', expectedLanguage: 'KANGLISH', isNegation: true },
  { id: 'eval_062', category: 'RESCHEDULING', input: 'Can I postpone my site visit to Sunday?', expectedLanguage: 'ENGLISH' },
  { id: 'eval_063', category: 'CANCELLATION', input: 'Treatment beda antha ansthide.', expectedLanguage: 'KANGLISH', isNegation: true },
  { id: 'eval_064', category: 'RESCHEDULING', input: '5 PM beda, 6 PM ge shift madi.', expectedLanguage: 'KANGLISH', isNegation: true },
  { id: 'eval_065', category: 'RESCHEDULING', input: 'ಸಮಯ ಬದಲಾವಣೆ ಮಾಡಿ.', expectedLanguage: 'KANNADA' },

  // ==========================================
  // Category 7: Human Escalation Requests (66-73)
  // ==========================================
  { id: 'eval_066', category: 'HANDOFF', input: 'I want to speak to someone.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_067', category: 'HANDOFF', input: 'Manager ge call connect madi.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_068', category: 'HANDOFF', input: 'Front desk receptionist jothe mathadbeku.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_069', category: 'HANDOFF', input: 'ಡಾಕ್ಟರ್ ಜೊತೆ ನೇರವಾಗಿ ಮಾತನಾಡಬೇಕು.', expectedLanguage: 'KANNADA' },
  { id: 'eval_070', category: 'HANDOFF', input: 'Please transfer this call to a human agent.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_071', category: 'HANDOFF', input: 'Customer care ge connect madi saar.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_072', category: 'HANDOFF', input: 'Speak to a person directly.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_073', category: 'HANDOFF', input: 'Staff jothe mathadakke aagutta?', expectedLanguage: 'KANGLISH' },

  // ==========================================
  // Category 8: Complaints & Dissatisfaction (74-80)
  // ==========================================
  { id: 'eval_074', category: 'COMPLAINT', input: 'Tumba late aytu waiting room alli.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_075', category: 'COMPLAINT', input: 'I am not happy with the service provided.', expectedLanguage: 'ENGLISH', isNegation: true },
  { id: 'eval_076', category: 'COMPLAINT', input: 'Yaru sariyagi respond madtilla.', expectedLanguage: 'KANGLISH', isNegation: true },
  { id: 'eval_077', category: 'COMPLAINT', input: 'Bill tumba jaasti ide.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_078', category: 'COMPLAINT', input: 'ನನಗೆ ತುಂಬಾ ತೊಂದರೆ ಆಗಿದೆ.', expectedLanguage: 'KANNADA' },
  { id: 'eval_079', category: 'COMPLAINT', input: 'Nobody attended to my call yesterday.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_080', category: 'COMPLAINT', input: 'Staff behavior sari illa.', expectedLanguage: 'KANGLISH', isNegation: true },

  // ==========================================
  // Category 9: Code-Switching & Kanglish (81-90)
  // ==========================================
  { id: 'eval_081', category: 'CODE_SWITCH', input: 'Actually tomorrow doctor consultation free ideya?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_082', category: 'CODE_SWITCH', input: 'Root canal treatment ge advance pay madbeka?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_083', category: 'CODE_SWITCH', input: 'Yes, please share the brochure on WhatsApp.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_084', category: 'CODE_SWITCH', input: 'Ivathu call madbahuda athava tomorrow morning better aa?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_085', category: 'CODE_SWITCH', input: 'Price is okay, but location swalpa door ide.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_086', category: 'CODE_SWITCH', input: 'Haudu sir, exactly what I need.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_087', category: 'CODE_SWITCH', input: 'Cab pickup facility available irutha Sunday site visit ge?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_088', category: 'CODE_SWITCH', input: 'Doctor appointment confirm aagideya?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_089', category: 'CODE_SWITCH', input: 'Early check in ge extra charge madthira?', expectedLanguage: 'KANGLISH' },
  { id: 'eval_090', category: 'CODE_SWITCH', input: 'Thank you tumba, have a good day.', expectedLanguage: 'KANGLISH' },

  // ==========================================
  // Category 10: Pure Romanized Kannada (91-100)
  // ==========================================
  { id: 'eval_091', category: 'ROMANIZED_KN', input: 'Naale banni.', expectedLanguage: 'KANNADA' },
  { id: 'eval_092', category: 'ROMANIZED_KN', input: 'Ivathu rathri irtivi.', expectedLanguage: 'KANNADA' },
  { id: 'eval_093', category: 'ROMANIZED_KN', input: 'Yavaga barbeku helri.', expectedLanguage: 'KANNADA' },
  { id: 'eval_094', category: 'ROMANIZED_KN', input: 'Nange gottilla.', expectedLanguage: 'KANNADA' },
  { id: 'eval_095', category: 'ROMANIZED_KN', input: 'Aadare swalpa thadiyiri.', expectedLanguage: 'KANNADA' },
  { id: 'eval_096', category: 'ROMANIZED_KN', input: 'Beda saar.', expectedLanguage: 'KANNADA', isNegation: true },
  { id: 'eval_097', category: 'ROMANIZED_KN', input: 'Haudu ri.', expectedLanguage: 'KANNADA' },
  { id: 'eval_098', category: 'ROMANIZED_KN', input: 'Ellide nimma mane?', expectedLanguage: 'KANNADA' },
  { id: 'eval_099', category: 'ROMANIZED_KN', input: 'Nanna hesaru Ramesh.', expectedLanguage: 'KANNADA' },
  { id: 'eval_100', category: 'ROMANIZED_KN', input: 'Tumba dhanyavada.', expectedLanguage: 'KANNADA' },

  // ==========================================
  // Category 11: Numbers, Currency, Dates, Times (101-110)
  // ==========================================
  { id: 'eval_101', category: 'NUMBERS_DATES', input: '₹1500 charge ideya?', expectedLanguage: 'KANGLISH', expectedEntities: { amount: 1500 } },
  { id: 'eval_102', category: 'NUMBERS_DATES', input: '500 rs pay madtini.', expectedLanguage: 'KANGLISH', expectedEntities: { amount: 500 } },
  { id: 'eval_103', category: 'NUMBERS_DATES', input: 'Sanje 5:30 ge appointment beku.', expectedLanguage: 'KANGLISH', expectedEntities: { time: '17:30' } },
  { id: 'eval_104', category: 'NUMBERS_DATES', input: 'Belagge 10 ge slot nodi.', expectedLanguage: 'KANGLISH', expectedEntities: { time: '10:00' } },
  { id: 'eval_105', category: 'NUMBERS_DATES', input: '5 ge banni.', expectedLanguage: 'KANNADA', isAmbiguous: true },
  { id: 'eval_106', category: 'NUMBERS_DATES', input: 'Tomorrow evening 6 PM.', expectedLanguage: 'ENGLISH', expectedEntities: { time: '18:00' } },
  { id: 'eval_107', category: 'NUMBERS_DATES', input: 'Naale 11 AM ge confirm madi.', expectedLanguage: 'KANGLISH', expectedEntities: { time: '11:00' } },
  { id: 'eval_108', category: 'NUMBERS_DATES', input: '35 lakhs per plot price.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_109', category: 'NUMBERS_DATES', input: 'Day after tomorrow 4 PM.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_110', category: 'NUMBERS_DATES', input: 'Call me on 9845012345.', expectedLanguage: 'ENGLISH' },

  // ==========================================
  // Category 12: Negation & Short Affirmations (111-120)
  // ==========================================
  { id: 'eval_111', category: 'NEGATION_SHORT', input: 'Beda.', expectedLanguage: 'KANNADA', isNegation: true },
  { id: 'eval_112', category: 'NEGATION_SHORT', input: 'No, not required.', expectedLanguage: 'ENGLISH', isNegation: true },
  { id: 'eval_113', category: 'NEGATION_SHORT', input: 'Haudu.', expectedLanguage: 'KANNADA' },
  { id: 'eval_114', category: 'NEGATION_SHORT', input: 'Yes sir.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_115', category: 'NEGATION_SHORT', input: 'Adhe sari.', expectedLanguage: 'KANNADA' },
  { id: 'eval_116', category: 'NEGATION_SHORT', input: 'Sunday beda.', expectedLanguage: 'KANGLISH', isNegation: true },
  { id: 'eval_117', category: 'NEGATION_SHORT', input: 'Doctor Ravi beda, ಬೇರೆ ಡಾಕ್ಟರ್ ಕೊಡಿ.', expectedLanguage: 'KANNADA_ENGLISH', isNegation: true },
  { id: 'eval_118', category: 'NEGATION_SHORT', input: 'Illa pa.', expectedLanguage: 'KANNADA', isNegation: true },
  { id: 'eval_119', category: 'NEGATION_SHORT', input: 'Sure, okay.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_120', category: 'NEGATION_SHORT', input: 'Confirm madi.', expectedLanguage: 'KANGLISH' },

  // ==========================================
  // Category 13: Self-Corrections & Repairs (121-126)
  // ==========================================
  { id: 'eval_121', category: 'SELF_CORRECTION', input: 'Tomorrow... no, sorry, day after tomorrow.', expectedLanguage: 'ENGLISH', expectedEntities: { date: 'day after tomorrow' } },
  { id: 'eval_122', category: 'SELF_CORRECTION', input: '5 PM... alla, 6 PM.', expectedLanguage: 'KANGLISH', expectedEntities: { time: '18:00' } },
  { id: 'eval_123', category: 'SELF_CORRECTION', input: 'Dr. Ravi... beda, Dr. Suresh.', expectedLanguage: 'KANGLISH' },
  { id: 'eval_124', category: 'SELF_CORRECTION', input: 'Dental cleaning... sorry, root canal treatment.', expectedLanguage: 'ENGLISH' },
  { id: 'eval_125', category: 'SELF_CORRECTION', input: 'Ivathu... alla, naale sanje.', expectedLanguage: 'KANNADA' },
  { id: 'eval_126', category: 'SELF_CORRECTION', input: 'Site visit for 2 people... no, 4 people.', expectedLanguage: 'ENGLISH' },
];
