/**
 * Shared Constants
 *
 * This file contains constants shared between frontend and backend.
 * When adding new themes, update this file and both frontend/backend will use it.
 */

// Available theme IDs - MUST match frontend PRESET_THEMES keys
export const ALLOWED_THEMES = ['default', 'minimal', 'dark', 'vibrant', 'glass'];

// Service duration options (in minutes)
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

// Maximum file upload size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum number of profile buttons
export const MAX_PROFILE_BUTTONS = 6;
