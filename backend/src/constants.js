/**
 * Backend Constants
 *
 * Constants used by the backend service.
 * Keep in sync with frontend shared/constants.js
 */

// Available theme IDs - MUST match frontend PRESET_THEMES keys in src/lib/themes/index.ts
export const ALLOWED_THEMES = ['default', 'minimal', 'dark', 'vibrant', 'glass'];

// Service duration options (in minutes)
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

// Maximum file upload size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum number of profile buttons
export const MAX_PROFILE_BUTTONS = 6;
