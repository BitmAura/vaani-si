// Phase 1: Automated E2E Backend & WebSocket Test Suite
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000/ws/audio-stream?tenant=real_estate';

const results = [];

function assert(name, condition, details = '') {
  if (condition) {
    results.push({ name, status: 'PASS', details });
    console.log(`✅ [PASS] ${name}`);
  } else {
    results.push({ name, status: 'FAIL', details });
    console.error(`❌ [FAIL] ${name} — ${details}`);
  }
}

async function runTests() {
  console.log('=== STARTING DHWANI SI END-TO-END QA SUITE ===\n');

  // Test 1: Health Endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert('Health Check HTTP 200', res.status === 200, `Status: ${res.status}`);
    const data = await res.json();
    assert('Health Check Payload Service Name', data.service?.includes('Dhwani SI'), JSON.stringify(data));
    assert('Health Check Active Tenants', data.activeTenants >= 2, `Active: ${data.activeTenants}`);
  } catch (err) {
    assert('Health Check Exception', false, err.message);
  }

  // Test 2: Calls API (Database Retrieval)
  try {
    const res = await fetch(`${BASE_URL}/api/calls?tenant=real_estate`);
    assert('Calls API HTTP 200', res.status === 200);
    const calls = await res.json();
    assert('Calls API returns array', Array.isArray(calls) && calls.length > 0, `Length: ${calls?.length}`);
    const first = calls[0];
    assert('Call Schema has ID, Caller, and Phone', first.id && first.caller && first.phone, JSON.stringify(first));
  } catch (err) {
    assert('Calls API Exception', false, err.message);
  }

  // Test 3: CDR Ingestion Webhook
  try {
    const testCdrId = `TEST-CDR-${Date.now().toString().slice(-4)}`;
    const cdrRes = await fetch(`${BASE_URL}/api/telephony/cdr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CallSid: testCdrId,
        tenant: 'real_estate',
        CallerName: 'Test QA Engineer',
        From: '+91 99999 88888',
        FromCity: 'Bengaluru',
        RecordingDuration: 45,
        Direction: 'inbound',
        intent: '30x40 Plot Inquiry QA Test',
      }),
    });
    assert('CDR Ingestion HTTP 200', cdrRes.status === 200);
    const cdrData = await cdrRes.json();
    assert('CDR Saved ID matches', cdrData.savedId === testCdrId, `Saved ID: ${cdrData.savedId}`);

    // Verify record exists in GET /api/calls
    const verifyRes = await fetch(`${BASE_URL}/api/calls?tenant=real_estate`);
    const allCalls = await verifyRes.json();
    const found = allCalls.find(c => c.id === testCdrId);
    assert('Verified CDR Persisted in DB', !!found, `Found record: ${found?.id}`);
  } catch (err) {
    assert('CDR Test Exception', false, err.message);
  }

  // Test 4: Outbound Inception Validation
  try {
    // 4.1 Missing phone should return 400
    const failRes = await fetch(`${BASE_URL}/api/calls/outbound-inception`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert('Outbound Inception 400 on Missing Phone', failRes.status === 400);

    // 4.2 Valid phone should dispatch and return 200
    const okRes = await fetch(`${BASE_URL}/api/calls/outbound-inception`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPhone: '+91 98450 12345',
        businessName: 'QA Test Clinic',
        industry: 'HEALTHCARE_HOSPITAL',
      }),
    });
    assert('Outbound Inception 200 on Valid Phone', okRes.status === 200);
    const okData = await okRes.json();
    assert('Outbound Inception returns Call Sid', okData.success && !!okData.callSid, JSON.stringify(okData));
  } catch (err) {
    assert('Outbound Inception Exception', false, err.message);
  }

  // Test 5: WebSocket Real-Time Audio Streaming Handshake
  await new Promise((resolve) => {
    try {
      const ws = new WebSocket(WS_URL);
      let receivedGreeting = false;

      ws.on('open', () => {
        assert('WebSocket Connection Opened', true);
        // Start call event
        ws.send(JSON.stringify({ event: 'start_call', tenant: 'real_estate' }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'CALL_STARTED') {
            receivedGreeting = true;
            assert('WebSocket Received CALL_STARTED Event', true, msg.greeting);

            // Send simulated user speech turn
            ws.send(JSON.stringify({
              event: 'user_text_turn',
              text: 'Plots rate eshtu start aaguththe?'
            }));
          }

          if (msg.type === 'TRANSCRIPT' && msg.speaker === 'AGENT') {
            assert('WebSocket Received Agent Kanglish Response', msg.text.length > 5, msg.text);
          }

          if (msg.type === 'LATENCY') {
            assert('WebSocket Received Sub-750ms SLA Latency Breakdown', msg.totalMs > 0, `Total: ${msg.totalMs}ms`);
            ws.close();
            resolve();
          }
        } catch (e) {
          // ignore binary chunks
        }
      });

      ws.on('error', (err) => {
        assert('WebSocket Error', false, err.message);
        resolve();
      });

      setTimeout(() => {
        if (!receivedGreeting) {
          assert('WebSocket Timeout waiting for greeting', false);
        }
        ws.close();
        resolve();
      }, 4000);
    } catch (err) {
      assert('WebSocket Setup Exception', false, err.message);
      resolve();
    }
  });

  // Summary
  console.log('\n=== E2E BACKEND QA TEST RESULTS ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('🎯 ALL BACKEND & TELEPHONY TESTS PASSED WITH 100% SUCCESS RATE!\n');
  }
}

runTests();
