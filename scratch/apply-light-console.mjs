import fs from 'node:fs';
import path from 'node:path';

const consolePath = path.resolve('apps/web/console.html');
let html = fs.readFileSync(consolePath, 'utf-8');

// 1. Remove class="dark"
html = html.replace('<html lang="en" class="dark">', '<html lang="en">');

// 2. Update Tailwind config
const oldTailwind = /tailwind\.config\s*=\s*\{[\s\S]*?\n\s*\};?/m;
const newTailwind = `tailwind.config = {
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
              500: '#2563eb',
              600: '#1d4ed8',
            },
            onyx: {
              950: '#F8FAFC', // Main background matching homepage
              900: '#FFFFFF', // Sidebar & Top Bar surface
              850: '#FFFFFF', // Card & panel surface
              800: '#F1F5F9', // Subdued / hover backgrounds
              750: '#E2E8F0', // Border colors
              700: '#CBD5E1', // Strong borders
            }
          }
        }
      }
    };`;

html = html.replace(oldTailwind, newTailwind);

// 3. Update CSS Variables and Body in <style>
const oldStyle = /<style>[\s\S]*?<\/style>/m;
const newStyle = `<style>
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
      box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05);
    }
    .card-craft:hover {
      border-color: var(--vanni-border-strong, #CBD5E1);
    }

    .custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 9999px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

    .drawer-anim {
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Waveform visualizer bars */
    .wave-bar {
      transition: height 0.1s ease;
    }

    /* Tabular figures for numbers */
    .tnum {
      font-variant-numeric: tabular-nums;
    }

    .modal-overlay:not(.hidden) {
      display: flex;
    }
  </style>`;

html = html.replace(oldStyle, newStyle);

// 4. Update body selection colors
html = html.replace(
  'selection:bg-brand-500/30 selection:text-white',
  'selection:bg-blue-100 selection:text-blue-900'
);

// 5. Replace border utility classes
html = html.replaceAll('border-white/[0.07]', 'border-slate-200');
html = html.replaceAll('border-white/[0.08]', 'border-slate-200');
html = html.replaceAll('border-white/[0.09]', 'border-slate-200');
html = html.replaceAll('border-white/[0.1]', 'border-slate-200');
html = html.replaceAll('border-white/[0.06]', 'border-slate-200');
html = html.replaceAll('border-white/[0.05]', 'border-slate-200');
html = html.replaceAll('border-white/[0.04]', 'border-slate-200');
html = html.replaceAll('border-white/[0.12]', 'border-slate-300');
html = html.replaceAll('divide-white/[0.05]', 'divide-slate-100');
html = html.replaceAll('divide-white/[0.08]', 'divide-slate-200');

// 6. Update text colors
html = html.replaceAll('text-slate-400', 'text-slate-500');
html = html.replaceAll('text-slate-300', 'text-slate-700');
html = html.replaceAll('text-slate-200', 'text-slate-800');

