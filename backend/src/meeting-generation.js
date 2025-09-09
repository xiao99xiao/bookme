import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '../.env.local' })

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Google OAuth helper
class GoogleAuth {
  static async refreshToken(refreshToken) {
    console.log('🔄 Refreshing Google OAuth token with client_id:', process.env.GOOGLE_CLIENT_ID ? 'PRESENT' : 'MISSING')
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`)
    }
    
    return response.json()
  }
}

// Google Calendar helper
class GoogleCalendar {
  constructor(accessToken) {
    this.accessToken = accessToken
  }
  
  async createMeetingEvent({ summary, description, startTime, endTime, attendees, timeZone }) {
    const event = {
      summary,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: timeZone || 'UTC'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: timeZone || 'UTC'
      },
      attendees: attendees?.map(email => ({ email })) || [],
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    }
    
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
    )
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Calendar API error (${response.status}): ${error}`)
    }
    
    const data = await response.json()
    
    return {
      eventId: data.id,
      meetLink: data.hangoutLink || data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri
    }
  }
  
  async deleteEvent(eventId) {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    )
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete event: ${response.statusText}`)
    }
  }
}

/**
 * Generate a meeting link for a confirmed booking
 */
export async function generateMeetingLinkForBooking(bookingId) {
  try {
    console.log('=== MEETING GENERATION START ===')
    console.log('Booking ID:', bookingId)

    // 1. Get booking details with service and customer info  
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        services!inner(
          title,
          meeting_platform,
          provider_id
        ),
        customers:users!bookings_customer_id_fkey(
          display_name,
          email
        ),
        providers:users!bookings_provider_id_fkey(
          timezone
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('Failed to fetch booking:', bookingError)
      return null
    }

    // 2. Check if service uses a meeting platform
    const meetingPlatform = booking.services?.meeting_platform
    
    console.log('🔍 Service meeting platform:', meetingPlatform)
    
    if (!meetingPlatform) {
      console.log('❌ Service does not use a meeting platform')
      return null
    }

    // 3. Get provider's meeting integration
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('*')
      .eq('user_id', booking.services.provider_id)
      .eq('platform', meetingPlatform)
      .eq('is_active', true)
      .single()

    console.log('🔍 Integration query result:', integration, 'Error:', integrationError)
    
    if (integrationError || !integration) {
      console.error('❌ Provider does not have active integration for platform:', meetingPlatform, 'Error:', integrationError)
      return null
    }
    
    console.log('✅ Found integration:', {
      id: integration.id,
      platform: integration.platform,
      is_active: integration.is_active,
      has_access_token: !!integration.access_token,
      has_refresh_token: !!integration.refresh_token,
      expires_at: integration.expires_at
    })

    // 4. Generate meeting based on platform
    let meetingLink = null
    let meetingId = null

    if (meetingPlatform === 'google_meet') {
      // Check if token needs refresh
      let accessToken = integration.access_token
      
      if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
        console.log('Access token expired, attempting to refresh...')
        
        if (!integration.refresh_token) {
          console.error('No refresh token available')
          return null
        }
        
        try {
          const refreshResult = await GoogleAuth.refreshToken(integration.refresh_token)
          
          if (!refreshResult.access_token) {
            console.error('Failed to refresh token')
            return null
          }
          
          // Update the integration with new token
          await supabaseAdmin
            .from('user_meeting_integrations')
            .update({
              access_token: refreshResult.access_token,
              expires_at: refreshResult.expires_in ? 
                new Date(Date.now() + refreshResult.expires_in * 1000).toISOString() :
                null,
              updated_at: new Date().toISOString()
            })
            .eq('id', integration.id)
          
          accessToken = refreshResult.access_token
        } catch (refreshError) {
          console.error('Failed to refresh access token:', refreshError)
          return null
        }
      }

      // Create Google Calendar event with Meet
      const calendar = new GoogleCalendar(accessToken)
      
      const startTime = new Date(booking.scheduled_at)
      const endTime = new Date(startTime.getTime() + booking.duration_minutes * 60000)
      
      // Get provider's timezone
      const providerTimezone = booking.providers?.timezone || 'UTC'
      
      try {
        const result = await calendar.createMeetingEvent({
          summary: `${booking.services.title} - Meeting`,
          description: `Meeting for ${booking.services.title}\nCustomer: ${booking.customers?.display_name || 'Customer'}`,
          startTime,
          endTime,
          attendees: booking.customers?.email ? [booking.customers.email] : [],
          timeZone: providerTimezone
        })

        meetingLink = result.meetLink
        meetingId = result.eventId
      } catch (createError) {
        console.error('Failed to create calendar event:', createError)
        
        // If we get a 401 error, try refreshing token once more
        if (createError.message && createError.message.includes('401') && integration.refresh_token) {
          try {
            const refreshResult = await GoogleAuth.refreshToken(integration.refresh_token)
            
            if (refreshResult.access_token) {
              await supabaseAdmin
                .from('user_meeting_integrations')
                .update({
                  access_token: refreshResult.access_token,
                  expires_at: refreshResult.expires_in ? 
                    new Date(Date.now() + refreshResult.expires_in * 1000).toISOString() :
                    null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', integration.id)
              
              // Retry with new token
              const newCalendar = new GoogleCalendar(refreshResult.access_token)
              const retryResult = await newCalendar.createMeetingEvent({
                summary: `${booking.services.title} - Meeting`,
                description: `Meeting for ${booking.services.title}\nCustomer: ${booking.customers?.display_name || 'Customer'}`,
                startTime,
                endTime,
                attendees: booking.customers?.email ? [booking.customers.email] : [],
                timeZone: providerTimezone
              })

              meetingLink = retryResult.meetLink
              meetingId = retryResult.eventId
            }
          } catch (retryError) {
            console.error('Failed to retry after token refresh:', retryError)
            return null
          }
        } else {
          return null
        }
      }
    }

    // 5. Update booking with meeting information
    if (meetingLink) {
      await supabaseAdmin
        .from('bookings')
        .update({
          meeting_platform: meetingPlatform,
          meeting_link: meetingLink,
          meeting_id: meetingId,
          meeting_settings: {
            created_at: new Date().toISOString(),
            platform: meetingPlatform
          }
        })
        .eq('id', bookingId)
      
      console.log('Successfully generated meeting link:', meetingLink)
    }

    console.log('=== MEETING GENERATION END ===')
    return meetingLink
  } catch (error) {
    console.error('Failed to generate meeting link:', error)
    return null
  }
}

/**
 * Delete a meeting when booking is cancelled
 */
export async function deleteMeetingForBooking(bookingId) {
  try {
    // Get booking details
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('meeting_id, meeting_platform, provider_id')
      .eq('id', bookingId)
      .single()

    if (error || !booking || !booking.meeting_id) {
      return
    }

    // Get provider's integration
    const { data: integration } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('access_token')
      .eq('user_id', booking.provider_id)
      .eq('platform', booking.meeting_platform)
      .eq('is_active', true)
      .single()

    if (!integration) {
      return
    }

    // Delete meeting based on platform
    if (booking.meeting_platform === 'google_meet') {
      const calendar = new GoogleCalendar(integration.access_token)
      await calendar.deleteEvent(booking.meeting_id)
    }

    // Clear meeting info from booking
    await supabaseAdmin
      .from('bookings')
      .update({
        meeting_link: null,
        meeting_id: null,
        meeting_settings: null
      })
      .eq('id', bookingId)

  } catch (error) {
    console.error('Failed to delete meeting:', error)
  }
}