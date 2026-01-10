/**
 * Minimal Theme
 *
 * Clean, spacious design with focus on content.
 * Features borderless cards and subtle shadows.
 */

import { ThemeConfig } from '../types';

export const minimalTheme: ThemeConfig = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Clean and spacious with borderless cards and subtle shadows',

  colors: {
    // Background
    background: '#ffffff',
    backgroundSecondary: '#f8f8f8',

    // Text
    textPrimary: '#1a1a1a',
    textSecondary: '#737373',
    textMuted: '#a3a3a3',

    // Card - borderless with subtle background
    cardBackground: '#fafafa',
    cardBorder: 'transparent',
    cardHover: '#f5f5f5',

    // Accent - subtle blue-gray
    accent: '#6366f1',
    accentLight: '#eef2ff',

    // Badge - very subtle
    badgeBackground: '#f5f5f5',
    badgeText: '#525252',

    // Button
    buttonPrimary: '#1a1a1a',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: '#f5f5f5',
    buttonSecondaryText: '#1a1a1a',

    // Link button - borderless, subtle
    linkButtonBackground: '#fafafa',
    linkButtonText: '#1a1a1a',
    linkButtonBorder: 'transparent',
    linkButtonHoverBackground: '#f0f0f0',

    // Star
    starColor: '#fbbf24',

    // Divider - very light
    divider: '#f0f0f0',
  },

  typography: {
    fontHeading: '"Inter", sans-serif',
    fontBody: '"Inter", sans-serif',
    baseFontSize: '15px',
    headingWeight: '600',
    bodyWeight: '400',
  },

  spacing: {
    cardPadding: '28px',
    sectionGap: '40px',
    borderRadius: '8px',
    cardRadius: '12px',
    avatarRadius: '50%',
    badgeRadius: '6px',
    borderWidth: '0px',
  },
};
