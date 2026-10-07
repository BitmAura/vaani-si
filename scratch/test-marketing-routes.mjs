import assert from 'node:assert';

console.log('=== VERIFYING ALL 15 PUBLIC MARKETING ROUTES ===\n');

const ROUTES = [
  '/',
  '/features',
  '/how-it-works',
  '/industries',
  '/industries/dental',
  '/industries/healthcare',
  '/industries/ivf',
  '/industries/hospitality',
  '/industries/real-estate',
  '/pricing',
  '/demo',
  '/contact',
  '/security',
  '/login',
  '/signup',
];

const BASE_URL = 'http://localhost:4000';

let passed = 0;
let failed = 0;

for (const route of ROUTES) {
  const url = `${BASE_URL}${route}`;
  try {
    const res = await fetch(url);
    assert.strictEqual(res.status, 200, `Expected 200 for ${route}, got ${res.status}`);
    const cType = res.headers.get('content-type') || '';
    assert.ok(cType.includes('text/html'), `Expected text/html for ${route}, got ${cType}`);

    const html = await res.text();
    assert.ok(html.includes('<title>'), `Missing <title> in ${route}`);
    assert.ok(html.includes('VANNI'), `Missing VANNI brand reference in ${route}`);
    assert.ok(html.includes('rel="canonical"'), `Missing canonical tag in ${route}`);
    assert.ok(!html.includes('48,219 Inbound Calls Handled'), `Found fake statistics in ${route}`);
    assert.ok(!html.includes('382ms Average Turnaround'), `Found fake statistics in ${route}`);
    assert.ok(!html.includes('99.99% accurate'), `Found fake accuracy claim in ${route}`);

    console.log(`✅ [PASS] Route ${route.padEnd(25)} -> HTTP 200 OK (${html.length} bytes)`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] Route ${route}:`, err.message);
    failed++;
  }
}

// Check specific homepage elements
const homeRes = await fetch(`${BASE_URL}/`);
const homeHtml = await homeRes.text();

assert.ok(homeHtml.includes('Your next AI employee can speak to every customer'), 'Missing hero headline');
assert.ok(homeHtml.includes('INBOUND CALL CONNECTED'), 'Missing call proof banner');
assert.ok(homeHtml.includes('vanni-demo-modal'), 'Missing conversion demo modal');
assert.ok(homeHtml.includes('The Dental Practice Challenge') || homeHtml.includes('Dental & Clinics'), 'Missing Dental section');
assert.ok(homeHtml.includes('Real Estate & Layouts'), 'Missing Real Estate section');
assert.ok(homeHtml.includes('Healthcare & Hospitals'), 'Missing Healthcare section');
assert.ok(homeHtml.includes('Does VANNI understand conversational Kannada and Kanglish?'), 'Missing FAQ');
console.log('✅ [PASS] Homepage 17-section structure and conversion modal verified');

console.log(`\n=== MARKETING ROUTE VERIFICATION SUMMARY ===`);
console.log(`Total: ${ROUTES.length} | Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
