/**
 * Vibrant Theme
 *
 * Colorful and energetic with gradient accents.
 * Perfect for creative professionals.
 */

import { ThemeConfig } from '../types';

export const vibrantTheme: ThemeConfig = {
  id: 'vibrant',
  name: 'Vibrant',
  description: 'Colorful and energetic with playful accents',

  colors: {
    // Background - soft warm white
    background: '#fffbf5',
    backgroundSecondary: '#fff5eb',

    // Text
    textPrimary: '#1f1f1f',
    textSecondary: '#525252',
    textMuted: '#9ca3af',

    // Card - white with colorful border
    cardBackground: '#ffffff',
    cardBorder: '#fde68a',
    cardHover: '#fef9c3',

    // Accent - vibrant orange/coral
    accent: '#f97316',
    accentLight: '#ffedd5',

    // Badge - warm yellow
    badgeBackground: '#fef3c7',
    badgeText: '#92400e',

    // Button - gradient-ready colors
    buttonPrimary: '#f97316',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: '#fef3c7',
    buttonSecondaryText: '#92400e',

    // Link button - warm, playful
    linkButtonBackground: '#ffffff',
    linkButtonText: '#92400e',
    linkButtonBorder: '#fde68a',
    linkButtonHoverBackground: '#fef9c3',

    // Star - orange to match theme
    starColor: '#fb923c',

    // Divider - warm
    divider: '#fde68a',
  },

  typography: {
    fontHeading: '"Poppins", sans-serif',
    fontBody: '"Inter", sans-serif',
    baseFontSize: '16px',
    headingWeight: '700',
    bodyWeight: '400',
  },

  spacing: {
    cardPadding: '24px',
    sectionGap: '36px',
    borderRadius: '16px',
    cardRadius: '20px',
    avatarRadius: '50%',
    badgeRadius: '999px',
    borderWidth: '2px',
  },
};
