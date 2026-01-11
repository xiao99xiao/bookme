/**
 * Internationalization (i18n) System
 *
 * This module provides centralized string management for the application.
 * All user-facing text should be defined here for easy maintenance and future multi-language support.
 *
 * Usage:
 *   import { t } from '@/lib/i18n';
 *   <p>{t.booking.completed}</p>
 *   <p>{t.toast.success.bookingCompleted}</p>
 */

import { en } from './locales/en';

// Current locale - can be made dynamic for multi-language support
export const currentLocale = 'en';

// Export the translation object
export const t = en;

// Type for the translation object
export type Translations = typeof en;

// Helper function for interpolation
// Usage: interpolate(t.common.greeting, { name: 'John' }) => "Hello, John!"
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? `{{${key}}}`));
}

// Export locale for reference
export { en };
