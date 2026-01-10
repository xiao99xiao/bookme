/**
 * Dark Theme
 *
 * Elegant dark mode with subtle gradients and glow effects.
 * Easy on the eyes, professional look.
 */

import { ThemeConfig } from '../types';

export const darkTheme: ThemeConfig = {
  id: 'dark',
  name: 'Dark',
  description: 'Elegant dark mode with subtle glow effects',

  colors: {
    // Background - deep charcoal
    background: '#0f0f0f',
    backgroundSecondary: '#1a1a1a',

    // Text
    textPrimary: '#f5f5f5',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',

    // Card - slightly lighter than background
    cardBackground: '#1f1f1f',
    cardBorder: '#2a2a2a',
    cardHover: '#262626',

    // Accent - vibrant blue
    accent: '#3b82f6',
    accentLight: '#1e3a5f',

    // Badge - dark with accent hint
    badgeBackground: '#262626',
    badgeText: '#d4d4d4',

    // Button
    buttonPrimary: '#f5f5f5',
    buttonPrimaryText: '#0f0f0f',
    buttonSecondary: '#2a2a2a',
    buttonSecondaryText: '#f5f5f5',

    // Link button - dark style
    linkButtonBackground: '#1f1f1f',
    linkButtonText: '#f5f5f5',
    linkButtonBorder: '#3a3a3a',
    linkButtonHoverBackground: '#2a2a2a',

    // Star - golden glow
    starColor: '#fbbf24',

    // Divider
    divider: '#2a2a2a',
  },

  typography: {
    fontHeading: '"Inter", sans-serif',
    fontBody: '"Inter", sans-serif',
    baseFontSize: '16px',
    headingWeight: '600',
    bodyWeight: '400',
  },

  spacing: {
    cardPadding: '24px',
    sectionGap: '32px',
    borderRadius: '12px',
    cardRadius: '16px',
    avatarRadius: '40px',
    badgeRadius: '10px',
    borderWidth: '1px',
  },
};
