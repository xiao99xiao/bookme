/**
 * User/Profile Routes
 * 
 * This module handles user profile and username management endpoints.
 * Includes both authenticated and public user operations.
 * 
 * Usage:
 * ```javascript
 * import userRoutes from './routes/users.js';
 * userRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getDb } from '../middleware/auth.js';
import { ALLOWED_THEMES } from '../constants.js';

// Get database client (Railway PostgreSQL)
const db = getDb();

/**
 * Create user/profile routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function userRoutes(app) {

  /**
   * GET /api/profile
   *
   * Get or create authenticated user's profile.
   * This endpoint either returns an existing user profile or creates a new one
   * if the user doesn't exist in the database.
   * Automatically updates the user's timezone based on the client's browser timezone.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   * - X-Client-Timezone: Browser timezone (optional)
   *
   * Response:
   * - Full user profile object
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with user profile or error
   */
  app.get('/api/profile', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const privyUser = c.get('privyUser');

      // Get client timezone from header
      const clientTimezone = c.req.header('X-Client-Timezone') || 'UTC';

      // Check if user exists
      const { data: existingUser, error: fetchError } = await db
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingUser) {
        // Auto-update timezone if it's different from the current one
        if (existingUser.timezone !== clientTimezone) {
          console.log(`Auto-updating timezone for user ${userId}: ${existingUser.timezone} -> ${clientTimezone}`);

          const { data: updatedUser, error: updateError } = await db
            .from('users')
            .update({
              timezone: clientTimezone,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

          if (updateError) {
            console.error('Failed to auto-update timezone:', updateError);
            // Still return the existing user even if timezone update fails
            return c.json(existingUser);
          }

          return c.json(updatedUser);
        }

        return c.json(existingUser);
      }
      
      // Create new user if doesn't exist
      const emailAccount = privyUser.linkedAccounts?.find(acc => acc.type === 'email');
      const email = emailAccount?.address || `${privyUser.userId}@privy.user`;

      // Generate appropriate display name
      let displayName;
      if (emailAccount?.address) {
        // Use email username for real email accounts
        displayName = emailAccount.address.split('@')[0];
      } else {
        // For non-email accounts, use truncated Privy ID (matches frontend logic)
        displayName = privyUser.userId?.substring(0, 8) || 'User';
      }

      const { data: newUser, error: createError } = await db
        .from('users')
        .insert({
          id: userId,
          email: email,
          display_name: displayName,
          timezone: clientTimezone,
          is_verified: false,
          rating: 0,
          review_count: 0,
          total_earnings: 0,
          total_spent: 0,
          is_provider: false,
          onboarding_completed: false
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Create user error:', createError);
        return c.json({ error: 'Failed to create user' }, 500);
      }
      
      return c.json(newUser);
    } catch (error) {
      console.error('Profile error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * PATCH /api/profile
   * 
   * Update authenticated user's profile information.
   * Automatically sets updated_at timestamp and prevents updates to
   * protected fields (id, email, created_at).
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - Any user profile fields to update (except protected fields)
   * 
   * Response:
   * - Updated user profile object
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with updated profile or error
   */
  app.patch('/api/profile', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const updates = await c.req.json();

      console.log('Profile update request for user:', userId);
      console.log('Updates received:', updates);

      // Remove any fields that shouldn't be updated
      delete updates.id;
      delete updates.email;
      delete updates.created_at;

      const { data, error } = await db
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Profile update database error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return c.json({ error: error.message || 'Failed to update profile' }, 500);
      }

      console.log('Profile updated successfully:', data.id);
      return c.json(data);
    } catch (error) {
      console.error('Profile update exception:', error);
      return c.json({ error: error.message || 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/profile/public/:userId
   * 
   * Get public user profile by user ID (no authentication required).
   * Used for viewing other users' public profile information.
   * 
   * Parameters:
   * - userId: UUID of the user to fetch
   * 
   * Response:
   * - Public user profile object
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with public profile or error
   */
  app.get('/api/profile/public/:userId', async (c) => {
    try {
      const userId = c.req.param('userId');
      
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Public profile fetch error:', error);
        return c.json({ error: 'Profile not found' }, 404);
      }
      
      return c.json(data);
    } catch (error) {
      console.error('Public profile error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/username/check/:username
   * 
   * Check if a username is available for registration.
   * Validates format, checks against blacklist, and verifies uniqueness.
   * No authentication required for real-time validation during registration.
   * 
   * Parameters:
   * - username: The username to check (3-30 chars, letters/numbers/underscore/dash)
   * 
   * Response:
   * - available: boolean indicating if username is available
   * - error: string with validation error if any
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with availability status
   */
  app.get('/api/username/check/:username', async (c) => {
    try {
      const username = c.req.param('username').toLowerCase();
      
      // Server-side validation
      const blacklist = [
        'admin', 'administrator', 'api', 'app', 'auth', 'balance', 'balances', 
        'book', 'booking', 'bookings', 'chat', 'customer', 'dashboard', 
        'discover', 'help', 'home', 'index', 'login', 'logout', 'message', 
        'messages', 'order', 'orders', 'profile', 'provider', 'resume', 
        'root', 'service', 'services', 'setting', 'settings', 'support', 
        'user', 'wallet', 'wallets', 'www', 'mail', 'email', 'ftp', 
        'blog', 'news', 'shop', 'store', 'test', 'demo', 'example',
        'null', 'undefined', 'true', 'false', 'system', 'config', 'onboarding'
      ];
      
      // Check format
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        return c.json({ 
          available: false, 
          error: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and dashes' 
        });
      }
      
      // Check blacklist
      if (blacklist.includes(username)) {
        return c.json({ available: false, error: 'This username is reserved' });
      }
      
      // Check if username exists
      const { data, error } = await db
        .from('users')
        .select('username')
        .eq('username', username)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Username check error:', error);
        return c.json({ error: 'Failed to check username' }, 500);
      }
      
      return c.json({ available: !data });
    } catch (error) {
      console.error('Username check error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * PATCH /api/username
   * 
   * Update authenticated user's username.
   * Validates format, checks blacklist, and ensures uniqueness.
   * Username changes are permanent and affect public user page URLs.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - username: The new username to set (3-30 chars, letters/numbers/underscore/dash)
   * 
   * Response:
   * - Updated user profile object
   * - HTTP 409 if username is already taken
   * - HTTP 400 if username format is invalid
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with updated profile or error
   */
  app.patch('/api/username', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { username } = await c.req.json();
      
      if (!username) {
        return c.json({ error: 'Username is required' }, 400);
      }
      
      const normalizedUsername = username.toLowerCase();
      
      // Server-side validation (same as check endpoint)
      const blacklist = [
        'admin', 'administrator', 'api', 'app', 'auth', 'balance', 'balances', 
        'book', 'booking', 'bookings', 'chat', 'customer', 'dashboard', 
        'discover', 'help', 'home', 'index', 'login', 'logout', 'message', 
        'messages', 'order', 'orders', 'profile', 'provider', 'resume', 
        'root', 'service', 'services', 'setting', 'settings', 'support', 
        'user', 'wallet', 'wallets', 'www', 'mail', 'email', 'ftp', 
        'blog', 'news', 'shop', 'store', 'test', 'demo', 'example',
        'null', 'undefined', 'true', 'false', 'system', 'config', 'onboarding'
      ];
      
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(normalizedUsername) || blacklist.includes(normalizedUsername)) {
        return c.json({ error: 'Invalid username' }, 400);
      }
      
      const { data, error } = await db
        .from('users')
        .update({ username: normalizedUsername })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') { // Unique violation
          return c.json({ error: 'Username already taken' }, 409);
        }
        console.error('Username update error:', error);
        return c.json({ error: 'Failed to update username' }, 500);
      }
      
      return c.json(data);
    } catch (error) {
      console.error('Username update error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/user/username/:username
   * 
   * Get user profile by username (no authentication required).
   * Used for public user pages with clean URLs (/{username}).
   * 
   * Parameters:
   * - username: The username to look up
   * 
   * Response:
   * - Full user profile object
   * - HTTP 404 if user not found
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with user profile or error
   */
  app.get('/api/user/username/:username', async (c) => {
    try {
      const username = c.req.param('username').toLowerCase();
      
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return c.json({ error: 'User not found' }, 404);
        }
        console.error('User lookup error:', error);
        return c.json({ error: 'Failed to find user' }, 500);
      }
      
      return c.json(data);
    } catch (error) {
      console.error('User lookup error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/user/:userId
   * 
   * Get user profile by user ID (no authentication required).
   * Used for legacy profile lookups and internal user references.
   * 
   * Parameters:
   * - userId: UUID of the user to fetch
   * 
   * Response:
   * - Full user profile object
   * - HTTP 404 if user not found
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with user profile or error
   */
  app.get('/api/user/:userId', async (c) => {
    try {
      const userId = c.req.param('userId');
      
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return c.json({ error: 'User not found' }, 404);
        }
        console.error('User lookup error:', error);
        return c.json({ error: 'Failed to find user' }, 500);
      }
      
      return c.json(data);
    } catch (error) {
      console.error('User lookup error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/profile/complete-onboarding
   *
   * Mark user's onboarding as completed.
   * Called when user finishes the onboarding flow.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Response:
   * - success: boolean
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with success status
   */
  app.post('/api/profile/complete-onboarding', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');

      const { error } = await db
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', userId);

      if (error) {
        console.error('Complete onboarding error:', error);
        return c.json({ error: 'Failed to complete onboarding' }, 500);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('Complete onboarding error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // =====================================================
  // Theme Management Endpoints
  // =====================================================

  /**
   * GET /api/user/:userId/theme
   *
   * Get user's public page theme settings (no authentication required).
   * Used by the public profile page to apply the correct theme.
   *
   * Parameters:
   * - userId: UUID of the user
   *
   * Response:
   * - theme: string (theme ID)
   * - custom_css: string | null
   * - settings: object (theme customizations)
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with theme data
   */
  app.get('/api/user/:userId/theme', async (c) => {
    try {
      const userId = c.req.param('userId');

      const { data, error } = await db
        .from('users')
        .select('page_theme, page_custom_css, page_theme_settings')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return c.json({ error: 'User not found' }, 404);
        }
        console.error('Theme lookup error:', error);
        return c.json({ error: 'Failed to fetch theme' }, 500);
      }

      return c.json({
        theme: data.page_theme || 'default',
        custom_css: data.page_custom_css,
        settings: data.page_theme_settings || {},
      });
    } catch (error) {
      console.error('Theme lookup error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * PUT /api/user/theme
   *
   * Update authenticated user's public page theme settings.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Body:
   * - theme: string (theme ID)
   * - custom_css: string | null
   * - settings: object (theme customizations)
   *
   * Response:
   * - success: boolean
   * - theme data
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with updated theme data
   */
  app.put('/api/user/theme', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();

      const { theme, custom_css, settings } = body;

      // Validate theme ID (allowed values from shared constants)
      if (theme && !ALLOWED_THEMES.includes(theme)) {
        return c.json({ error: `Invalid theme ID. Allowed: ${ALLOWED_THEMES.join(', ')}` }, 400);
      }

      // Build update object
      const updateData = {
        updated_at: new Date().toISOString(),
      };

      if (theme !== undefined) {
        updateData.page_theme = theme;
      }

      if (custom_css !== undefined) {
        // Note: CSS sanitization should happen on the frontend before display
        // We store the raw CSS here for flexibility
        updateData.page_custom_css = custom_css;
      }

      if (settings !== undefined) {
        updateData.page_theme_settings = settings;
      }

      const { data, error } = await db
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('page_theme, page_custom_css, page_theme_settings')
        .single();

      if (error) {
        console.error('Theme update error:', error);
        return c.json({ error: 'Failed to update theme' }, 500);
      }

      return c.json({
        success: true,
        theme: data.page_theme,
        custom_css: data.page_custom_css,
        settings: data.page_theme_settings,
      });
    } catch (error) {
      console.error('Theme update error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // =====================================================
  // Profile Buttons Endpoints
  // =====================================================

  /**
   * GET /api/user/:userId/buttons
   *
   * Get user's profile buttons (no authentication required).
   * Used by the public profile page to display link buttons.
   *
   * Parameters:
   * - userId: UUID of the user
   *
   * Response:
   * - buttons: array of ProfileButton objects
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with buttons array
   */
  app.get('/api/user/:userId/buttons', async (c) => {
    try {
      const userId = c.req.param('userId');

      const { data, error } = await db
        .from('users')
        .select('profile_buttons')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return c.json({ error: 'User not found' }, 404);
        }
        console.error('Profile buttons lookup error:', error);
        return c.json({ error: 'Failed to fetch buttons' }, 500);
      }

      return c.json({
        buttons: data.profile_buttons || [],
      });
    } catch (error) {
      console.error('Profile buttons lookup error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * PUT /api/user/buttons
   *
   * Update authenticated user's profile buttons.
   * Replaces the entire buttons array.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Body:
   * - buttons: array of ProfileButton objects
   *   - id: string (unique identifier)
   *   - label: string (button text)
   *   - url: string (link URL)
   *   - icon: string (optional, icon name)
   *   - order: number (display order)
   *
   * Response:
   * - success: boolean
   * - buttons: updated buttons array
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with updated buttons
   */
  app.put('/api/user/buttons', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();

      const { buttons } = body;

      // Validate buttons array
      if (!Array.isArray(buttons)) {
        return c.json({ error: 'Buttons must be an array' }, 400);
      }

      // Validate each button
      const maxButtons = 10; // Limit number of buttons
      if (buttons.length > maxButtons) {
        return c.json({ error: `Maximum ${maxButtons} buttons allowed` }, 400);
      }

      for (const button of buttons) {
        if (!button.id || typeof button.id !== 'string') {
          return c.json({ error: 'Each button must have a valid id' }, 400);
        }
        if (!button.label || typeof button.label !== 'string' || button.label.length > 50) {
          return c.json({ error: 'Each button must have a label (max 50 characters)' }, 400);
        }
        if (!button.url || typeof button.url !== 'string') {
          return c.json({ error: 'Each button must have a valid URL' }, 400);
        }
        // Basic URL validation
        try {
          new URL(button.url);
        } catch {
          return c.json({ error: `Invalid URL: ${button.url}` }, 400);
        }
        if (typeof button.order !== 'number') {
          return c.json({ error: 'Each button must have an order number' }, 400);
        }
      }

      // Sort buttons by order
      const sortedButtons = [...buttons].sort((a, b) => a.order - b.order);

      const { data, error } = await db
        .from('users')
        .update({
          profile_buttons: sortedButtons,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('profile_buttons')
        .single();

      if (error) {
        console.error('Profile buttons update error:', error);
        return c.json({ error: 'Failed to update buttons' }, 500);
      }

      return c.json({
        success: true,
        buttons: data.profile_buttons || [],
      });
    } catch (error) {
      console.error('Profile buttons update error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
}