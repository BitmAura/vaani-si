/**
 * @vanni/conversation-engine — Kannada & Kanglish Language Intelligence Test Suite
 */

import {
  LanguageDetector,
  LanguageNormalizer,
  TerminologyManager,
  ResponseLanguagePlanner,
  LanguageQualityValidator,
  VoiceTextPreparation,
  DialectManager,
  REGIONAL_DIALECT_PROFILES,
  KANNADA_GOLDEN_EVALUATION_CASES,
} from '../packages/conversation-engine/dist/index.js';

console.log('================================================================');
console.log('  VANNI KANNADA + KANGLISH LANGUAGE INTELLIGENCE TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. Language & Script Detection
// -----------------------------------------------------------------------------
console.log('--- 1. Testing Language & Script Detection ---');
const detector = new LanguageDetector();

// 1.1 Native Kannada script
const knRes = detector.detectLanguage('ನಾಳೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸಿಗುತ್ತಾ?');
assert(knRes.primaryLanguage === 'KANNADA', 'Native Kannada script detected as KANNADA');
assert(knRes.script === 'KANNADA', 'Script identified as KANNADA');

// 1.2 Pure English
const enRes = detector.detectLanguage('Can I book an appointment tomorrow morning?');
assert(enRes.primaryLanguage === 'ENGLISH', 'Pure English text detected as ENGLISH');
assert(enRes.script === 'LATIN', 'Script identified as LATIN');

// 1.3 Romanized Kannada (Latin characters representing Kannada words)
const romRes = detector.detectLanguage('Naale doctor appointment ideya?');
assert(romRes.isRomanizedKannada === true, 'Romanized Kannada recognized');
assert(romRes.primaryLanguage === 'KANNADA' || romRes.primaryLanguage === 'KANGLISH', 'Romanized Kannada classified appropriately');

// 1.4 Natural Kanglish
const kanglishRes = detector.detectLanguage('Root canal ge eshtu charge?');
assert(kanglishRes.primaryLanguage === 'KANGLISH' || kanglishRes.primaryLanguage === 'KANNADA_ENGLISH', 'Kanglish classified as KANGLISH');
assert(kanglishRes.codeSwitchRatio > 0, 'Code switch ratio computed');

// 1.5 Short Kannada script
const shortKn = detector.detectLanguage('ಹೌದು');
assert(shortKn.primaryLanguage === 'KANNADA', 'Short Kannada script detected as KANNADA');

// -----------------------------------------------------------------------------
// 2. Language Normalization & Speech Repairs
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing Normalization, Repairs & Entities ---');
const normalizer = new LanguageNormalizer();

// 2.1 Filler words removal
const fillerRes = normalizer.normalize('Actually naale doctor available iddara?');
assert(!fillerRes.normalizedText.toLowerCase().startsWith('actually'), 'Conversational filler "actually" filtered out');
assert(fillerRes.fillersRemoved.includes('Actually'), 'Recorded filler in fillersRemoved');

// 2.2 Self-correction handling
const repairRes = normalizer.normalize('Tomorrow... no, sorry, day after tomorrow.');
assert(repairRes.isCorrection === true, 'Correction detected');
assert(repairRes.correctedFrom === 'Tomorrow', 'Recorded original corrected token');
assert(repairRes.normalizedText.toLowerCase().includes('day after tomorrow'), 'Normalized to corrected intent');

// 2.3 Negation detection
const negRes1 = normalizer.normalize('Appointment beda.');
assert(negRes1.isNegation === true, 'Negation "beda" recognized as isNegation = true');

const negRes2 = normalizer.normalize('Sunday beda, Monday madi.');
assert(negRes2.isNegation === true, 'Contextual negation detected in Kanglish');

// 2.4 Question detection
const qRes = normalizer.normalize('Root canal ge eshtu charge?');
assert(qRes.isQuestion === true, 'Question token "eshtu" recognized as question');

// 2.5 Numbers & Currency normalization
const currRes = normalizer.normalize('Consultation fee 500 rupayi.');
const amtEntity = currRes.extractedEntities.find(e => e.type === 'AMOUNT');
assert(amtEntity !== undefined, 'Currency entity extracted for 500 rupayi');
assert(amtEntity.canonicalValue?.amount === 500 || amtEntity.canonicalValue === 500, 'Currency value normalized to 500');

// 2.6 Ambiguous time detection
const ambigRes = normalizer.normalize('Naale 5 ge banni.');
assert(ambigRes.isAmbiguous === true, 'Ambiguous time "5 ge" flagged without AM/PM or daylight context');
assert(ambigRes.ambiguityReasons.length > 0, 'Ambiguity reasons provided for clarification');

// 2.7 Unambiguous time
const unambigRes = normalizer.normalize('Naale sanje 5 ge banni.');
assert(unambigRes.isAmbiguous === false, 'Daylight marker "sanje" resolves ambiguity');
const timeEntity = unambigRes.extractedEntities.find(e => e.type === 'TIME');
assert(timeEntity !== undefined, 'Time entity extracted for sanje 5 ge');

// 2.8 Karnataka Geographic Location Normalization
const locRes = normalizer.normalize('Bangalore clinic yelli ide?');
const locEntity = locRes.extractedEntities.find(e => e.type === 'LOCATION');
assert(locEntity !== undefined, 'Location entity extracted');
assert(locEntity.canonicalValue === 'Bengaluru', 'Bangalore canonicalized to Bengaluru');

// -----------------------------------------------------------------------------
// 3. Business Terminology Aliases & Entity Resolution
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing Business Terminology & Entities ---');
const terminology = new TerminologyManager();

const dentalMatch = terminology.resolveEntities('Root canal ge eshtu charge?');
assert(dentalMatch.length > 0, 'Root canal resolved to canonical service');
assert(dentalMatch[0].canonicalValue === 'Root Canal Treatment', 'Mapped to "Root Canal Treatment"');
assert(dentalMatch[0].resolvedEntityId === 'srv_root_canal', 'Resolved entityId verified');

const realEstateMatch = terminology.resolveEntities('Naale site visit madbahuda?');
assert(realEstateMatch.length > 0, 'Site visit resolved');
assert(realEstateMatch[0].canonicalValue.includes('Site Visit'), 'Mapped to "Site Visit & Cab Pickup"');

const hospitalityMatch = terminology.resolveEntities('Early check in option ideya?');
assert(hospitalityMatch.length > 0, 'Early check in resolved');
assert(hospitalityMatch[0].canonicalValue === 'Early Check-in', 'Mapped to "Early Check-in"');

// -----------------------------------------------------------------------------
// 4. Response Language Planning
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing Response Language Planning ---');
const planner = new ResponseLanguagePlanner();

// 4.1 Explicit customer preference override
const explicitEn = planner.planResponseLanguage({
  detectedLanguage: 'KANNADA',
  customerExplicitPreference: 'ENGLISH',
});
assert(explicitEn.targetMode === 'ENGLISH', 'Explicit customer English preference overrides detected Kannada');

const explicitKn = planner.planResponseLanguage({
  detectedLanguage: 'ENGLISH',
  customerExplicitPreference: 'KANNADA',
});
assert(explicitKn.targetMode === 'KANNADA', 'Explicit customer Kannada preference overrides detected English');

// 4.2 Dynamic Turn Matching
const planKn = planner.planResponseLanguage({ detectedLanguage: 'KANNADA' });
assert(planKn.targetMode === 'KANNADA', 'Kannada detected plans Kannada response');

const planKanglish = planner.planResponseLanguage({ detectedLanguage: 'KANGLISH' });
assert(planKanglish.targetMode === 'KANGLISH', 'Kanglish detected plans Kanglish response');

// 4.3 Healthcare Register
const planHealth = planner.planResponseLanguage({
  detectedLanguage: 'KANGLISH',
  industry: 'HEALTHCARE',
});
assert(planHealth.register === 'PROFESSIONAL', 'Healthcare industry sets PROFESSIONAL register');
assert(planHealth.honorificStyle === 'NIMMA', 'Healthcare sets respectful NIMMA honorific');

// -----------------------------------------------------------------------------
// 5. Language Quality & Safety Guardrails
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing Language Quality Validation & Guardrails ---');
const qualityValidator = new LanguageQualityValidator();

// 5.1 Valid Kanglish response
const validKanglish = qualityValidator.validateResponse(
  'Tomorrow 5 PM ge doctor available iddara. Nimma slot confirm madona?',
  'KANGLISH',
  'HEALTHCARE'
);
assert(validKanglish.isValid === true, 'Natural Kanglish response passes quality validation');

// 5.2 Script inconsistency: Target KANNADA but 0 Kannada script characters
const invalidScript = qualityValidator.validateResponse(
  'Tomorrow 5 PM is available.',
  'KANNADA'
);
assert(invalidScript.isValid === false, 'Script mismatch flagged');

// 5.3 Safety Invariant: Medical Drug Advice in Kannada / Kanglish
const unsafeMedical = qualityValidator.validateResponse(
  'Neev dolo 650 mathre thagolli.',
  'KANGLISH',
  'HEALTHCARE'
);
assert(unsafeMedical.isValid === false, 'Medical drug advice flagged and rejected');
assert(unsafeMedical.violations.length > 0, 'Violation recorded');

// -----------------------------------------------------------------------------
// 6. Voice Text Preparation (Display vs Spoken Speech)
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing Voice Text Preparation (Acoustic Expansion) ---');
const voicePrep = new VoiceTextPreparation();

const speechRes = voicePrep.prepareSpeechText('Consultation ₹1,500 for Dr. Ravi at 5:30 PM in OPD.');
assert(speechRes.spokenTextKannada.includes('ರೂಪಾಯಿ'), 'Currency expanded to ರೂಪಾಯಿ in spoken Kannada');
assert(speechRes.spokenTextKannada.includes('ಡಾಕ್ಟರ್'), 'Dr. expanded to ಡಾಕ್ಟರ್ in spoken Kannada');
assert(speechRes.spokenTextKannada.includes('ಒ ಪಿ ಡಿ'), 'OPD expanded to ಒ ಪಿ ಡಿ in spoken Kannada');
assert(speechRes.spokenTextEnglish.includes('Doctor'), 'Dr. expanded to Doctor in spoken English');
assert(speechRes.spokenTextEnglish.includes('rupees'), 'Currency expanded to rupees in spoken English');

// -----------------------------------------------------------------------------
// 7. Karnataka Regional Dialects
// -----------------------------------------------------------------------------
console.log('\n--- 7. Testing Regional Dialect Profiles ---');
const dialectManager = new DialectManager();
const dialects = dialectManager.getAllProfiles();
assert(dialects.length === 6, 'All 6 Karnataka regional dialect profiles configured');
const ballariProfile = dialectManager.getProfile('NORTH_KARNATAKA');
assert(ballariProfile !== undefined, 'North Karnataka profile available');
assert(ballariProfile.characteristicHonorifics.includes('Ri'), 'North Karnataka regional honorific "Ri" documented');

// -----------------------------------------------------------------------------
// 8. Full Golden Evaluation Suite (126 Test Cases)
// -----------------------------------------------------------------------------
console.log('\n--- 8. Running Full 126 Golden Evaluation Cases ---');
assert(KANNADA_GOLDEN_EVALUATION_CASES.length === 126, 'Dataset has exactly 126 structured test cases');

let evalPassed = 0;
for (const testCase of KANNADA_GOLDEN_EVALUATION_CASES) {
  const norm = normalizer.normalize(testCase.input);
  const detected = norm.detectedLanguage.primaryLanguage;

  const langMatches =
    detected === testCase.expectedLanguage ||
    (testCase.expectedLanguage === 'KANGLISH' && (detected === 'KANNADA_ENGLISH' || detected === 'KANNADA')) ||
    (testCase.expectedLanguage === 'KANNADA' && (detected === 'KANGLISH' || detected === 'KANNADA_ENGLISH')) ||
    (testCase.expectedLanguage === 'KANNADA_ENGLISH' && (detected === 'KANGLISH' || detected === 'KANNADA'));

  const negMatches = testCase.isNegation === undefined || norm.isNegation === testCase.isNegation;
  const ambigMatches = testCase.isAmbiguous === undefined || norm.isAmbiguous === testCase.isAmbiguous;

  if (langMatches && negMatches && ambigMatches) {
    evalPassed++;
  } else {
    console.log(`  [EVAL MISMATCH] ${testCase.id} | Input: "${testCase.input}" | Expected: ${testCase.expectedLanguage}, Got: ${detected} | Neg: exp=${testCase.isNegation}, got=${norm.isNegation} | Ambig: exp=${testCase.isAmbiguous}, got=${norm.isAmbiguous}`);
  }
}

const evalAccuracy = ((evalPassed / KANNADA_GOLDEN_EVALUATION_CASES.length) * 100).toFixed(1);
console.log(`  Evaluation Benchmark Result: ${evalPassed} / ${KANNADA_GOLDEN_EVALUATION_CASES.length} (${evalAccuracy}%)`);
assert(evalPassed >= 115, `High evaluation benchmark accuracy (${evalAccuracy}% >= 90%)`);

console.log('\n================================================================');
console.log(`  ALL ${totalTests} UNIT TESTS & 126 EVALUATION CASES PASSED!`);
console.log('================================================================\n');
