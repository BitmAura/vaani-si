/**
 * VANNI Design System — Border Radius Tokens
 * Restrained radii avoiding toy-like/overly pill-shaped cards.
 */

export const radius = {
  none: '0px',
  sm: '4px',      // Small controls, badges, inner tags
  md: '6px',      // Standard inputs, buttons, select menus
  lg: '8px',      // Standard cards, table containers, popovers
  xl: '12px',     // Modals, slide-over drawer corners
  '2xl': '16px',  // Primary dashboard wrapper panels
  full: '9999px', // Circular status dots, avatars, and pill badges
} as const;
