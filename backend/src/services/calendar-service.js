/**
 * Google Calendar Integration Service
 * 
 * This service handles Google Calendar API integration for provider availability:
 * - Fetches calendar events to detect scheduling conflicts
 * - Token management and refresh handling
 * - Event parsing and conflict detection
 * - Graceful error handling when calendar is unavailable
 */

import { getSupabaseAdmin } from '../middleware/auth.js';

const supabaseAdmin = getSupabaseAdmin();

export class CalendarService {
  constructor() {
    this.GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
    this.MAX_EVENTS_PER_REQUEST = 250; // Google Calendar API limit
  }

  /**
   * Get provider's calendar events for availability calculation
   * Returns events that could conflict with booking slots
   */
  async getProviderCalendarEvents(providerId, startDate, endDate) {
    try {
      console.log(`📅 Fetching calendar events for provider ${providerId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get provider's active calendar integrations
      const integrations = await this.getActiveCalendarIntegrations(providerId);
      
      if (integrations.length === 0) {
        console.log(`📅 No active calendar integrations found for provider ${providerId}`);
        return []; // No calendar integration - return empty events
      }

      // Fetch events from all integrated calendars
      const allEvents = [];
      
      for (const integration of integrations) {
        try {
          const events = await this.fetchCalendarEvents(integration, startDate, endDate);
          allEvents.push(...events);
        } catch (error) {
          console.error(`❌ Error fetching events from ${integration.platform}:`, error);
          // Continue with other integrations - don't fail the entire request
        }
      }

      // Sort events by start time
      allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

      console.log(`✅ Retrieved ${allEvents.length} calendar events for provider ${providerId}`);
      return allEvents;

    } catch (error) {
      console.error('❌ Error in getProviderCalendarEvents:', error);
      return []; // Graceful fallback - return empty events array
    }
  }

  /**
   * Get active calendar integrations for a provider
   */
  async getActiveCalendarIntegrations(providerId) {
    const { data: integrations, error } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('*')
      .eq('user_id', providerId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching calendar integrations:', error);
      return [];
    }

    return integrations || [];
  }

  /**
   * Fetch calendar events from Google Calendar API
   */
  async fetchCalendarEvents(integration, startDate, endDate) {
    try {
      // Ensure we have a valid access token
      const accessToken = await this.ensureValidAccessToken(integration);
      if (!accessToken) {
        console.error(`No valid access token for integration ${integration.id}`);
        return [];
      }

      // Prepare API request parameters
      const params = new URLSearchParams({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: this.MAX_EVENTS_PER_REQUEST.toString(),
        // Only get events that could conflict with bookings
        fields: 'items(id,summary,start,end,status,transparency)',
      });

      const response = await fetch(
        `${this.GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired - try to refresh
          console.log('Access token expired, attempting refresh...');
          const refreshedToken = await this.refreshAccessToken(integration);
          if (refreshedToken) {
            // Retry with refreshed token
            return this.fetchCalendarEvents(integration, startDate, endDate);
          }
        }
        throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse and filter events
      const events = this.parseCalendarEvents(data.items || []);
      
      console.log(`📅 Fetched ${events.length} events from ${integration.platform} for user ${integration.user_id}`);
      return events;

    } catch (error) {
      console.error(`Error fetching calendar events for integration ${integration.id}:`, error);
      return []; // Graceful fallback
    }
  }

  /**
   * Parse Google Calendar events into our internal format
   */
  parseCalendarEvents(googleEvents) {
    const events = [];

    for (const event of googleEvents) {
      try {
        // Skip cancelled events
        if (event.status === 'cancelled') {
          continue;
        }

        // Skip transparent events (free time)
        if (event.transparency === 'transparent') {
          continue;
        }

        // Skip all-day events (they don't conflict with specific time slots)
        if (event.start.date && !event.start.dateTime) {
          continue;
        }

        // Skip events without start/end times
        if (!event.start?.dateTime || !event.end?.dateTime) {
          continue;
        }

        const parsedEvent = {
          id: event.id,
          title: event.summary || 'Busy',
          start: event.start.dateTime,
          end: event.end.dateTime,
          source: 'google_calendar'
        };

        events.push(parsedEvent);

      } catch (error) {
        console.error('Error parsing calendar event:', error, event);
        // Continue processing other events
      }
    }

    return events;
  }

  /**
   * Ensure access token is valid, refresh if necessary
   */
  async ensureValidAccessToken(integration) {
    try {
      // Check if token is expired (with 5-minute buffer)
      const now = new Date();
      const expiresAt = new Date(integration.expires_at);
      const bufferTime = 5 * 60 * 1000; // 5 minutes

      if (expiresAt && expiresAt.getTime() - bufferTime <= now.getTime()) {
        console.log(`Access token for integration ${integration.id} is expired, refreshing...`);
        return await this.refreshAccessToken(integration);
      }

      return integration.access_token;

    } catch (error) {
      console.error('Error ensuring valid access token:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(integration) {
    try {
      if (!integration.refresh_token) {
        console.error(`No refresh token available for integration ${integration.id}`);
        await this.deactivateIntegration(integration.id);
        return null;
      }

      console.log(`🔄 Refreshing access token for integration ${integration.id}`);

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.VITE_GOOGLE_CLIENT_ID,
          client_secret: process.env.VITE_GOOGLE_CLIENT_SECRET,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Token refresh failed:', response.status, errorData);
        
        // If refresh fails, deactivate the integration
        await this.deactivateIntegration(integration.id);
        return null;
      }

      const tokenData = await response.json();

      // Update integration with new token
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      
      const { error } = await supabaseAdmin
        .from('user_meeting_integrations')
        .update({
          access_token: tokenData.access_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);

      if (error) {
        console.error('Error updating refreshed token:', error);
        return null;
      }

      console.log(`✅ Successfully refreshed access token for integration ${integration.id}`);
      return tokenData.access_token;

    } catch (error) {
      console.error('Error refreshing access token:', error);
      await this.deactivateIntegration(integration.id);
      return null;
    }
  }

  /**
   * Deactivate integration when token refresh fails
   */
  async deactivateIntegration(integrationId) {
    try {
      const { error } = await supabaseAdmin
        .from('user_meeting_integrations')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId);

      if (error) {
        console.error('Error deactivating integration:', error);
      } else {
        console.log(`⚠️ Deactivated integration ${integrationId} due to token issues`);
      }
    } catch (error) {
      console.error('Error deactivating integration:', error);
    }
  }

  /**
   * Test calendar integration for a user
   */
  async testCalendarIntegration(userId) {
    try {
      const integrations = await this.getActiveCalendarIntegrations(userId);
      
      if (integrations.length === 0) {
        return { success: false, message: 'No active calendar integrations found' };
      }

      const testResults = [];
      
      for (const integration of integrations) {
        try {
          const accessToken = await this.ensureValidAccessToken(integration);
          
          if (!accessToken) {
            testResults.push({
              platform: integration.platform,
              success: false,
              message: 'Unable to get valid access token'
            });
            continue;
          }

          // Test API call - get user's profile
          const response = await fetch(
            `${this.GOOGLE_CALENDAR_API_BASE}/calendars/primary`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          testResults.push({
            platform: integration.platform,
            success: response.ok,
            message: response.ok ? 'Calendar integration working' : `API error: ${response.status}`
          });

        } catch (error) {
          testResults.push({
            platform: integration.platform,
            success: false,
            message: `Error: ${error.message}`
          });
        }
      }

      const allSuccessful = testResults.every(result => result.success);
      
      return {
        success: allSuccessful,
        message: allSuccessful ? 'All calendar integrations working' : 'Some integrations have issues',
        results: testResults
      };

    } catch (error) {
      console.error('Error testing calendar integration:', error);
      return { success: false, message: 'Error testing calendar integration' };
    }
  }
}

// Export singleton instance
const calendarService = new CalendarService();
export default calendarService;