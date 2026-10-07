/**
 * VANNI Design System — Motion & Transition Tokens
 * Functional, crisp micro-interactions that never delay workflow completion.
 */

export const motion = {
  // Durations in milliseconds
  duration: {
    instant: '75ms',
    fast: '150ms',      // Button active states, hover transitions, toggle switches
    normal: '200ms',    // Dropdown reveals, badge state changes, tab switches
    slow: '300ms',      // Drawer slide-out, modal fade-in
    deliberate: '450ms',// Voice waveform breathing, call status pulsing
  },

  // Easing curves
  easing: {
    standard: 'cubic-bezier(0.2, 0.0, 0, 1.0)',       // Natural acceleration to decel
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',      // Inbound elements (modals, drawers)
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',        // Exiting elements
    linear: 'linear',                                  // Continuous animations (audio waveform)
  },

  // Pre-assembled transition rules
  transitions: {
    fast: 'all 150ms cubic-bezier(0.2, 0.0, 0, 1.0)',
    normal: 'all 200ms cubic-bezier(0.2, 0.0, 0, 1.0)',
    slide: 'transform 300ms cubic-bezier(0.0, 0.0, 0.2, 1)',
    fade: 'opacity 200ms cubic-bezier(0.2, 0.0, 0, 1.0)',
  },
} as const;
