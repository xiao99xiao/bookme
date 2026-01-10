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

  // Link button colors (for custom profile links)
  linkButtonBackground: string;
  linkButtonText: string;
  linkButtonBorder: string;
  linkButtonHoverBackground: string;

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
 * Glass/Glassmorphism effect configuration (2025 design trend)
 */
export interface ThemeGlassEffects {
  enabled: boolean;
  blur: string;
  blurLg: string;
  backgroundColor: string;
  backgroundColorHover: string;
  borderColor: string;
  borderColorHover: string;
  shadowColor: string;
}

/**
 * Animation configuration for micro-interactions (2025 design trend)
 */
export interface ThemeAnimations {
  enabled: boolean;
  timingSpring: string;
  timingEaseOut: string;
  duration: string;
  durationFast: string;
  hoverScale: string;
  hoverLift: string;
  pressScale: string;
  staggerDelay: string;
}

/**
 * Theme version for backwards compatibility
 */
export type ThemeVersion = '2024' | '2025';

/**
 * Complete theme configuration
 */
export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  preview?: string;

  /** Theme version - '2025' enables glass effects and animations */
  version?: ThemeVersion;

  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;

  /** Glass/Glassmorphism effects (optional, for 2025 themes) */
  glass?: ThemeGlassEffects;

  /** Animation settings (optional, for 2025 themes) */
  animations?: ThemeAnimations;
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

  // Glass effect overrides (2025 themes)
  glass?: Partial<ThemeGlassEffects>;

  // Animation overrides (2025 themes)
  animations?: Partial<ThemeAnimations>;
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
 * Profile link button configuration
 */
export interface ProfileButton {
  id: string;
  label: string;
  url: string;
  icon?: string; // Optional icon name (e.g., 'twitter', 'instagram', 'link')
  order: number;
}

/**
 * CSS variable prefix for theme variables
 */
export const THEME_CSS_PREFIX = '--pp' as const; // pp = public-profile

/**
 * CSS class prefix for public profile components
 */
export const THEME_CLASS_PREFIX = 'pp' as const;
