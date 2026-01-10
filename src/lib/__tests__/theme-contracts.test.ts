/**
 * Theme API Contract Tests
 *
 * These tests verify that theme-related API responses match the expected schema.
 */

import { describe, it, expect } from 'vitest';
import {
  ThemeIdSchema,
  ThemeColorsSchema,
  ThemeConfigSchema,
  UserThemeResponseSchema,
  UpdateThemeRequestSchema,
  UpdateThemeResponseSchema,
} from '../schemas';

describe('Theme API Contracts', () => {
  describe('ThemeIdSchema', () => {
    it('validates all valid theme IDs', () => {
      const validIds = ['default', 'minimal', 'dark', 'vibrant'];
      validIds.forEach((id) => {
        expect(() => ThemeIdSchema.parse(id)).not.toThrow();
      });
    });

    it('rejects invalid theme ID', () => {
      expect(() => ThemeIdSchema.parse('invalid-theme')).toThrow();
    });

    it('rejects empty string', () => {
      expect(() => ThemeIdSchema.parse('')).toThrow();
    });
  });

  describe('ThemeColorsSchema', () => {
    const validColors = {
      background: '#ffffff',
      backgroundSecondary: '#fafafa',
      textPrimary: '#000000',
      textSecondary: '#666666',
      textMuted: '#aaaaaa',
      cardBackground: '#ffffff',
      cardBorder: '#eeeeee',
      cardHover: '#f9f9f9',
      accent: '#3B9EF9',
      accentLight: '#EFF7FF',
      badgeBackground: '#fcf9f4',
      badgeText: '#666666',
      buttonPrimary: '#000000',
      buttonPrimaryText: '#ffffff',
      buttonSecondary: '#f3f3f3',
      buttonSecondaryText: '#000000',
      starColor: '#ffd43c',
      divider: '#eeeeee',
    };

    it('validates complete color config', () => {
      expect(() => ThemeColorsSchema.parse(validColors)).not.toThrow();
    });

    it('rejects missing required color', () => {
      const { background, ...incomplete } = validColors;
      expect(() => ThemeColorsSchema.parse(incomplete)).toThrow();
    });

    it('accepts any string for color values', () => {
      const withRgb = { ...validColors, background: 'rgb(255, 255, 255)' };
      expect(() => ThemeColorsSchema.parse(withRgb)).not.toThrow();
    });
  });

  describe('ThemeConfigSchema', () => {
    const validThemeConfig = {
      id: 'default',
      name: 'Classic',
      description: 'The original BookMe look',
      colors: {
        background: '#ffffff',
        backgroundSecondary: '#fafafa',
        textPrimary: '#000000',
        textSecondary: '#666666',
        textMuted: '#aaaaaa',
        cardBackground: '#ffffff',
        cardBorder: '#eeeeee',
        cardHover: '#f9f9f9',
        accent: '#3B9EF9',
        accentLight: '#EFF7FF',
        badgeBackground: '#fcf9f4',
        badgeText: '#666666',
        buttonPrimary: '#000000',
        buttonPrimaryText: '#ffffff',
        buttonSecondary: '#f3f3f3',
        buttonSecondaryText: '#000000',
        starColor: '#ffd43c',
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

    it('validates complete theme config', () => {
      expect(() => ThemeConfigSchema.parse(validThemeConfig)).not.toThrow();
    });

    it('validates theme config with optional preview', () => {
      const withPreview = {
        ...validThemeConfig,
        preview: 'https://example.com/preview.png',
      };
      expect(() => ThemeConfigSchema.parse(withPreview)).not.toThrow();
    });

    it('rejects theme config missing required fields', () => {
      const { id, ...incomplete } = validThemeConfig;
      expect(() => ThemeConfigSchema.parse(incomplete)).toThrow();
    });
  });

  describe('UserThemeResponseSchema', () => {
    it('validates GET /api/user/:userId/theme response', () => {
      const response = {
        theme: 'default',
        custom_css: null,
        settings: {},
      };
      expect(() => UserThemeResponseSchema.parse(response)).not.toThrow();
    });

    it('validates response with custom CSS', () => {
      const response = {
        theme: 'dark',
        custom_css: '.pp-name { color: red; }',
        settings: {},
      };
      expect(() => UserThemeResponseSchema.parse(response)).not.toThrow();
    });

    it('validates response with theme settings', () => {
      const response = {
        theme: 'minimal',
        custom_css: null,
        settings: {
          colors: {
            accent: '#ff0000',
          },
        },
      };
      expect(() => UserThemeResponseSchema.parse(response)).not.toThrow();
    });

    it('applies default empty settings', () => {
      const response = {
        theme: 'default',
        custom_css: null,
      };
      const parsed = UserThemeResponseSchema.parse(response);
      expect(parsed.settings).toEqual({});
    });
  });

  describe('UpdateThemeRequestSchema', () => {
    it('validates request with theme only', () => {
      const request = { theme: 'dark' };
      expect(() => UpdateThemeRequestSchema.parse(request)).not.toThrow();
    });

    it('validates request with custom CSS only', () => {
      const request = { custom_css: '.pp-name { color: blue; }' };
      expect(() => UpdateThemeRequestSchema.parse(request)).not.toThrow();
    });

    it('validates request with null custom CSS', () => {
      const request = { theme: 'default', custom_css: null };
      expect(() => UpdateThemeRequestSchema.parse(request)).not.toThrow();
    });

    it('validates request with settings only', () => {
      const request = {
        settings: {
          colors: { accent: '#00ff00' },
        },
      };
      expect(() => UpdateThemeRequestSchema.parse(request)).not.toThrow();
    });

    it('validates complete request', () => {
      const request = {
        theme: 'vibrant',
        custom_css: '.pp-badge { border-radius: 20px; }',
        settings: {
          typography: { baseFontSize: '18px' },
        },
      };
      expect(() => UpdateThemeRequestSchema.parse(request)).not.toThrow();
    });

    it('rejects invalid theme ID', () => {
      const request = { theme: 'nonexistent' };
      expect(() => UpdateThemeRequestSchema.parse(request)).toThrow();
    });
  });

  describe('UpdateThemeResponseSchema', () => {
    it('validates PUT /api/user/theme response', () => {
      const response = {
        success: true,
        theme: 'dark',
        custom_css: null,
        settings: {},
      };
      expect(() => UpdateThemeResponseSchema.parse(response)).not.toThrow();
    });

    it('validates response with custom CSS', () => {
      const response = {
        success: true,
        theme: 'minimal',
        custom_css: '.pp-container { padding: 20px; }',
        settings: { colors: { background: '#f0f0f0' } },
      };
      expect(() => UpdateThemeResponseSchema.parse(response)).not.toThrow();
    });

    it('rejects response without success field', () => {
      const response = {
        theme: 'default',
        custom_css: null,
        settings: {},
      };
      expect(() => UpdateThemeResponseSchema.parse(response)).toThrow();
    });
  });
});
