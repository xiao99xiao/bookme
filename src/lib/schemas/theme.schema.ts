/**
 * Theme Zod Schemas
 *
 * Schema definitions for theme-related API responses.
 */

import { z } from 'zod';

// Theme ID enum
export const ThemeIdSchema = z.enum(['default', 'minimal', 'dark', 'vibrant']);

// Theme colors schema
export const ThemeColorsSchema = z.object({
  background: z.string(),
  backgroundSecondary: z.string(),
  textPrimary: z.string(),
  textSecondary: z.string(),
  textMuted: z.string(),
  cardBackground: z.string(),
  cardBorder: z.string(),
  cardHover: z.string(),
  accent: z.string(),
  accentLight: z.string(),
  badgeBackground: z.string(),
  badgeText: z.string(),
  buttonPrimary: z.string(),
  buttonPrimaryText: z.string(),
  buttonSecondary: z.string(),
  buttonSecondaryText: z.string(),
  starColor: z.string(),
  divider: z.string(),
});

// Theme typography schema
export const ThemeTypographySchema = z.object({
  fontHeading: z.string(),
  fontBody: z.string(),
  baseFontSize: z.string(),
  headingWeight: z.string(),
  bodyWeight: z.string(),
});

// Theme spacing schema
export const ThemeSpacingSchema = z.object({
  cardPadding: z.string(),
  sectionGap: z.string(),
  borderRadius: z.string(),
  cardRadius: z.string(),
  avatarRadius: z.string(),
  badgeRadius: z.string(),
  borderWidth: z.string(),
});

// Complete theme config schema
export const ThemeConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  preview: z.string().optional(),
  colors: ThemeColorsSchema,
  typography: ThemeTypographySchema,
  spacing: ThemeSpacingSchema,
});

// Theme settings schema (partial overrides)
export const ThemeSettingsSchema = z.object({
  colors: ThemeColorsSchema.partial().optional(),
  typography: ThemeTypographySchema.partial().optional(),
  spacing: ThemeSpacingSchema.partial().optional(),
});

// GET /api/user/:userId/theme response
export const UserThemeResponseSchema = z.object({
  theme: z.string(),
  custom_css: z.string().nullable(),
  settings: z.record(z.unknown()).default({}),
});

// PUT /api/user/theme request
export const UpdateThemeRequestSchema = z.object({
  theme: ThemeIdSchema.optional(),
  custom_css: z.string().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

// PUT /api/user/theme response
export const UpdateThemeResponseSchema = z.object({
  success: z.boolean(),
  theme: z.string(),
  custom_css: z.string().nullable(),
  settings: z.record(z.unknown()),
});

// Type exports
export type ThemeId = z.infer<typeof ThemeIdSchema>;
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;
export type ThemeTypography = z.infer<typeof ThemeTypographySchema>;
export type ThemeSpacing = z.infer<typeof ThemeSpacingSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type ThemeSettings = z.infer<typeof ThemeSettingsSchema>;
export type UserThemeResponse = z.infer<typeof UserThemeResponseSchema>;
export type UpdateThemeRequest = z.infer<typeof UpdateThemeRequestSchema>;
export type UpdateThemeResponse = z.infer<typeof UpdateThemeResponseSchema>;
