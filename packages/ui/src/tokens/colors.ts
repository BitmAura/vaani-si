/**
 * VANNI Design System — Semantic Color Tokens
 * Designed for enterprise clarity, high contrast, and zero neon/AI-cliché styling.
 * Default: Restrained Light Mode. Prepared for Dark Mode parity.
 */

export const colors = {
  light: {
    // Canvas & Surfaces
    background: '#F8FAFC',       // Slate-50: Crisp, clean base background
    surface: '#FFFFFF',          // Pure White: Primary card and table background
    surfaceElevated: '#FFFFFF',  // Elevated panels (popovers, dropdowns)
    surfaceSubdued: '#F1F5F9',   // Slate-100: Table headers, input fills, subtle backdrops

    // Borders & Dividers
    border: '#E2E8F0',           // Slate-200: Hairline structural border
    borderSubdued: '#F1F5F9',    // Slate-100: Secondary inner dividing line
    borderStrong: '#CBD5E1',     // Slate-300: Active or focused border

    // Typography
    textPrimary: '#0F172A',      // Slate-900: High-contrast primary reading text
    textSecondary: '#475569',    // Slate-600: Body copy and supporting descriptions
    textMuted: '#64748B',        // Slate-500: Metadata, timestamps, captions
    textDisabled: '#94A3B8',     // Slate-400: Inactive states

    // Primary Brand (Executive Navy / Deep Slate)
    primary: '#0F172A',          // Deep Slate-900: Confident, calm authority
    primaryHover: '#1E293B',     // Slate-800
    primaryForeground: '#FFFFFF',// Crisp white on primary buttons

    // Brand Accent (Professional Cobalt)
    accent: '#2563EB',           // Blue-600: Actionable interactive links
    accentSubtle: '#EFF6FF',     // Blue-50: Badge and active highlight backgrounds
    accentForeground: '#1D4ED8', // Blue-700: High-contrast text on accent backgrounds

    // Semantic Status Tokens
    success: '#059669',          // Emerald-600: Live calls, verified leads, confirmed slots
    successSubtle: '#ECFDF5',    // Emerald-50: Tag background
    successForeground: '#047857',// Emerald-700: Tag text

    warning: '#D97706',          // Amber-600: Warm leads, pending actions, callback required
    warningSubtle: '#FFFBEB',    // Amber-50: Tag background
    warningForeground: '#B45309',// Amber-700: Tag text

    danger: '#DC2626',           // Red-600: Interrupted, failed calls, emergency escalation
    dangerSubtle: '#FEF2F2',     // Red-50: Tag background
    dangerForeground: '#B91C1C', // Red-700: Tag text

    info: '#0284C7',             // Sky-600: System telemetry, educational callouts
    infoSubtle: '#F0F9FF',       // Sky-50: Tag background
    infoForeground: '#0369A1',   // Sky-700: Tag text
  },
  dark: {
    // Dark mode ready variables for zero-cost parity
    background: '#090D16',
    surface: '#0F172A',
    surfaceElevated: '#1E293B',
    surfaceSubdued: '#0B1120',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubdued: 'rgba(255, 255, 255, 0.04)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    textDisabled: '#64748B',
    primary: '#F8FAFC',
    primaryHover: '#E2E8F0',
    primaryForeground: '#0F172A',
    accent: '#3B82F6',
    accentSubtle: 'rgba(59, 130, 246, 0.1)',
    accentForeground: '#60A5FA',
    success: '#10B981',
    successSubtle: 'rgba(16, 185, 129, 0.1)',
    successForeground: '#34D399',
    warning: '#F59E0B',
    warningSubtle: 'rgba(245, 158, 11, 0.1)',
    warningForeground: '#FBBF24',
    danger: '#EF4444',
    dangerSubtle: 'rgba(239, 68, 68, 0.1)',
    dangerForeground: '#F87171',
    info: '#38BDF8',
    infoSubtle: 'rgba(56, 189, 248, 0.1)',
    infoForeground: '#7DD3FC',
  },
} as const;

export type ColorTheme = typeof colors.light;
