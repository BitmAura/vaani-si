// scratch/e2e-senior-test.mjs
import http from 'node:http';

const API_BASE = 'http://localhost:4100';
const WEB_BASE = 'http://localhost:3000';
const GATEWAY_BASE = 'http://localhost:4200';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          let parsed = body;
          try {
            parsed = JSON.parse(body);
          } catch (_) {}
          resolve({ status: res.statusCode, data: parsed, raw: body });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

const results = [];
function log(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} ${testName} ${details ? '- ' + details : ''}`);
}

async function run() {
  console.log('================================================================');
  console.log('🛡️  VANNI PLATFORM — SENIOR ENGINEER END-TO-END AUDIT SUITE');
  console.log('================================================================\n');

  // 1. INFRASTRUCTURE & HEALTH
  console.log('--- 1. Infrastructure Health & Routing ---');
  try {
    const r1 = await request(`${API_BASE}/api/health`);
    log('API Server /api/health', r1.status === 200, `HTTP ${r1.status}`);
  } catch (e) {
    log('API Server /api/health', false, e.message);
  }

  try {
    const r2 = await request(`${GATEWAY_BASE}/api/telephony/phone-numbers`);
    const count = r2.data?.phoneNumbers?.length || 0;
    log('Gateway /api/telephony/phone-numbers', r2.status === 200, `HTTP ${r2.status}, ${count} numbers provisioned`);
  } catch (e) {
    log('Gateway Telephony', false, e.message);
  }

  try {
    const r3 = await request(`${WEB_BASE}/console`);
    log('Frontend Console Page /console', r3.status === 200, `HTTP ${r3.status}, Length: ${r3.raw.length} bytes`);
  } catch (e) {
    log('Frontend Console', false, e.message);
  }

  // 2. AUTHENTICATION & MULTI-TENANT LIFECYCLE (SIGNUP -> LOGIN -> SESSION)
  console.log('\n--- 2. Real User Onboarding & Authentication Lifecycle ---');
  const testEmail = `operator_${Date.now()}@karnatakarealty.in`;
  const testPassword = 'Password#2026Secure!';
  let sessionToken = '';
  try {
    // A. Sign up a real new organization
    const rSignup = await request(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Pradeep Kumar',
        email: testEmail,
        password: testPassword,
        organizationName: 'Kaveri Layouts & Developers',
        industry: 'REAL_ESTATE',
      }),
    });
    log('Self-Serve Signup (POST /api/auth/signup)', rSignup.status === 201 || rSignup.status === 200, `Org created: Kaveri Layouts & Developers, User: ${testEmail}`);

    // B. Login with newly created user
    const rLogin = await request(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    sessionToken = rLogin.data?.token || rLogin.data?.session?.token || '';
    log('User Login (POST /api/auth/login)', rLogin.status === 200 && Boolean(sessionToken), `Session Token issued: ${sessionToken.substring(0, 24)}...`);

    // C. Verify active session endpoint
    const rSession = await request(`${API_BASE}/api/auth/session`, {
      headers: { 'x-session-token': sessionToken },
    });
    log('Session Verification (GET /api/auth/session)', rSession.status === 200, `Active Org: ${rSession.data?.session?.organizationName || rSession.data?.session?.activeOrganizationId}`);
  } catch (e) {
    log('Authentication & Multi-Tenant Lifecycle', false, e.message);
  }

  // 3. CLEAN STATE AUDIT (NO TEST / MOCK DATA)
  console.log('\n--- 3. Clean Slate Audit (Zero Demo / Test Data) ---');
  try {
    const rSources = await request(`${API_BASE}/api/knowledge/sources`, {
      headers: { 'x-session-token': sessionToken },
    });
    const sCount = rSources.data?.sources?.length ?? 0;
    log('Knowledge Sources Clean State', sCount === 0, `${sCount} sources found (0 expected)`);

    const rContacts = await request(`${API_BASE}/api/crm/contacts`);
    const cCount = rContacts.data?.contacts?.length ?? 0;
    log('CRM Contacts Clean State', cCount === 0, `${cCount} contacts found (0 expected)`);

    const rCalls = await request(`${API_BASE}/api/calls`, {
      headers: { 'x-session-token': sessionToken },
    });
    const callCount = rCalls.data?.calls?.length ?? 0;
    log('Call Detail Records Clean State', callCount === 0, `${callCount} calls found (0 expected)`);

    const rLeads = await request(`${API_BASE}/api/leads`, {
      headers: { 'x-session-token': sessionToken },
    });
    const leadCount = rLeads.data?.leads?.length ?? 0;
    log('Leads Pipeline Clean State', leadCount === 0, `${leadCount} leads found (0 expected)`);
  } catch (e) {
    log('Clean State Audit', false, e.message);
  }

  // 4. KNOWLEDGE BASE & BUSINESS BRAIN INGESTION FLOW
  console.log('\n--- 4. Real Knowledge Ingestion Lifecycle ---');
  try {
    const articlePayload = {
      title: 'Palm Meadows Real Estate Pricing & Layout Guidelines',
      content: 'Palm Meadows Phase 2 in Ballari offers 30x40 plots at ₹22 Lakhs and 40x60 plots at ₹35 Lakhs. Approvals: BUDA & DC Converted. Sunday site visits include complimentary family cab pickup. SBI loan available up to 80%.',
      category: 'PRICING_AND_SITE_VISIT',
    };
    const rArt = await request(`${API_BASE}/api/knowledge/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
      body: JSON.stringify(articlePayload),
    });
    const srcId = rArt.data?.source?.id || '';
    log('Knowledge Article Ingestion (POST /api/knowledge/articles)', rArt.status === 201 && Boolean(srcId), `Article Source ID: ${srcId}`);

    // Verify retrieval
    const rRet = await request(`${API_BASE}/api/knowledge/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken },
      body: JSON.stringify({ query: 'Sunday cab pickup and 30x40 pricing' }),
    });
    const resultsCount = rRet.data?.results?.length || 0;
    log('Knowledge Semantic Search & Retrieval (POST /api/knowledge/retrieve)', resultsCount > 0, `${resultsCount} matched passages found`);
  } catch (e) {
    log('Knowledge Ingestion Lifecycle', false, e.message);
  }

  // 5. LIVE SPEECH SYNTHESIS ENGINE (SARVAM BULBUL V3)
  console.log('\n--- 5. Regional Speech Synthesis (Sarvam Bulbul v3) ---');
  try {
    const rStatus = await request(`${API_BASE}/api/tts/status`);
    log('TTS Service Provider Status (/api/tts/status)', rStatus.data?.provider === 'sarvam_bulbul_v3', `Provider: ${rStatus.data?.provider}, Model: ${rStatus.data?.model}`);

    const ttsPayload = {
      text: 'ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಬಳ್ಳಾರಿ ಲೇಔಟ್ ಸೈಟ್ ವಿಸಿಟ್ ಖಚಿತವಾಗಿದೆ.',
      targetLanguageCode: 'kn-IN',
      speaker: 'kavya',
    };
    const rTts = await request(`${API_BASE}/api/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ttsPayload),
    });
    const b64Len = rTts.data?.audioBase64?.length || 0;
    const passedTts = rTts.status === 200 && b64Len > 1000;
    log('Live Neural Kannada Synthesis (/api/tts/synthesize)', passedTts, `Audio payload: ${b64Len} base64 chars (~${Math.round(b64Len * 0.75 / 1024)} KB)`);
  } catch (e) {
    log('Speech Synthesis Engine', false, e.message);
  }

  // 6. SPEED-TO-LEAD OUTBOUND TELEPHONY DISPATCH
  console.log('\n--- 6. Telephony Inception & Speed-to-Lead ---');
  try {
    const inceptionPayload = {
      targetPhone: '9448122910',
      businessName: 'Kaveri Layouts Prime',
      industry: 'REAL_ESTATE',
    };
    const rInc = await request(`${API_BASE}/api/calls/outbound-inception`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inceptionPayload),
    });
    const sid = rInc.data?.callSid || '';
    log('Outbound Inception Call (/api/calls/outbound-inception)', rInc.status === 200 && Boolean(sid), `Call SID: ${sid}, Status: ${rInc.data?.status}`);
  } catch (e) {
    log('Telephony Inception', false, e.message);
  }

  // SUMMARY AUDIT
  console.log('\n================================================================');
  const passCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`📊 FINAL AUDIT SCORE: ${passCount} / ${totalCount} PASSED (${Math.round((passCount / totalCount) * 100)}%)`);
  if (passCount === totalCount) {
    console.log('🏆 STATUS: 100% PRODUCTION READY WITH ZERO MOCK DATA');
  } else {
    console.log('⚠️ STATUS: Review pending issues');
  }
  console.log('================================================================\n');
}

run();
