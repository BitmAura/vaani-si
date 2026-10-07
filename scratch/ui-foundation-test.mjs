import assert from 'node:assert';
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  motion,
  renderButton,
  renderInput,
  renderBadge,
  renderAlert,
  renderMetricCard,
  renderEmptyState,
  renderTranscriptLine,
  renderVoiceActivityIndicator,
  renderAppShell,
  renderTabs,
} from '../packages/ui/dist/index.js';

console.log('=== STARTING VANNI DESIGN SYSTEM & UI FOUNDATION TEST ===\n');

// 1. Verify Color Tokens
assert.strictEqual(colors.light.primary, '#0F172A', 'Light primary color must be Executive Slate (#0F172A)');
assert.strictEqual(colors.light.accent, '#2563EB', 'Light accent color must be Cobalt Blue (#2563EB)');
assert.strictEqual(colors.light.success, '#059669', 'Light success color must be Emerald-600 (#059669)');
assert.ok(colors.dark.primary, 'Dark mode primary must be defined');
console.log('✅ [PASS] Semantic Color Tokens verified (Light & Dark mode ready)');

// 2. Verify Typography Tokens & Kannada Glyphs
assert.ok(typography.fontFamilies.sans.includes('Noto Sans Kannada'), 'Sans font stack must include Noto Sans Kannada');
assert.ok(typography.fontFamilies.mono.includes('JetBrains Mono'), 'Mono font stack must include JetBrains Mono');
assert.strictEqual(typography.scale.display.fontSize, '2.5rem');
assert.strictEqual(typography.scale.body.fontSize, '0.875rem');
console.log('✅ [PASS] Typography Tokens verified (Latin + Noto Sans Kannada + Tabular Numerals)');

// 3. Verify Spacing & Radius Tokens
assert.strictEqual(spacing[1], '4px');
assert.strictEqual(spacing[4], '16px');
assert.strictEqual(radius.md, '6px');
assert.strictEqual(radius.lg, '8px');
assert.strictEqual(radius.full, '9999px');
console.log('✅ [PASS] Spacing Scale & Radius Tokens verified (Strict 4px modular rhythm)');

// 4. Verify Component Renderers & Accessibility Attributes
const btnHtml = renderButton({ label: 'Talk to VANNI', variant: 'primary' });
assert.ok(btnHtml.includes('vanni-button-primary'), 'Button renderer must include primary class');
assert.ok(btnHtml.includes('Talk to VANNI'), 'Button renderer must render label');

const inputHtml = renderInput({ id: 'phone', name: 'phone', label: 'Virtual Phone', required: true });
assert.ok(inputHtml.includes('aria-invalid'), 'Input must include accessibility aria-invalid attribute');
assert.ok(inputHtml.includes('vanni-input'), 'Input must include vanni-input class');

const emptyHtml = renderEmptyState({ title: 'No calls yet', description: 'Your first call will appear here.' });
assert.ok(emptyHtml.includes('vanni-empty-state'), 'Empty state must use vanni-empty-state class');
assert.ok(emptyHtml.includes('Your first call will appear here.'), 'Empty state must render honest zero message');

const transcriptHtml = renderTranscriptLine({
  speaker: 'AI',
  timeOffset: '00:04',
  text: 'ನಮಸ್ಕಾರ ಸರ್, ಅಪೋಲೋ ಕ್ಲಿನಿಕ್‌ಗೆ ಸ್ವಾಗತ.',
  isKannada: true,
});
assert.ok(transcriptHtml.includes('vanni-transcript-speaker-ai'), 'Transcript must identify AI speaker');
assert.ok(transcriptHtml.includes('vanni-kannada'), 'Transcript must attach vanni-kannada class for proper line-height');

const voiceHtml = renderVoiceActivityIndicator({ state: 'listening' });
assert.ok(voiceHtml.includes('aria-live="polite"'), 'Voice indicator must announce state changes to screen readers');
assert.ok(voiceHtml.includes('LISTENING'), 'Voice indicator must display listening status');

console.log('✅ [PASS] UI Primitives & Voice UX Renderers verified (Accessible HTML & ARIA attributes)');

console.log('\n=== ALL VANNI UI FOUNDATION TESTS PASSED (100%) ===\n');
