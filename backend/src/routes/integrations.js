/**
 * Integration Routes
 * 
 * This module handles integration and OAuth-related endpoints including meeting generation,
 * third-party service integrations (Google Calendar, Zoom, etc.), OAuth callbacks,
 * and integration management for providers.
 * 
 * Usage:
 * ```javascript
 * import integrationRoutes from './routes/integrations.js';
 * integrationRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create integration routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function integrationRoutes(app) {

  /**
   * DELETE /api/meeting/:bookingId
   * 
   * Delete/cancel a meeting for a booking.
   * This endpoint removes meeting links and cancels scheduled meetings in external services.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - bookingId: UUID of the booking to cancel meeting for
   * 
   * Response:
   * - Success confirmation
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with success status or error
   */
  app.delete('/api/meeting/:bookingId', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('bookingId');

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('provider_id, meeting_id, meeting_platform, meeting_link')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Only provider can delete meeting links
      if (booking.provider_id !== userId) {
        return c.json({ error: 'Only the service provider can delete meeting links' }, 403);
      }

      if (!booking.meeting_id) {
        return c.json({ error: 'No meeting found for this booking' }, 404);
      }

      // Cancel meeting in external service if possible
      if (booking.meeting_platform && booking.meeting_id) {
        try {
          const { data: integration } = await supabaseAdmin
            .from('user_meeting_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('platform', booking.meeting_platform)
            .single();

          if (integration) {
            await cancelExternalMeeting({
              integration,
              meetingId: booking.meeting_id,
              meetingType: booking.meeting_platform
            });
          }
        } catch (cancelError) {
          console.error('External meeting cancellation error:', cancelError);
          // Continue with database cleanup even if external cancellation fails
        }
      }

      // Remove meeting information from booking
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          meeting_link: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Booking meeting removal error:', updateError);
        return c.json({ error: 'Failed to remove meeting information' }, 500);
      }

      return c.json({ 
        success: true,
        message: 'Meeting cancelled successfully' 
      });

    } catch (error) {
      console.error('Meeting deletion error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/integrations
   * 
   * Get all integrations for the authenticated user.
   * This endpoint returns configured third-party service integrations.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Query Parameters:
   * - active_only: Filter for active integrations only
   * - platform: Filter by integration type ('google_meet', 'zoom', etc.)
   * 
   * Response:
   * - Array of integration objects with connection status
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with integrations or error
   */
  app.get('/api/integrations', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { active_only, platform } = c.req.query();

      let query = supabaseAdmin
        .from('user_meeting_integrations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (active_only === 'true') {
        query = query.eq('is_active', true);
      }

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data: integrations, error: integrationsError } = await query;

      if (integrationsError) {
        console.error('Integrations fetch error:', integrationsError);
        return c.json({ error: 'Failed to fetch integrations' }, 500);
      }

      // Return data directly like original implementation
      return c.json(integrations || []);

    } catch (error) {
      console.error('Integrations fetch error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/integrations
   * 
   * Create or update an integration configuration.
   * This endpoint handles integration setup for third-party services.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - platform: Integration type ('google_meet', 'zoom', 'teams')
   * - platform_user_email: Email associated with the integration
   * - access_token: OAuth access token (temporary)
   * - refresh_token: OAuth refresh token (for token renewal)
   * - scope: Array of granted OAuth scopes
   * - expires_at: Token expiration timestamp
   * 
   * Response:
   * - Created or updated integration object
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with integration data or error
   */
  app.post('/api/integrations', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { 
        platform, 
        access_token, 
        refresh_token,
        expires_at,
        scope,
        platform_user_id,
        platform_user_email
      } = body;

      if (!platform || !access_token) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Check if integration already exists
      const { data: existingIntegration, error: existingError } = await supabaseAdmin
        .from('user_meeting_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .single();

      const integrationData = {
        user_id: userId,
        platform: platform,
        access_token,
        refresh_token: refresh_token || null,
        expires_at: expires_at || null,
        scope: scope || [],
        platform_user_id: platform_user_id || null,
        platform_user_email: platform_user_email || null,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      let integration;
      if (existingIntegration) {
        // Update existing integration
        const { data, error } = await supabaseAdmin
          .from('user_meeting_integrations')
          .update(integrationData)
          .eq('id', existingIntegration.id)
          .select()
          .single();

        if (error) {
          console.error('Integration update error:', error);
          return c.json({ error: 'Failed to update integration' }, 500);
        }
        integration = data;
      } else {
        // Create new integration
        integrationData.created_at = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from('user_meeting_integrations')
          .insert(integrationData)
          .select()
          .single();

        if (error) {
          console.error('Integration creation error:', error);
          return c.json({ error: 'Failed to create integration' }, 500);
        }
        integration = data;
      }

      // Return full data like original implementation
      return c.json(integration);

    } catch (error) {
      console.error('Integration creation error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * DELETE /api/integrations/:id
   * 
   * Delete an integration configuration.
   * This endpoint removes third-party service integrations and revokes access tokens.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - id: UUID of the integration to delete
   * 
   * Response:
   * - Success confirmation
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with success status or error
   */
  app.delete('/api/integrations/:id', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const integrationId = c.req.param('id');

      // Get integration to verify ownership and gather token info for revocation
      const { data: integration, error: integrationError } = await supabaseAdmin
        .from('user_meeting_integrations')
        .select('*')
        .eq('id', integrationId)
        .eq('user_id', userId)
        .single();

      if (integrationError || !integration) {
        console.error('Integration fetch error:', integrationError);
        return c.json({ error: 'Integration not found' }, 404);
      }

      // Revoke access token with the provider if possible
      if (integration.access_token) {
        try {
          await revokeIntegrationAccess({
            providerType: integration.platform,
            accessToken: integration.access_token,
            refreshToken: integration.refresh_token
          });
        } catch (revokeError) {
          console.error('Token revocation error:', revokeError);
          // Continue with deletion even if revocation fails
        }
      }

      // Delete integration from database
      const { error: deleteError } = await supabaseAdmin
        .from('user_meeting_integrations')
        .delete()
        .eq('id', integrationId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Integration deletion error:', deleteError);
        return c.json({ error: 'Failed to delete integration' }, 500);
      }

      return c.json({ 
        success: true,
        message: 'Integration deleted successfully' 
      });

    } catch (error) {
      console.error('Integration deletion error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/oauth/google-callback
   * 
   * Handle Google OAuth callback and create integration.
   * This endpoint processes the OAuth authorization code and exchanges it for access tokens.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - code: OAuth authorization code from Google
   * - state: OAuth state parameter for CSRF protection
   * - redirect_uri: Original redirect URI used in OAuth flow
   * 
   * Response:
   * - Created integration object with connection status
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with integration data or error
   */
  app.post('/api/oauth/google-callback', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { code, redirectUri } = body;

      if (!code) {
        return c.json({ error: 'Authorization code is required' }, 400);
      }

      // Exchange authorization code for tokens
      const tokenData = await exchangeGoogleAuthCode({
        code,
        redirectUri: redirectUri || process.env.GOOGLE_OAUTH_REDIRECT_URI,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
      });

      if (!tokenData.access_token) {
        return c.json({ error: 'Failed to obtain access tokens' }, 400);
      }

      // Get user info from Google to verify the integration
      const userInfo = await getGoogleUserInfo(tokenData.access_token);

      // Create or update integration
      const integrationData = {
        user_id: userId,
        platform: 'google_meet',
        platform_user_email: userInfo.email,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        scope: tokenData.scope ? tokenData.scope.split(' ') : ['https://www.googleapis.com/auth/calendar'],
        expires_at: tokenData.expires_in ? 
          new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString() : 
          null,
        is_active: true
      };

      // Check for existing integration
      const { data: existingIntegration } = await supabaseAdmin
        .from('user_meeting_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', 'google_meet')
        .single();

      let integration;
      if (existingIntegration) {
        // Update existing integration
        integrationData.updated_at = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from('user_meeting_integrations')
          .update(integrationData)
          .eq('id', existingIntegration.id)
          .select()
          .single();

        if (error) {
          console.error('Google integration update error:', error);
          return c.json({ error: 'Failed to save Google integration' }, 500);
        }
        integration = data;
      } else {
        // Create new integration
        integrationData.created_at = new Date().toISOString();
        integrationData.updated_at = new Date().toISOString();
        
        const { data, error } = await supabaseAdmin
          .from('user_meeting_integrations')
          .insert(integrationData)
          .select()
          .single();

        if (error) {
          console.error('Google integration creation error:', error);
          return c.json({ error: 'Failed to create Google integration' }, 500);
        }
        integration = data;
      }

      return c.json({
        success: true,
        integration: {
          id: integration.id,
          platform: integration.platform,
          provider_email: integration.platform_user_email,
          is_active: integration.is_active,
          connection_status: 'connected',
          scopes: integration.scope || [],
          created_at: integration.created_at,
          updated_at: integration.updated_at
        }
      });

    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return c.json({ error: 'Failed to process Google OAuth callback' }, 500);
    }
  });

  /**
   * POST /api/meeting/generate
   * 
   * Generate meeting link (old simplified endpoint for backward compatibility).
   * This endpoint matches the old commented code pattern exactly.
   * 
   * Body:
   * - bookingId: UUID of the booking to generate meeting for
   * 
   * Response:
   * - Updated booking with meeting link or error
   */
  app.post('/api/meeting/generate', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { bookingId } = await c.req.json();
      
      // Import meeting generation module
      const { generateMeetingLinkForBooking } = await import('../meeting-generation.js');
      
      // Verify user is the provider
      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .select('provider_id')
        .eq('id', bookingId)
        .single();
      
      if (error || !booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      if (booking.provider_id !== userId) {
        return c.json({ error: 'Only provider can generate meeting link' }, 403);
      }
      
      // Generate meeting link
      const meetingLink = await generateMeetingLinkForBooking(bookingId);
      
      if (!meetingLink) {
        return c.json({ 
          error: 'Failed to generate meeting link. Please check your Google integration settings and try reconnecting your Google account.',
          details: 'Meeting link generation failed - this usually indicates expired or invalid OAuth credentials.'
        }, 500);
      }
      
      // Get updated booking
      const { data: updatedBooking } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*)
        `)
        .eq('id', bookingId)
        .single();
      
      return c.json({
        success: true,
        booking: updatedBooking,
        meetingLink
      });
      
    } catch (error) {
      console.error('Meeting generation error:', error);
      
      // Provide more specific error messages based on the error
      let errorMessage = 'Failed to generate meeting link';
      if (error.message?.includes('401') || error.message?.includes('authError')) {
        errorMessage = 'Google authentication failed. Please reconnect your Google account in integrations.';
      } else if (error.message?.includes('refresh token')) {
        errorMessage = 'Google refresh token expired. Please reconnect your Google account in integrations.';
      }
      
      return c.json({ 
        error: errorMessage,
        details: error.message 
      }, 500);
    }
  });
}

// Helper functions for integration services
async function generateGoogleMeeting({ integration, booking, title, description, duration }) {
  // Google Calendar API integration logic would go here
  // This is a placeholder implementation
  const meetingId = `google-meet-${booking.id}`;
  const meetingUrl = `https://meet.google.com/${meetingId}`;
  
  return {
    meeting_id: meetingId,
    meeting_url: meetingUrl,
    join_instructions: 'Click the link to join the Google Meet',
    provider: 'google_meet'
  };
}

async function generateZoomMeeting({ integration, booking, title, description, duration }) {
  // Zoom API integration logic would go here
  // This is a placeholder implementation
  const meetingId = `zoom-${booking.id}`;
  const meetingUrl = `https://zoom.us/j/${meetingId}`;
  const password = Math.random().toString(36).substr(2, 8);
  
  return {
    meeting_id: meetingId,
    meeting_url: meetingUrl,
    password: password,
    join_instructions: `Join the Zoom meeting with password: ${password}`,
    provider: 'zoom'
  };
}

async function cancelExternalMeeting({ integration, meetingId, meetingType }) {
  // External meeting cancellation logic would go here
  console.log(`Cancelling ${meetingType} meeting: ${meetingId}`);
}

async function revokeIntegrationAccess({ providerType, accessToken, refreshToken }) {
  // Token revocation logic would go here
  console.log(`Revoking ${providerType} access tokens`);
}

async function exchangeGoogleAuthCode({ code, redirectUri, clientId, clientSecret }) {
  // Google OAuth token exchange logic would go here
  // This is a placeholder implementation
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    scope: 'https://www.googleapis.com/auth/calendar'
  };
}

async function getGoogleUserInfo(accessToken) {
  // Google user info API call would go here
  // This is a placeholder implementation
  return {
    email: 'user@example.com',
    name: 'User Name'
  };
}