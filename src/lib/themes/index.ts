/**
 * Theme System
 *
 * Exports all themes and theme utilities for the public profile page.
 *
 * IMPORTANT: When adding new themes:
 * 1. Create the theme file in ./presets/
 * 2. Import it below
 * 3. Add to PRESET_THEMES
 * 4. Add the theme ID to shared/constants.js ALLOWED_THEMES array
 *    (backend uses this for validation)
 */

export * from './types';
export * from './css-sanitizer';

// Import preset themes
import { defaultTheme } from './presets/default';
import { minimalTheme } from './presets/minimal';
import { darkTheme } from './presets/dark';
import { vibrantTheme } from './presets/vibrant';
import { glassTheme } from './presets/glass';

import { ThemeConfig, ThemeSettings, THEME_CSS_PREFIX } from './types';

/**
 * All available preset themes
 *
 * NOTE: Theme IDs must match ALLOWED_THEMES in shared/constants.js
 */
export const PRESET_THEMES: Record<string, ThemeConfig> = {
  default: defaultTheme,
  minimal: minimalTheme,
  dark: darkTheme,
  vibrant: vibrantTheme,
  glass: glassTheme,
};

/**
 * Get a theme by ID
 */
export function getTheme(themeId: string): ThemeConfig {
  return PRESET_THEMES[themeId] || defaultTheme;
}

/**
 * Get list of all available themes
 */
export function getAllThemes(): ThemeConfig[] {
  return Object.values(PRESET_THEMES);
}

/**
 * Merge a base theme with user settings
 */
export function mergeThemeWithSettings(
  theme: ThemeConfig,
  settings: ThemeSettings
): ThemeConfig {
  return {
    ...theme,
    colors: { ...theme.colors, ...settings.colors },
    typography: { ...theme.typography, ...settings.typography },
    spacing: { ...theme.spacing, ...settings.spacing },
  };
}

/**
 * Convert a theme to CSS custom properties (variables)
 */
export function themeToCSSVars(theme: ThemeConfig): React.CSSProperties {
  const vars: Record<string, string> = {};

  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssKey = `${THEME_CSS_PREFIX}-${camelToKebab(key)}`;
    vars[cssKey] = value;
  });

  // Typography
  Object.entries(theme.typography).forEach(([key, value]) => {
    const cssKey = `${THEME_CSS_PREFIX}-${camelToKebab(key)}`;
    vars[cssKey] = value;
  });

  // Spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    const cssKey = `${THEME_CSS_PREFIX}-${camelToKebab(key)}`;
    vars[cssKey] = value;
  });

  // Glass effects (for 2025 themes)
  if (theme.glass) {
    Object.entries(theme.glass).forEach(([key, value]) => {
      if (key !== 'enabled') {
        const cssKey = `${THEME_CSS_PREFIX}-glass-${camelToKebab(key)}`;
        vars[cssKey] = String(value);
      }
    });
  }

  // Animations (for 2025 themes)
  if (theme.animations) {
    Object.entries(theme.animations).forEach(([key, value]) => {
      if (key !== 'enabled') {
        const cssKey = `${THEME_CSS_PREFIX}-anim-${camelToKebab(key)}`;
        vars[cssKey] = String(value);
      }
    });
  }

  return vars as React.CSSProperties;
}

/**
 * Get the data attribute for theme version (used for conditional CSS)
 */
export function getThemeVersionAttribute(theme: ThemeConfig): string {
  return theme.version || '2024';
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// Re-export themes for direct access
export { defaultTheme, minimalTheme, darkTheme, vibrantTheme, glassTheme };
