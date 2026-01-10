/**
 * Glass 2025 Theme - Liquid Glass Design
 *
 * Modern glassmorphism with Apple Liquid Glass aesthetics,
 * spring physics animations, and elevated minimalism.
 */

import { ThemeConfig } from '../types';

export const glassTheme: ThemeConfig = {
  id: 'glass',
  name: 'Glass 2025',
  description: 'Modern glassmorphism with fluid animations and elevated aesthetics',
  version: '2025',

  colors: {
    // Background - subtle gradient-ready
    background: '#f8f9fc',
    backgroundSecondary: '#eef1f8',

    // Text - high contrast
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',

    // Card - translucent glass
    cardBackground: 'rgba(255, 255, 255, 0.7)',
    cardBorder: 'rgba(255, 255, 255, 0.4)',
    cardHover: 'rgba(255, 255, 255, 0.85)',

    // Accent - modern indigo
    accent: '#6366f1',
    accentLight: 'rgba(99, 102, 241, 0.1)',

    // Badge - glass-style
    badgeBackground: 'rgba(99, 102, 241, 0.1)',
    badgeText: '#6366f1',

    // Button - refined
    buttonPrimary: '#0f172a',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: 'rgba(255, 255, 255, 0.6)',
    buttonSecondaryText: '#0f172a',

    // Link button - glass effect
    linkButtonBackground: 'rgba(255, 255, 255, 0.5)',
    linkButtonText: '#0f172a',
    linkButtonBorder: 'rgba(255, 255, 255, 0.3)',
    linkButtonHoverBackground: 'rgba(255, 255, 255, 0.7)',

    // Star
    starColor: '#f59e0b',

    // Divider - subtle
    divider: 'rgba(148, 163, 184, 0.2)',
  },

  typography: {
    fontHeading: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    fontBody: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    baseFontSize: '17px',
    headingWeight: '600',
    bodyWeight: '400',
  },

  spacing: {
    cardPadding: '28px',
    sectionGap: '36px',
    borderRadius: '20px',
    cardRadius: '24px',
    avatarRadius: '50px',
    badgeRadius: '14px',
    borderWidth: '1px',
  },

  glass: {
    enabled: true,
    blur: '16px',
    blurLg: '24px',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColorHover: 'rgba(255, 255, 255, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderColorHover: 'rgba(255, 255, 255, 0.3)',
    shadowColor: 'rgba(31, 38, 135, 0.15)',
  },

  animations: {
    enabled: true,
    timingSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    timingEaseOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    duration: '0.3s',
    durationFast: '0.15s',
    hoverScale: '1.02',
    hoverLift: '-4px',
    pressScale: '0.98',
    staggerDelay: '50ms',
  },
};
