#!/usr/bin/env node
/**
 * VANNI — End-to-End Integration Test Suite
 * Verifies that all frontend ↔ backend connections are working
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const VOICE_GATEWAY_URL = process.env.VOICE_GATEWAY_URL || 'http://localhost:4200';

let passed = 0;
let failed = 0;

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function assert(name, condition) {
  if (condition) {
    log('✅', name);
    passed++;
  } else {
    log('❌', name);
    failed++;
  }
}

async function testHealthEndpoints() {
  log('\n🏥', '=== Health Endpoints ===');
  
  // Test main server health
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    assert('Main server health check returns 200', res.status === 200);
    assert('Health response includes service name', data.service?.includes('VANNI'));
  } catch (e) {
    assert('Main server health check returns 200', false);
    log('⚠️', `Error: ${e.message}`);
  }

  // Test voice gateway health
  try {
    const res = await fetch(`${VOICE_GATEWAY_URL}/health`);
    const data = await res.json();
    assert('Voice gateway health check returns 200', res.status === 200);
    assert('Gateway response includes service name', data.service?.includes('Voice Gateway'));
  } catch (e) {
    assert('Voice gateway health check returns 200', false);
    log('⚠️', `Error: ${e.message} (Voice gateway may not be running)`);
  }
}

async function testDemoCallEndpoint() {
  log('\n📞', '=== Demo Call Endpoint ===');
  
  // Test missing phone parameter
  try {
    const res = await fetch(`${BASE_URL}/api/calls/outbound-inception`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert('Missing phone returns 400', res.status === 400);
  } catch (e) {
    assert('Missing phone returns 400', false);
    log('⚠️', `Error: ${e.message}`);
  }

  // Test valid phone (mock mode without Exotel credentials)
  try {
    const res = await fetch(`${BASE_URL}/api/calls/outbound-inception`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPhone: '+91 98450 12345',
        businessName: 'Test Business',
        industry: 'REAL_ESTATE',
        directorName: 'Test Director'
      })
    });
    const data = await res.json();
    assert('Valid phone returns 200', res.status === 200);
    assert('Response includes success status', data.success === true || data.callSid !== undefined);
    log('📱', `Mock call dispatched: ${data.message || data.callSid}`);
  } catch (e) {
    assert('Valid phone returns 200', false);
    log('⚠️', `Error: ${e.message}`);
  }
}

async function testCallsAPI() {
  log('\n📋', '=== Calls API ===');
  
  try {
    const res = await fetch(`${BASE_URL}/api/calls`);
    assert('Calls API returns 200', res.status === 200);
    
    const data = await res.json();
    const isArray = Array.isArray(data);
    assert('Calls API returns array', isArray);
    
    if (isArray && data.length > 0) {
      log('📊', `Found ${data.length} call records`);
      assert('Call record has required fields', 
        data[0].id !== undefined && 
        data[0].phone !== undefined
      );
    } else {
      log('📊', 'No call records found (empty database)');
    }
  } catch (e) {
    assert('Calls API returns 200', false);
    log('⚠️', `Error: ${e.message}`);
  }
}

async function testTTSEndpoint() {
  log('\n🔊', '=== TTS Synthesis Endpoint ===');
  
  // Test without API key (should return fallback instruction)
  try {
    const res = await fetch(`${BASE_URL}/api/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'ನಮಸ್ಕಾರ, ಬಳ್ಳಾರಿ ಲೇಔಟ್ಸ್ ಗೆ ಸ್ವಾಗತ',
        targetLanguageCode: 'kn-IN',
        speaker: 'meera'
      })
    });
    const data = await res.json();
    
    // Without Sarvam API key, should return fallback
    if (data.fallback === 'BROWSER_WEB_SPEECH') {
      assert('TTS returns fallback when no API key', true);
      log('💡', 'Sarvam API key not configured - browser fallback recommended');
    } else if (data.success) {
      assert('TTS synthesis successful with API key', true);
      log('🎵', `Generated ${data.audioBase64?.length || 0} bytes of audio`);
    } else {
      assert('TTS endpoint responds correctly', res.status !== 500);
    }
  } catch (e) {
    assert('TTS endpoint responds correctly', false);
    log('⚠️', `Error: ${e.message}`);
  }
}

async function testAuthEndpoints() {
  log('\n🔐', '=== Authentication Endpoints ===');
  
  // Test session check
  try {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    const data = await res.json();
    assert('Session endpoint returns 200', res.status === 200);
    assert('Session response has authenticated field', data.authenticated !== undefined);
    log('👤', `Authenticated: ${data.authenticated}`);
  } catch (e) {
    assert('Session endpoint returns 200', false);
    log('⚠️', `Error: ${e.message}`);
  }
}

async function testCRMBridge() {
  log('\n🔗', '=== CRM Integration Status ===');
  
  try {
    const res = await fetch(`${BASE_URL}/api/crm/status`);
    const data = await res.json();
    assert('CRM status endpoint returns 200', res.status === 200);
    assert('CRM response includes integrations', data.integrations !== undefined);
    
    if (data.integrations) {
      log('📦', `Twenty CRM: ${data.integrations.twentyCrm?.status || 'N/A'}`);
      log('📦', `Chatwoot: ${data.integrations.chatwoot?.status || 'N/A'}`);
      log('📦', `Cal.com: ${data.integrations.calCom?.status || 'N/A'}`);
    }
  } catch (e) {
    assert('CRM status endpoint returns 200', false);
    log('⚠️', `Error: ${e.message}`);
  }
}

async function testLanguageIntelligence() {
  log('\n🗣️', '=== Language Intelligence APIs ===');
  
  // Test dialect profiles
  try {
    const res = await fetch(`${BASE_URL}/api/language/dialects`);
    const data = await res.json();
    assert('Dialect profiles endpoint returns 200', res.status === 200);
    assert('Dialect profiles array exists', Array.isArray(data.dialects));
    log('🌐', `Found ${data.dialects?.length || 0} dialect profiles`);
  } catch (e) {
    assert('Dialect profiles endpoint returns 200', false);
    log('⚠️', `Error: ${e.message}`);
  }

  // Test language preview
  try {
    const res = await fetch(`${BASE_URL}/api/language/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'ನಮಸ್ಕಾರ, 30x40 site ಬೇಕು ಸರ್'
      })
    });
    const data = await res.json();
    assert('Language preview endpoint returns 200', res.status === 200);
    if (data.success) {
      log('📝', `Detected: ${data.preview?.detectedLanguage?.primaryLanguage || 'unknown'}`);
    }
  } catch (e) {
    assert('Language preview endpoint returns 200', false);
    log('⚠️', `Error: ${e.message}`);
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('   VANNI — End-to-End Integration Test Suite');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Voice Gateway URL: ${VOICE_GATEWAY_URL}`);
  console.log('='.repeat(60));

  await testHealthEndpoints();
  await testDemoCallEndpoint();
  await testCallsAPI();
  await testTTSEndpoint();
  await testAuthEndpoints();
  await testCRMBridge();
  await testLanguageIntelligence();

  console.log('\n' + '='.repeat(60));
  console.log('   TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${passed + failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
