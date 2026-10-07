/**
 * @vanni/server — Kannada & Kanglish Language Intelligence HTTP API Test Suite
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000';

console.log('================================================================');
console.log('  VANNI KANNADA + KANGLISH LANGUAGE API INTEGRATION TESTS');
console.log(`  Target: ${BASE_URL}`);
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

async function run() {
  // 1. Test POST /api/language/preview with Romanized Kannada
  console.log('--- 1. Testing POST /api/language/preview ---');
  const resRom = await fetch(`${BASE_URL}/api/language/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Naale doctor appointment ideya?',
    }),
  });
  const dataRom = await resRom.json();
  assert(resRom.status === 200 && dataRom.success === true, 'Preview API returned 200 OK');
  assert(dataRom.preview.detectedLanguage.primaryLanguage === 'KANNADA', 'Romanized Kannada recognized as KANNADA');
  assert(dataRom.preview.detectedLanguage.isRomanizedKannada === true, 'isRomanizedKannada flag is true');
  assert(dataRom.preview.languagePlan.targetMode === 'KANNADA', 'Language plan targetMode is KANNADA');

  // 1.2 Native Kannada Script
  const resKn = await fetch(`${BASE_URL}/api/language/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'ನಾಳೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸಿಗುತ್ತಾ?',
    }),
  });
  const dataKn = await resKn.json();
  assert(dataKn.preview.detectedLanguage.script === 'KANNADA', 'Native script detected as KANNADA');
  assert(dataKn.preview.detectedLanguage.primaryLanguage === 'KANNADA', 'Native language is KANNADA');

  // 1.3 Natural Kanglish & Business Terminology
  const resKanglish = await fetch(`${BASE_URL}/api/language/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Root canal ge eshtu charge?',
    }),
  });
  const dataKanglish = await resKanglish.json();
  assert(dataKanglish.preview.detectedLanguage.primaryLanguage === 'KANGLISH', 'Kanglish detected as KANGLISH');
  assert(dataKanglish.preview.isQuestion === true, 'Question token recognized');
  const srvEntity = dataKanglish.preview.extractedEntities.find(e => e.resolvedEntityId === 'srv_root_canal');
  assert(srvEntity !== undefined, 'Business terminology mapped to canonical srv_root_canal');
  assert(srvEntity.canonicalValue === 'Root Canal Treatment', 'Mapped canonicalValue is "Root Canal Treatment"');

  // 1.4 Self-Correction Detection
  const resRepair = await fetch(`${BASE_URL}/api/language/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Tomorrow... no, sorry, day after tomorrow.',
    }),
  });
  const dataRepair = await resRepair.json();
  assert(dataRepair.preview.isCorrection === true, 'Self-correction detected');
  assert(dataRepair.preview.correctedFrom === 'Tomorrow', 'Corrected from "Tomorrow" recorded');

  // 1.5 Ambiguity Detection
  const resAmbig = await fetch(`${BASE_URL}/api/language/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Naale 5 ge banni.',
    }),
  });
  const dataAmbig = await resAmbig.json();
  assert(dataAmbig.preview.isAmbiguous === true, 'Ambiguous time "5 ge" detected');
  assert(dataAmbig.preview.ambiguityReasons.length > 0, 'Ambiguity clarification explanation provided');

  // 1.6 Acoustic Spoken Text Expansion
  const resVoice = await fetch(`${BASE_URL}/api/language/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Consultation fee ₹1,500 for Dr. Ravi at 5:30 PM in OPD.',
    }),
  });
  const dataVoice = await resVoice.json();
  assert(dataVoice.preview.spokenText.spokenTextKannada.includes('ರೂಪಾಯಿ'), 'Spoken text expanded currency to ರೂಪಾಯಿ');
  assert(dataVoice.preview.spokenText.spokenTextKannada.includes('ಡಾಕ್ಟರ್'), 'Spoken text expanded Dr. to ಡಾಕ್ಟರ್');

  // 2. Test GET /api/language/dialects
  console.log('\n--- 2. Testing GET /api/language/dialects ---');
  const resDialects = await fetch(`${BASE_URL}/api/language/dialects`);
  const dataDialects = await resDialects.json();
  assert(resDialects.status === 200 && dataDialects.success === true, 'Dialects API returned 200 OK');
  assert(dataDialects.dialects.NORTH_KARNATAKA !== undefined, 'North Karnataka profile returned');
  assert(dataDialects.dialects.BENGALURU !== undefined, 'Bengaluru profile returned');
  assert(dataDialects.dialects.MYSURU !== undefined, 'Mysuru profile returned');
  assert(dataDialects.dialects.COASTAL_KARNATAKA !== undefined, 'Coastal Karnataka profile returned');

  // 3. Test GET /api/language/evaluation
  console.log('\n--- 3. Testing GET /api/language/evaluation ---');
  const resEval = await fetch(`${BASE_URL}/api/language/evaluation`);
  const dataEval = await resEval.json();
  assert(resEval.status === 200 && dataEval.success === true, 'Evaluation dataset API returned 200 OK');
  assert(dataEval.stats.totalCases === 126, 'Dataset contains exactly 126 structured test cases');
  assert(dataEval.testCases.length === 126, 'All 126 test cases provided');

  // 4. Test POST /api/language/evaluation/run
  console.log('\n--- 4. Testing POST /api/language/evaluation/run ---');
  const resRun = await fetch(`${BASE_URL}/api/language/evaluation/run`, {
    method: 'POST',
  });
  const dataRun = await resRun.json();
  assert(resRun.status === 200 && dataRun.success === true, 'Evaluation run API returned 200 OK');
  console.log(`  Remote Evaluation Accuracy: ${dataRun.summary.passed} / ${dataRun.summary.total} (${dataRun.summary.accuracyPercent}%)`);
  assert(dataRun.summary.accuracyPercent >= 95, 'Golden evaluation accuracy >= 95%');

  // 5. Test End-to-End Conversation Turn with Language Intelligence
  console.log('\n--- 5. Testing End-to-End Conversation with Language Intelligence ---');
  // First start a conversation
  const startRes = await fetch(`${BASE_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'emp-org1-1',
      channel: 'WEB_CHAT',
    }),
  });
  const startData = await startRes.json();
  assert(startRes.status === 201 && startData.success === true, 'Started conversation session');
  const convId = startData.conversation.id;

  // Process a Kanglish message
  const msgRes = await fetch(`${BASE_URL}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Naale doctor appointment ideya?',
    }),
  });
  const msgData = await msgRes.json();
  assert(msgRes.status === 200 && msgData.success === true, 'Processed customer turn');
  assert(msgData.turn.languagePlan !== undefined, 'Turn DTO includes languagePlan');
  assert(msgData.turn.normalizedUtterance !== undefined, 'Turn DTO includes normalizedUtterance');
  assert(msgData.turn.normalizedUtterance.detectedLanguage.primaryLanguage === 'KANNADA', 'Turn detected language is KANNADA');

  console.log('\n================================================================');
  console.log(`  ALL ${totalTests} HTTP API INTEGRATION TESTS PASSED!`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('\nAPI Test Failed:', err);
  process.exit(1);
});
