import fs from 'node:fs';
import path from 'node:path';

const consolePath = path.resolve('apps/web/console.html');
let html = fs.readFileSync(consolePath, 'utf-8');

// Replacements map
const replacements = [
  // 1. Sidebar and main structural backgrounds
  ['class="w-64 bg-onyx-900 border-r border-slate-200', 'class="w-64 bg-white border-r border-slate-200'],
  ['class="flex-1 flex flex-col h-screen overflow-hidden bg-onyx-950"', 'class="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFC]"'],
  ['class="h-14 bg-onyx-900 border-b border-slate-200', 'class="h-14 bg-white border-b border-slate-200'],
  ['border-b border-slate-200 bg-onyx-900/60', 'border-b border-slate-200 bg-white'],
  ['border-b border-slate-200 bg-onyx-900 shrink-0 text-xs', 'border-b border-slate-200 bg-white shrink-0 text-xs'],

  // 2. Tenant Switcher & User Profile
  ['bg-onyx-850 hover:bg-onyx-800 border border-slate-200', 'bg-slate-50 hover:bg-slate-100 border border-slate-200'],
  ['class="font-bold text-xs text-white truncate group-hover:text-brand-40', 'class="font-bold text-xs text-slate-900 truncate group-hover:text-blue-600'],
  ['rounded-xl bg-onyx-850 border border-slate-200 shadow-2xl p-1 z-50 text-xs backdrop-blur-xl', 'rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-50 text-xs'],
  ['hover:bg-onyx-800', 'hover:bg-slate-100'],
  ['class="p-2.5 rounded-xl bg-onyx-850 border border-slate-200', 'class="p-2.5 rounded-xl bg-slate-50 border border-slate-200'],
  ['text-slate-500 hover:text-white p-1 rounded hover:bg-onyx-800', 'text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200'],

  // 3. Navigation Sidebar links
  ['hover:text-white hover:bg-onyx-850', 'hover:text-slate-900 hover:bg-slate-100'],

  // 4. Quick Actions (Header)
  ['rounded-full bg-onyx-850 border border-slate-200 text-[11px] font-mono text-slate-700', 'rounded-full bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700'],
  ['class="px-3 py-1.5 rounded-lg bg-onyx-850 hover:bg-onyx-800 border border-slate-200 text-xs font-semibold text-slate-800', 'class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700'],

  // 5. Filter Strip & Search
  ['id="flt-all" class="px-2.5 py-1 rounded-lg bg-onyx-800 text-white', 'id="flt-all" class="px-2.5 py-1 rounded-lg bg-slate-900 text-white'],
  ['bg-onyx-850 border border-slate-200 text-xs text-slate-900 placeholder-slate-400', 'bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white'],

  // 6. Tables (Calls, WhatsApp, Logs)
  ['rounded-xl border border-slate-200 bg-onyx-900 overflow-hidden shadow-xl', 'rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm'],
  ['<thead class="bg-onyx-850 border-b border-slate-200', '<thead class="bg-slate-50 border-b border-slate-200'],
  ['rounded bg-onyx-850 border border-slate-200 text-[10px] text-slate-700', 'rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-700'],
  ['bg-onyx-850 hover:bg-onyx-800 border border-slate-200 text-xs font-semibold text-slate-900', 'bg-white hover:bg-slate-50 border-slate-200 text-xs font-semibold text-slate-700'],

                              
  ['bg-onyx-850 border border-slate-200 text-xs text-slate-900', 'bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white'],
  ['bg-onyx-850 border border-slate-200 text-xs text-white font-mono', 'bg-slate-50 border-slate-200 text-xs text-slate-900 font-mono focus:bg-white'],
  ['bg-onyx-850 border border-slate-200 text-xs text-emerald-400 font-mono', 'bg-slate-50 border border-slate-200 text-xs text-emerald-700 font-mono'],
  ['bg-onyx-800 hover:bg-onyx-700 text-xs font-semibold text-white border-l border-slate-200', 'bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border-l border-slate-200'],
  ['class="flex rounded-lg overflow-hidden border border-slate-200 bg-onyx-850"', 'class="flex rounded-lg overflow-hidden border border-slate-200 bg-slate-50"'],
  ['px-3 py-2 bg-onyx-800 text-slate-500 font-mono text-xs font-bold border-r border-slate-200', 'px-3 py-2 bg-slate-100 text-slate-600 font-mono text-xs font-bold border-r border-slate-200'],

  // 8. Stack feed
  ['px-5 py-3 border-b border-slate-200 bg-onyx-850', 'px-5 py-3 border-b border-slate-200 bg-slate-50'],
  ['<div class="p-2.5 rounded-lg bg-onyx-850 border border-slate-200', '<div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200'],

  // 9. Drawer
  ['<aside id="call-drawer" class="fixed right-0 top-0 bottom-0 w-[520px] bg-onyx-900', '<aside id="call-drawer" class="fixed right-0 top-0 bottom-0 w-[520px] bg-white'],
  ['class="p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-onyx-850"', 'class="p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50"'],
  ['p-1.5 rounded-lg hover:bg-onyx-800 text-slate-500 hover:text-white', 'p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700'],
  ['class="h-10 bg-onyx-950 rounded-lg p-2 border border-slate-200', 'class="h-10 bg-slate-50 rounded-lg p-2 border border-slate-200'],
  ['rounded bg-onyx-800 text-[10px] font-mono text-slate-700 hover:text-white', 'rounded bg-slate-100 text-[10px] font-mono text-slate-600 hover:text-slate-900'],
  ['rounded bg-onyx-800 text-slate-500 hover:text-white', 'rounded bg-slate-100 text-slate-500 hover:text-slate-700'],

  // 10. Modals
  ['w-full max-w-md bg-onyx-900 border border-slate-200 rounded-2xl p-6 shadow-2xl', 'w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl'],
  ['p-6 rounded-xl bg-onyx-950 border border-slate-200 text-center space-y-3', 'p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3'],

  // 11. Remaining generic onyx replacements
  ['bg-onyx-950', 'bg-slate-50'],
  ['bg-onyx-900', 'bg-white'],
  ['bg-onyx-850', 'bg-slate-50'],
  ['bg-onyx-800', 'bg-slate-100'],
  ['hover:bg-onyx-700', 'hover:bg-slate-200'],
  ['hover:bg-onyx-850', 'hover:bg-slate-50'],
  ['hover:bg-onyx-800', 'hover:bg-slate-100'],
  ['group-hover:text-white', 'group-hover:text-slate-900'],
  ['hover:text-white', 'hover:text-slate-900'],
];

for (const [target, replacement] of replacements) {
  html = html.replaceAll(target, replacement);
}

// Ensure any remaining text-white is valid (only on dark/colored buttons)
// Replace text-white on headings that might still remain
html = html.replaceAll('text-xs font-bold text-white', 'text-xs font-bold text-slate-900');
html = html.replaceAll('text-white font-semibold', 'text-slate-900 font-semibold');
html = html.replaceAll('text-base font-bold text-white', 'text-base font-bold text-slate-900');

fs.writeFileSync(consolePath, html, 'utf-8');
console.log('✓ Successfully eliminated all remaining onyx/dark classes from console.html!');