// 7. Replace text-white on headings, labels and table contents (except deliberate white text on dark/blue buttons)
html = html.replaceAll('class="font-bold text-sm tracking-tight text-white"', 'class="font-bold text-sm tracking-tight text-slate-900"');
html = html.replaceAll('class="font-bold text-xs text-white truncate"', 'class="font-bold text-xs text-slate-900 truncate"');
html = html.replaceAll('class="font-bold text-white text-xs"', 'class="font-bold text-slate-900 text-xs"');
html = html.replaceAll('class="font-bold text-white text-xs truncate"', 'class="font-bold text-slate-900 text-xs truncate"');
html = html.replaceAll('class="font-bold text-white"', 'class="font-bold text-slate-900"');
html = html.replaceAll('class="text-sm font-bold text-white tracking-tight', 'class="text-sm font-bold text-slate-900 tracking-tight');
html = html.replaceAll('class="text-base font-bold text-white"', 'class="text-base font-bold text-slate-900"');
html = html.replaceAll('class="text-base font-bold text-white flex items-center', 'class="text-base font-bold text-slate-900 flex items-center');
html = html.replaceAll('class="text-sm font-bold text-white"', 'class="text-sm font-bold text-slate-900"');
html = html.replaceAll('class="font-extrabold text-sm text-white"', 'class="font-extrabold text-sm text-slate-900"');
html = html.replaceAll('class="font-extrabold text-base text-white mt-1"', 'class="font-extrabold text-base text-slate-900 mt-1"');
html = html.replaceAll('class="mt-1.5 text-xl font-extrabold text-white font-mono tnum"', 'class="mt-1.5 text-xl font-extrabold text-slate-900 font-mono tnum"');
html = html.replaceAll('class="font-bold text-white group-hover:text-brand-400 transition-colors"', 'class="font-bold text-slate-900 group-hover:text-blue-600 transition-colors"');
html = html.replaceAll('class="font-semibold text-white truncate max-w-xs"', 'class="font-semibold text-slate-900 truncate max-w-xs"');
html = html.replaceAll('class="font-mono text-white font-bold"', 'class="font-mono text-slate-900 font-bold"');
html = html.replaceAll('class="font-semibold text-white"', 'class="font-semibold text-slate-900"');
html = html.replaceAll('class="font-bold text-white">1m 24s<', 'class="font-bold text-slate-900">1m 24s<');

// 8. Buttons & Controls Styling
// Mic CTA button
html = html.replaceAll(
  'class="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-black font-extrabold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center space-x-1.5"',
  'class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/20 transition-all flex items-center space-x-1.5"'
);
// Save persona button
html = html.replaceAll(
  'class="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-black font-extrabold text-xs shadow transition-all"',
  'class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"'
);
// Inception call button
html = html.replaceAll(
  'class="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-black font-extrabold text-xs shadow"',
  'class="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"'
);
// Sandbox close button
html = html.replaceAll(
  'class="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-black font-extrabold text-xs"',
  'class="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"'
);
// Play button in drawer
html = html.replaceAll(
  'class="w-8 h-8 rounded-lg bg-brand-500 hover:bg-brand-400 text-black flex items-center justify-center font-bold shadow-md shadow-brand-500/20 transition-all shrink-0"',
  'class="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20 transition-all shrink-0"'
);

// 9. Input & search styling
html = html.replaceAll('text-xs text-white placeholder-slate-500', 'text-xs text-slate-900 placeholder-slate-400');
html = html.replaceAll('bg-white/[0.06] border border-white/[0.08]', 'bg-slate-100 border border-slate-200');
html = html.replaceAll('bg-white/[0.04] text-slate-300 border border-white/[0.06]', 'bg-slate-100 text-slate-700 border border-slate-200');
html = html.replaceAll('bg-white/[0.06] text-slate-300', 'bg-slate-100 text-slate-700');

// 10. Drawer backdrop and modals
html = html.replaceAll('bg-black/60 backdrop-blur-sm', 'bg-slate-900/40 backdrop-blur-sm');
html = html.replaceAll('bg-black/70 backdrop-blur-sm', 'bg-slate-900/40 backdrop-blur-sm');

// 11. WhatsApp alert styling
html = html.replaceAll('bg-[#0B141A]', 'bg-[#F0FDF4]');
html = html.replaceAll('bg-[#111B21]', 'bg-[#FFFFFF]');

// 12. Audio waveform default styling
html = html.replaceAll('bg-slate-700 rounded-full', 'bg-blue-600 rounded-full');

// 13. JS dynamic templates adjustments
html = html.replaceAll('hover:bg-onyx-850', 'hover:bg-slate-50');
html = html.replaceAll('hover:bg-white', 'hover:bg-slate-100');
html = html.replaceAll('bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20', 'bg-blue-50 text-blue-700 font-semibold border border-blue-200');
html = html.replaceAll('bg-brand-500/20 text-brand-400', 'bg-blue-100 text-blue-700');

