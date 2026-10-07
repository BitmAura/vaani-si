/**
 * VANNI Design System — Typography Tokens
 * Clean modern Latin sans-serif with native Kannada glyph fallback and tabular figures for numbers.
 */

export const typography = {
  fontFamilies: {
    // Primary Latin UI font with native Kannada fallback
    sans: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Noto Sans Kannada"',
      '"Kannada Sangam MN"',
      'Tunga',
      'sans-serif',
    ].join(', '),

    // Specialized Kannada family for editorial/prominent regional phrases
    kannada: [
      '"Noto Sans Kannada"',
      '"Kannada Sangam MN"',
      'Tunga',
      'sans-serif',
    ].join(', '),

    // Tabular figures and monospace metrics for call durations, phone numbers, and timestamps
    mono: [
      '"JetBrains Mono"',
      'ui-monospace',
      'SFMono-Regular',
      'Menlo',
      'Monaco',
      'Consolas',
      'monospace',
    ].join(', '),
  },

  // Type Scale & Hierarchy
  scale: {
    display: {
      fontSize: '2.5rem',     // 40px
      lineHeight: '3rem',     // 48px
      fontWeight: '700',
      letterSpacing: '-0.025em',
    },
    h1: {
      fontSize: '2rem',       // 32px
      lineHeight: '2.5rem',   // 40px
      fontWeight: '700',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '1.5rem',     // 24px
      lineHeight: '2rem',     // 32px
      fontWeight: '600',
      letterSpacing: '-0.015em',
    },
    h3: {
      fontSize: '1.25rem',    // 20px
      lineHeight: '1.75rem',  // 28px
      fontWeight: '600',
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1rem',       // 16px
      lineHeight: '1.5rem',   // 24px
      fontWeight: '600',
      letterSpacing: '-0.005em',
    },
    body: {
      fontSize: '0.875rem',   // 14px (Standard B2B SaaS density)
      lineHeight: '1.375rem', // 22px
      fontWeight: '400',
      letterSpacing: '0',
    },
    bodySmall: {
      fontSize: '0.8125rem',  // 13px (Subtle descriptions, table secondary cells)
      lineHeight: '1.25rem',  // 20px
      fontWeight: '400',
      letterSpacing: '0',
    },
    caption: {
      fontSize: '0.75rem',    // 12px (Timestamps, metadata, tags)
      lineHeight: '1rem',     // 16px
      fontWeight: '500',
      letterSpacing: '0.01em',
    },
    label: {
      fontSize: '0.75rem',    // 12px
      lineHeight: '1rem',     // 16px
      fontWeight: '600',
      letterSpacing: '0.01em',
      textTransform: 'uppercase' as const,
    },
    button: {
      fontSize: '0.875rem',   // 14px
      lineHeight: '1.25rem',  // 20px
      fontWeight: '600',
      letterSpacing: '0',
    },
    table: {
      fontSize: '0.8125rem',  // 13px
      lineHeight: '1.25rem',
      fontWeight: '400',
      fontVariantNumeric: 'tabular-nums',
    },
    code: {
      fontSize: '0.75rem',    // 12px
      lineHeight: '1.125rem',
      fontWeight: '500',
      fontFamily: 'monospace',
    },
  },
} as const;
