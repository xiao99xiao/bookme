import { GoogleCalendar } from './google-auth';
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
    console.log('Generating meeting link for booking:', bookingId);

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
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Failed to fetch booking:', bookingError);
      return null;
    }

    // 2. Check if service uses a meeting platform
    const meetingPlatform = booking.services?.meeting_platform;
    if (!meetingPlatform) {
      console.log('Service does not use a meeting platform');
      return null;
    }

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
      return null;
    }

    // 4. Generate meeting based on platform
    let meetingLink: string | null = null;
    let meetingId: string | null = null;

    if (meetingPlatform === 'google_meet') {
      // Check if token needs refresh
      let accessToken = integration.access_token;
      
      if (integration.expires_at && new Date(integration.expires_at) < new Date()) {
        // Token expired, need to refresh (implement token refresh logic)
        console.log('Token expired, skipping meeting generation');
        return null;
      }

      // Create Google Calendar event with Meet
      const calendar = new GoogleCalendar(accessToken);
      
      const startTime = new Date(booking.scheduled_at);
      const endTime = new Date(startTime.getTime() + booking.duration_minutes * 60000);
      
      const result = await calendar.createMeetingEvent({
        summary: `${booking.services.title} - Meeting`,
        description: `Meeting for ${booking.services.title}\nCustomer: ${booking.customers?.display_name || 'Customer'}`,
        startTime,
        endTime,
        attendees: booking.customers?.email ? [booking.customers.email] : []
      });

      meetingLink = result.meetLink;
      meetingId = result.eventId;
    }

    // 5. Update booking with meeting information
    if (meetingLink) {
      const { error: updateError } = await supabaseAdmin
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
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking with meeting link:', updateError);
      } else {
        console.log('Successfully generated meeting link:', meetingLink);
      }
    }

    return meetingLink;
  } catch (error) {
    console.error('Failed to generate meeting link:', error);
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