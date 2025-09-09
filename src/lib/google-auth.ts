// Google OAuth implementation for Google Meet integration
// This handles the OAuth flow client-side

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// You need to set these in your environment variables
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
// Client secret is now handled securely on the backend
// Don't evaluate window.location at module load time
const getRedirectUri = () => `${window.location.origin}/provider/integrations/callback`;

// Scopes needed for Google Calendar/Meet
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export class GoogleAuth {
  /**
   * Initiates the Google OAuth flow
   */
  static initiateOAuth(): void {
    // Generate a random state for security
    const state = this.generateRandomState();
    
    // Store state in sessionStorage for validation
    sessionStorage.setItem('google_oauth_state', state);
    
    // Build the OAuth URL
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      state: state,
      access_type: 'offline', // To get refresh token
      prompt: 'consent' // Force consent to ensure refresh token
    });
    
    // Redirect to Google OAuth
    window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }
  
  /**
   * Handles the OAuth callback
   * @deprecated This method is deprecated. The callback is now handled by IntegrationsCallback.tsx using the secure backend endpoint.
   */
  static async handleCallback(code: string, state: string): Promise<any> {
    throw new Error('OAuth callback is now handled by IntegrationsCallback.tsx using the secure backend endpoint /api/oauth/google-callback');
  }
  
  /**
   * Exchange authorization code for access token
   * @deprecated This method is insecure and should not be used. Use backend OAuth endpoint instead.
   */
  static async exchangeCodeForToken(code: string): Promise<any> {
    throw new Error('Token exchange is now handled securely on the backend. Use /api/oauth/google-callback instead.');
  }
  
  /**
   * Get user info from Google
   */
  static async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get user info');
    }
    
    return response.json();
  }
  
  /**
   * Refresh the access token
   * @deprecated This method is insecure and should not be used. Token refresh is now handled on the backend.
   */
  static async refreshToken(refreshToken: string): Promise<any> {
    throw new Error('Token refresh is now handled securely on the backend. The meeting-generation.js handles refresh automatically.');
  }
  
  /**
   * Generate a random state for OAuth security
   */
  private static generateRandomState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Google Calendar API helper functions
export class GoogleCalendar {
  private accessToken: string;
  
  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }
  
  /**
   * Create a Google Calendar event with Meet
   */
  async createMeetingEvent(eventData: {
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: string[];
    timeZone?: string;
  }): Promise<any> {
    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      attendees: eventData.attendees?.map(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: this.generateRequestId(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };
    
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create meeting: ${error}`);
    }
    
    const createdEvent = await response.json();
    
    // Extract the Meet link
    const meetLink = createdEvent.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri;
    
    return {
      eventId: createdEvent.id,
      meetLink: meetLink || createdEvent.hangoutLink,
      event: createdEvent
    };
  }
  
  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );
    
    if (!response.ok && response.status !== 404) {
      throw new Error('Failed to delete event');
    }
  }
  
  /**
   * Update a calendar event
   */
  async updateEvent(eventId: string, updates: any): Promise<any> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to update event');
    }
    
    return response.json();
  }
  
  /**
   * Generate a unique request ID for conference creation
   */
  private generateRequestId(): string {
    return `timee-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}