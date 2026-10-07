/**
 * VANNI Design System — Elevation & Shadow Tokens
 * Disciplined enterprise shadows (Stripe / Linear caliber).
 * Hairline borders provide structure; shadows provide subtle depth, not floating blobs.
 */

export const shadows = {
  none: 'none',
  // Low elevation for hoverable cards, table rows
  sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
  // Standard card elevation
  default: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
  // Dropdowns, popovers, tooltips
  md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
  // Slide-out drawers, command palette
  lg: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
  // Confirmation dialogs, modal backdrops
  xl: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
} as const;
