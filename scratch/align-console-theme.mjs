/**
 * Script to align console.html theme with index.html (Homepage Light Executive Style)
 */

import fs from 'node:fs';
import path from 'node:path';

const consolePath = path.resolve('apps/web/console.html');
let html = fs.readFileSync(consolePath, 'utf-8');

// 1. Remove class="dark"
html = html.replace('<html lang="en" class="dark">', '<html lang="en">');

// 2. Update Tailwind config to map directly to the homepage / vanni.css palette
const oldTailwindBlock = `    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
          },
          colors: {
            brand: {
              400: '#34d399',
              500: '#10b981',
              600: '#059669',
            },
            onyx: {
              950: '#08090C',
              900: '#0D0F14',
              850: '#12151D',
              800: '#181C26',
              700: '#222736',
            }
          }
        }
      }
    }`;

const newTailwindBlock = `    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Noto Sans Kannada"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
          },
          colors: {
            brand: {
              50: '#eff6ff',
              100: '#dbeafe',
              400: '#3b82f6',
              500: '#2563eb', // Matches homepage cobalt blue
              600: '#1d4ed8',
            },
            onyx: {
              950: '#F8FAFC', // Main background matching homepage
              900: '#FFFFFF', // Sidebar & Top Bar surface
              850: '#FFFFFF', // Card surface
              800: '#F1F5F9', // Subdued / hover backgrounds
              750: '#E2E8F0', // Border colors
              700: '#CBD5E1', // Strong borders
            }
          }
        }
      }
    }`;

html = html.replace(oldTailwindBlock, newTailwindBlock);

// 3. Update CSS Variables & Body Styling
const oldStyleBlock = `  <style>
    :root {
      --bg-root: #08090C;
      --bg-surface-1: #0D0F14;
      --bg-surface-2: #12151D;
      --bg-surface-3: #181C26;
      --border-subtle: rgba(255, 255, 255, 0.06);
      --border-default: rgba(255, 255, 255, 0.09);
      --border-highlight: rgba(255, 255, 255, 0.16);
      --brand-emerald: #10B981;
    }

    body {
      background-color: var(--bg-root);
      color: #E2E8F0;
      -webkit-font-smoothing: antialiased;
      background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 28px 28px;
    }

    /* Crisp Card Inset Shadows */
    .card-craft {
      background: var(--bg-surface-2);
      border: 1px solid var(--border-default);
      box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.04), 0 2px 8px -2px rgba(0, 0, 0, 0.6);
    }
    .card-craft:hover {
      border-color: var(--border-highlight);
    }`;

const newStyleBlock = `  <style>
    :root {
      --bg-root: var(--vanni-bg, #F8FAFC);
      --bg-surface-1: var(--vanni-surface, #FFFFFF);
      --bg-surface-2: var(--vanni-surface, #FFFFFF);
      --bg-surface-3: var(--vanni-surface-subdued, #F1F5F9);
      --border-subtle: var(--vanni-border-subdued, #F1F5F9);
      --border-default: var(--vanni-border, #E2E8F0);
      --border-highlight: var(--vanni-border-strong, #CBD5E1);
      --brand-emerald: #059669;
    }

    body {
      background-color: var(--vanni-bg, #F8FAFC);
      color: var(--vanni-text-primary, #0F172A);
      font-family: var(--vanni-font-sans, 'Inter', sans-serif);
      -webkit-font-smoothing: antialiased;
    }

    /* Crisp Card Inset Shadows Matching Homepage */
    .card-craft {
      background: #FFFFFF;
      border: 1px solid var(--vanni-border, #E2E8F0);
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
    }
    .card-craft:hover {
      border-color: var(--vanni-border-strong, #CBD5E1);
    }`;

html = html.replace(oldStyleBlock, newStyleBlock);

// 4. Replace border utility classes from dark to light
html = html.replaceAll('border-white/[0.07]', 'border-slate-200');
html = html.replaceAll('border-white/[0.08]', 'border-slate-200');
html = html.replaceAll('border-white/[0.09]', 'border-slate-200');
html = html.replaceAll('border-white/[0.1]', 'border-slate-200');
html = html.replaceAll('border-white/[0.06]', 'border-slate-200');
html = html.replaceAll('border-white/[0.05]', 'border-slate-200');
html = html.replaceAll('divide-white/[0.05]', 'divide-slate-100');
html = html.replaceAll('divide-white/[0.08]', 'divide-slate-200');

// 5. Replace text colors that were styled for dark mode
// text-slate-400 -> text-slate-500 (#64748B, clean secondary text)
html = html.replaceAll('text-slate-400', 'text-slate-500');
// text-slate-300 -> text-slate-700 (#334155, high-contrast readable text)
html = html.replaceAll('text-slate-300', 'text-slate-700');
// text-slate-200 -> text-slate-800 (#1E293B)
html = html.replaceAll('text-slate-200', 'text-slate-800');

// 6. Replace main text-white with text-slate-900 on headings and labels
// but preserve text-white on colored action buttons
html = html.replaceAll('class="font-bold text-sm tracking-tight text-white"', 'class="font-bold text-sm tracking-tight text-slate-900"');
html = html.replaceAll('class="font-bold text-xs text-white truncate"', 'class="font-bold text-xs text-slate-900 truncate"');
html = html.replaceAll('class="font-bold text-white text-xs"', 'class="font-bold text-slate-900 text-xs"');
html = html.replaceAll('class="font-bold text-white text-xs truncate"', 'class="font-bold text-slate-900 text-xs truncate"');
html = html.replaceAll('class="font-bold text-white"', 'class="font-bold text-slate-900"');
html = html.replaceAll('class="text-sm font-bold text-white tracking-tight', 'class="text-sm font-bold text-slate-900 tracking-tight');
html = html.replaceAll('class="text-base font-bold text-white"', 'class="text-base font-bold text-slate-900"');
html = html.replaceAll('class="font-extrabold text-sm text-white"', 'class="font-extrabold text-sm text-slate-900"');
html = html.replaceAll('class="mt-1.5 text-xl font-extrabold text-white font-mono tnum"', 'class="mt-1.5 text-xl font-extrabold text-slate-900 font-mono tnum"');
html = html.replaceAll('class="px-2.5 py-1 rounded-lg bg-onyx-800 text-white font-semibold', 'class="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold');
html = html.replaceAll('class="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-black font-extrabold', 'class="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold');
html = html.replaceAll('class="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-black font-extrabold', 'class="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold');

// 7. Search input & command bar styling
html = html.replaceAll('text-xs text-white placeholder-slate-500', 'text-xs text-slate-900 placeholder-slate-400');
html = html.replaceAll('bg-white/[0.06] border border-white/[0.08]', 'bg-slate-100 border border-slate-200');

// 8. WhatsApp card in drawer - soft clean light styling
html = html.replaceAll('bg-[#0B141A]', 'bg-[#F0FDF4]');
html = html.replaceAll('bg-[#111B21]', 'bg-[#FFFFFF]');

// 9. Waveform bars - Cobalt blue
html = html.replaceAll('bg-slate-700 rounded-full', 'bg-blue-600 rounded-full');

// 10. Modals background
html = html.replaceAll('bg-black/70', 'bg-slate-900/40');

fs.writeFileSync(consolePath, html);
console.log('✓ Successfully aligned console.html with homepage colors!');