// 14. Adjust JS audio bar colors in startAudio
html = html.replaceAll("b.classList.remove('bg-slate-700');", "b.classList.remove('bg-slate-200');");
html = html.replaceAll("b.classList.add('bg-brand-400');", "b.classList.add('bg-blue-600');");
html = html.replaceAll("b.classList.add('bg-slate-700');", "b.classList.add('bg-slate-200');");
html = html.replaceAll("b.classList.remove('bg-brand-400');", "b.classList.remove('bg-blue-600');");

// 15. Adjust JS waveform initialization bar color
html = html.replaceAll("bar.className = 'wave-bar flex-1 bg-slate-700 rounded-full';", "bar.className = 'wave-bar flex-1 bg-slate-200 rounded-full';");

// 16. Adjust JS drawer transcript bubbles
html = html.replaceAll(
  "d.className = `p-2.5 rounded-xl ${isAgent ? 'bg-brand-500/10 border border-brand-500/20 text-slate-200' : 'bg-onyx-850 border border-white/[0.06] text-slate-300'}`;",
  "d.className = `p-2.5 rounded-xl ${isAgent ? 'bg-blue-50/80 border border-blue-100 text-slate-800' : 'bg-slate-50 border border-slate-200 text-slate-800'}`;"
);
html = html.replaceAll(
  "<strong class=\"${isAgent ? 'text-brand-400 font-bold' : 'text-slate-400'} flex items-center space-x-1\">",
  "<strong class=\"${isAgent ? 'text-blue-700 font-bold' : 'text-slate-600'} flex items-center space-x-1\">"
);
html = html.replaceAll(
  "${isAgent ? '<span class=\"w-1.5 h-1.5 rounded-full bg-brand-400\"></span>' : ''}",
  "${isAgent ? '<span class=\"w-1.5 h-1.5 rounded-full bg-blue-600\"></span>' : ''}"
);
html = html.replaceAll("hover:text-brand-400 cursor-pointer font-mono", "hover:text-blue-600 cursor-pointer font-mono");

// 17. Adjust active button in filter
html = html.replaceAll(
  "b.className = 'px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-onyx-850 transition-colors text-xs flex items-center space-x-1';",
  "b.className = 'px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs flex items-center space-x-1';"
);
html = html.replaceAll(
  "activeBtn.className = 'px-2.5 py-1 rounded-lg bg-onyx-800 text-white font-semibold border border-white/[0.1] text-xs flex items-center space-x-1';",
  "activeBtn.className = 'px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold border border-slate-900 text-xs flex items-center space-x-1';"
);

// 18. Adjust switchTab active/inactive nav links
html = html.replaceAll(
  "navEl.className = 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-onyx-850 text-left transition-all';",
  "navEl.className = 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-left transition-all font-medium';"
);
html = html.replaceAll(
  "activeNav.className = 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20 text-left transition-all';",
  "activeNav.className = 'w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-left transition-all';"
);

// 19. Fix initial filter buttons in HTML
html = html.replaceAll(
  'id="flt-all" class="px-2.5 py-1 rounded-lg bg-onyx-800 text-white font-semibold border border-white/[0.1] text-xs"',
  'id="flt-all" class="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold border border-slate-900 text-xs"'
);
html = html.replaceAll(
  'class="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-onyx-850 transition-colors text-xs flex items-center space-x-1"',
  'class="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs flex items-center space-x-1"'
);

// 20. Update dynamic org buttons in tenant menu
html = html.replaceAll(
  "${isCurrent ? 'bg-onyx-800 border border-brand-500/30' : ''}",
  "${isCurrent ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'hover:bg-slate-50'}"
);

fs.writeFileSync(consolePath, html, 'utf-8');
console.log('✓ Successfully transformed console.html to Homepage Light Executive Palette!');
