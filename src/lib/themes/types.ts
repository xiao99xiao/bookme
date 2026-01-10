/**
 * Theme System Type Definitions
 *
 * Defines the structure for public profile page themes.
 */

/**
 * Color configuration for a theme
 */
export interface ThemeColors {
  // Background colors
  background: string;
  backgroundSecondary: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Card colors
  cardBackground: string;
  cardBorder: string;
  cardHover: string;

  // Accent colors
  accent: string;
  accentLight: string;

  // Badge colors
  badgeBackground: string;
  badgeText: string;

  // Button colors
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondary: string;
  buttonSecondaryText: string;

  // Star/rating color
  starColor: string;

  // Divider color
  divider: string;
}

/**
 * Typography configuration for a theme
 */
export interface ThemeTypography {
  fontHeading: string;
  fontBody: string;
  baseFontSize: string;
  headingWeight: string;
  bodyWeight: string;
}

/**
 * Spacing and border configuration for a theme
 */
export interface ThemeSpacing {
  cardPadding: string;
  sectionGap: string;
  borderRadius: string;
  cardRadius: string;
  avatarRadius: string;
  badgeRadius: string;
  borderWidth: string;
}

/**
 * Complete theme configuration
 */
export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  preview?: string;

  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
}

/**
 * Theme settings stored in database (user customizations)
 */
export interface ThemeSettings {
  // Color overrides
  colors?: Partial<ThemeColors>;

  // Typography overrides
  typography?: Partial<ThemeTypography>;

  // Spacing overrides
  spacing?: Partial<ThemeSpacing>;
}

/**
 * User theme data from API
 */
export interface UserThemeData {
  theme: string;
  custom_css: string | null;
  settings: ThemeSettings;
}

/**
 * CSS variable prefix for theme variables
 */
export const THEME_CSS_PREFIX = '--pp' as const; // pp = public-profile

/**
 * CSS class prefix for public profile components
 */
export const THEME_CLASS_PREFIX = 'pp' as const;
