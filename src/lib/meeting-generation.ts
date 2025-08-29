import { GoogleCalendar, GoogleAuth } from './google-auth';
import { supabaseAdmin } from './supabase';

interface BookingData {
  id: string;
  service_id: string;
  customer_id: string;
  provider_id: string;
  scheduled_at: string;
  duration_minutes: number;
  service?: {
    title: string;
    meeting_platform?: string;
  };
  customer?: {
    display_name: string;
    email: string;
  };
}

/**
 * Generate a meeting link for a confirmed booking
 */
export async function generateMeetingLinkForBooking(bookingId: string): Promise<string | null> {
  try {
    console.log('=== MEETING GENERATION START ===');
    console.log('Booking ID:', bookingId);

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
      .single();

    if (bookingError || !booking) {
      console.error('Failed to fetch booking:', bookingError);
      console.log('Booking fetch result:', { booking, bookingError });
      return null;
    }

    console.log('Booking fetched successfully:', {
      id: booking.id,
      serviceTitle: booking.services?.title,
      meetingPlatform: booking.services?.meeting_platform,
      providerId: booking.services?.provider_id,
      isOnline: booking.is_online
    });

    // 2. Check if service uses a meeting platform
    const meetingPlatform = booking.services?.meeting_platform;
    console.log('Checking meeting platform:', meetingPlatform);
    
    if (!meetingPlatform) {
      console.log('Service does not use a meeting platform - exiting');
      return null;
    }
    
    console.log('Meeting platform confirmed:', meetingPlatform);

    // 3. Get provider's meeting integration
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('*')
      .eq('user_id', booking.services.provider_id)
      .eq('platform', meetingPlatform)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Provider does not have active integration:', integrationError);
      console.log('Integration fetch result:', { integration, integrationError });
      console.log('Searching for integration with:', {
        userId: booking.services.provider_id,
        platform: meetingPlatform,
        isActive: true
      });
      return null;
    }
    
    console.log('Integration found:', {
      platform: integration.platform,
      isActive: integration.is_active,
      hasAccessToken: !!integration.access_token,
      expiresAt: integration.expires_at
    });

    // 4. Generate meeting based on platform
    let meetingLink: string | null = null;
    let meetingId: string | null = null;

    if (meetingPlatform === 'google_meet') {
      // Check if token needs refresh
      let accessToken = integration.access_token;
      
      if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
        console.log('Access token expired, attempting to refresh...');
        
        if (!integration.refresh_token) {
          console.error('No refresh token available - cannot refresh access token');
          return null;
        }
        
        try {
          // Refresh the access token
          const refreshResult = await GoogleAuth.refreshToken(integration.refresh_token);
          console.log('Token refresh successful:', { hasNewToken: !!refreshResult.access_token });
          
          // Update the integration with new token
          const { error: updateError } = await supabaseAdmin
            .from('user_meeting_integrations')
            .update({
              access_token: refreshResult.access_token,
              expires_at: refreshResult.expires_in ? 
                new Date(Date.now() + refreshResult.expires_in * 1000).toISOString() :
                null,
              updated_at: new Date().toISOString()
            })
            .eq('id', integration.id);
            
          if (updateError) {
            console.error('Failed to update integration with refreshed token:', updateError);
            return null;
          }
          
          // Use the new access token
          accessToken = refreshResult.access_token;
          console.log('Successfully refreshed and updated access token');
          
        } catch (refreshError) {
          console.error('Failed to refresh access token:', refreshError);
          return null;
        }
      } else {
        console.log('Access token is still valid');
      }

      // Create Google Calendar event with Meet
      const calendar = new GoogleCalendar(accessToken);
      
      const startTime = new Date(booking.scheduled_at);
      const endTime = new Date(startTime.getTime() + booking.duration_minutes * 60000);
      
      // Get provider's timezone
      const providerTimezone = booking.providers?.timezone || 'UTC';
      
      const result = await calendar.createMeetingEvent({
        summary: `${booking.services.title} - Meeting`,
        description: `Meeting for ${booking.services.title}\nCustomer: ${booking.customers?.display_name || 'Customer'}`,
        startTime,
        endTime,
        attendees: booking.customers?.email ? [booking.customers.email] : [],
        timeZone: providerTimezone
      });

      meetingLink = result.meetLink;
      meetingId = result.eventId;
    }

    // 5. Update booking with meeting information
    console.log('Meeting generation completed:', { meetingLink, meetingId });
    
    if (meetingLink) {
      console.log('Updating booking with meeting information...');
      const updateData = {
        meeting_platform: meetingPlatform,
        meeting_link: meetingLink,
        meeting_id: meetingId,
        meeting_settings: {
          created_at: new Date().toISOString(),
          platform: meetingPlatform
        }
      };
      console.log('Update data:', updateData);
      
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking with meeting link:', updateError);
      } else {
        console.log('Successfully updated booking with meeting link:', meetingLink);
      }
    } else {
      console.log('No meeting link generated - skipping database update');
    }

    console.log('=== MEETING GENERATION END ===');
    return meetingLink;
  } catch (error) {
    console.error('=== MEETING GENERATION ERROR ===');
    console.error('Failed to generate meeting link:', error);
    console.error('Error details:', error);
    console.log('=== MEETING GENERATION END (ERROR) ===');
    return null;
  }
}

/**
 * Delete a meeting when booking is cancelled
 */
export async function deleteMeetingForBooking(bookingId: string): Promise<void> {
  try {
    // Get booking details
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('meeting_id, meeting_platform, provider_id')
      .eq('id', bookingId)
      .single();

    if (error || !booking || !booking.meeting_id) {
      return;
    }

    // Get provider's integration
    const { data: integration } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('access_token')
      .eq('user_id', booking.provider_id)
      .eq('platform', booking.meeting_platform)
      .eq('is_active', true)
      .single();

    if (!integration) {
      return;
    }

    // Delete meeting based on platform
    if (booking.meeting_platform === 'google_meet') {
      const calendar = new GoogleCalendar(integration.access_token);
      await calendar.deleteEvent(booking.meeting_id);
    }

    // Clear meeting info from booking
    await supabaseAdmin
      .from('bookings')
      .update({
        meeting_link: null,
        meeting_id: null,
        meeting_settings: null
      })
      .eq('id', bookingId);

  } catch (error) {
    console.error('Failed to delete meeting:', error);
  }
}