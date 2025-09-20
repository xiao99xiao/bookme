/**
 * Authentication Routes
 * 
 * This module handles authentication-related endpoints.
 * Currently includes token generation for Supabase compatibility.
 * 
 * Usage:
 * ```javascript
 * import authRoutes from './routes/auth.js';
 * authRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { privyDidToUuid, getPrivyClient, getSupabaseAdmin } from '../middleware/auth.js';

// Load environment variables
dotenv.config({ path: '.env' });

/**
 * Create authentication routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function authRoutes(app) {
  const privyClient = getPrivyClient();
  const supabaseAdmin = getSupabaseAdmin();

  /**
   * POST /api/auth/token
   * 
   * Generate a Supabase-compatible JWT token from a Privy authentication token.
   * This endpoint creates or retrieves a user profile and generates a JWT that
   * can be used with Supabase client libraries.
   * 
   * Request Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Response:
   * - token: Supabase-compatible JWT
   * - user_id: UUID format user ID
   * - expires_in: Token expiration time in seconds (86400 = 24 hours)
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with token or error
   */
  app.post('/api/auth/token', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing authorization header' }, 401);
      }
      
      const privyToken = authHeader.substring(7);
      const privyUser = await privyClient.verifyAuthToken(privyToken);
      
      if (!privyUser) {
        return c.json({ error: 'Invalid token' }, 401);
      }
      
      // Convert Privy DID to UUID
      const userId = privyDidToUuid(privyUser.userId);
      
      // Get or create user profile
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!user) {
        // Create user if doesn't exist
        const emailAccount = privyUser.linkedAccounts?.find(acc => acc.type === 'email');
        const email = emailAccount?.address || `${privyUser.userId}@privy.user`;
        
        await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: email,
            display_name: email.split('@')[0],
            timezone: 'UTC',
            is_verified: false,
            rating: 0,
            review_count: 0,
            total_earnings: 0,
            total_spent: 0,
            is_provider: false
          });
      }
      
      // Create Supabase-compatible JWT with all required claims
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;
      
      if (!jwtSecret) {
        console.error('SUPABASE_JWT_SECRET not found in environment variables');
        return c.json({ error: 'JWT secret not configured' }, 500);
      }
      
      // Generate a session ID for this JWT
      const sessionId = `${userId}-${Date.now()}`;
      
      const supabaseJWT = jwt.sign(
        {
          sub: userId, // This becomes auth.uid() in RLS policies
          aud: 'authenticated',
          role: 'authenticated',
          email: user?.email || `${privyUser.userId}@privy.user`,
          phone: null,
          app_metadata: {
            provider: 'privy',
            providers: ['privy']
          },
          user_metadata: {
            privy_id: privyUser.userId
          },
          aal: 'aal1', // Authentication assurance level
          amr: [{ method: 'privy', timestamp: Math.floor(Date.now() / 1000) }], // Authentication methods reference
          session_id: sessionId,
          iss: process.env.SUPABASE_URL + '/auth/v1',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
        },
        jwtSecret
      );
      
      return c.json({ 
        token: supabaseJWT,
        user_id: userId,
        expires_in: 86400 // 24 hours in seconds
      });
    } catch (error) {
      console.error('Token generation error:', error);
      return c.json({ error: 'Failed to generate token' }, 500);
    }
  });

  /**
   * POST /api/auth/callback
   *
   * Handle OAuth callback from Supabase Auth.
   * This endpoint processes OAuth codes/tokens from providers like Google, GitHub, etc.
   * and handles the session establishment server-side.
   *
   * Request Body:
   * - code?: OAuth authorization code (PKCE flow)
   * - access_token?: Access token (implicit flow)
   * - refresh_token?: Refresh token (implicit flow)
   * - provider?: OAuth provider name (optional)
   * - error?: Error parameter from OAuth provider
   * - error_description?: Error description from OAuth provider
   * - error_code?: Error code from OAuth provider
   *
   * Response:
   * - success: boolean
   * - redirectTo?: URL to redirect to on success
   * - error?: Error message on failure
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with success/error status
   */
  app.post('/api/auth/callback', async (c) => {
    try {
      const body = await c.req.json();
      const {
        code,
        access_token,
        refresh_token,
        provider,
        error: errorParam,
        error_description,
        error_code
      } = body;

      console.log('=== BACKEND AUTH CALLBACK START ===');
      console.log('Received data:', {
        hasCode: !!code,
        hasAccessToken: !!access_token,
        provider,
        hasError: !!errorParam
      });

      // Handle error cases first
      if (errorParam) {
        console.log('Authentication error detected:', errorParam);
        let userFriendlyMessage = 'Authentication failed. Please try again.';

        if (error_code === 'otp_expired') {
          userFriendlyMessage = 'The magic link has expired. Please request a new one.';
        } else if (errorParam === 'access_denied') {
          userFriendlyMessage = 'Authentication was denied or cancelled.';
        } else if (error_description) {
          // Use the error description from Supabase, decoded
          userFriendlyMessage = decodeURIComponent(error_description.replace(/\+/g, ' '));
        }

        return c.json({
          success: false,
          error: userFriendlyMessage
        }, 400);
      }

      // Handle PKCE flow (authorization code)
      if (code) {
        console.log('Processing PKCE flow with authorization code');
        const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Code exchange failed:', error);
          return c.json({
            success: false,
            error: `Authentication failed: ${error.message}`
          }, 400);
        }

        if (data.session) {
          console.log('PKCE session established successfully');
          return c.json({
            success: true,
            redirectTo: '/discover',
            session_established: true
          });
        }
      }

      // Handle implicit flow (direct tokens)
      if (access_token) {
        console.log('Processing implicit flow with access token');
        const { data, error } = await supabaseAdmin.auth.setSession({
          access_token,
          refresh_token: refresh_token || ''
        });

        if (error) {
          console.error('Session establishment failed:', error);
          return c.json({
            success: false,
            error: `Authentication failed: ${error.message}`
          }, 400);
        }

        if (data.session) {
          console.log('Implicit flow session established successfully');
          return c.json({
            success: true,
            redirectTo: '/discover',
            session_established: true
          });
        }
      }

      // No valid auth data provided
      console.log('No valid authentication data provided');
      return c.json({
        success: false,
        error: 'No valid authentication data provided'
      }, 400);

    } catch (error) {
      console.error('Auth callback error:', error);
      return c.json({
        success: false,
        error: 'An unexpected error occurred during authentication'
      }, 500);
    }
  });
}