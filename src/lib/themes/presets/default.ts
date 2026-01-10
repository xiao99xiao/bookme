/**
 * Default Theme - Classic
 *
 * The original BookMe styling, warm and professional.
 */

import { ThemeConfig } from '../types';

export const defaultTheme: ThemeConfig = {
  id: 'default',
  name: 'Classic',
  description: 'The original BookMe look - warm, professional, and inviting',

  colors: {
    // Background
    background: '#ffffff',
    backgroundSecondary: '#fafafa',

    // Text
    textPrimary: '#000000',
    textSecondary: '#666666',
    textMuted: '#aaaaaa',

    // Card
    cardBackground: '#ffffff',
    cardBorder: '#eeeeee',
    cardHover: '#f9f9f9',

    // Accent
    accent: '#3B9EF9',
    accentLight: '#EFF7FF',

    // Badge
    badgeBackground: '#fcf9f4',
    badgeText: '#666666',

    // Button
    buttonPrimary: '#000000',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: '#f3f3f3',
    buttonSecondaryText: '#000000',

    // Star
    starColor: '#ffd43c',

    // Divider
    divider: '#eeeeee',
  },

  typography: {
    fontHeading: '"Raleway", sans-serif',
    fontBody: '"Inter", sans-serif',
    baseFontSize: '16px',
    headingWeight: '700',
    bodyWeight: '400',
  },

  spacing: {
    cardPadding: '24px',
    sectionGap: '32px',
    borderRadius: '12px',
    cardRadius: '16px',
    avatarRadius: '40px',
    badgeRadius: '12px',
    borderWidth: '1px',
  },
};
