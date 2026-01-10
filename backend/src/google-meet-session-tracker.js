import { google } from 'googleapis';
import db from './db-compat.js';

/**
 * Google Meet Session Duration Tracker
 *
 * This module provides functionality to track participant session durations
 * in Google Meet meetings for service delivery verification.
 */

class GoogleMeetSessionTracker {
  constructor() {
    this.meet = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Meet API client with service account or OAuth credentials
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Google APIs auth
      // For now, we'll use a placeholder - this will need proper OAuth integration
      // when we have Google Meet integration set up
      const auth = new google.auth.GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/meetings.space.readonly'
        ]
      });

      this.meet = google.meet({ version: 'v2', auth });
      this.initialized = true;

      console.log('✅ Google Meet Session Tracker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Meet API:', error);
      throw error;
    }
  }

  /**
   * Extract Google Meet conference ID from a meeting link
   * @param {string} meetingLink - Google Meet URL
   * @returns {string|null} - Conference ID or null if invalid
   */
  extractConferenceId(meetingLink) {
    if (!meetingLink) return null;

    try {
      // Google Meet URLs format: https://meet.google.com/{conference-id}
      const url = new URL(meetingLink);
      if (url.hostname === 'meet.google.com') {
        const conferenceId = url.pathname.substring(1); // Remove leading slash
        return conferenceId || null;
      }
      return null;
    } catch (error) {
      console.error('Invalid meeting link:', meetingLink, error);
      return null;
    }
  }

  /**
   * Get participant sessions from Google Meet API
   * @param {string} conferenceId - Google Meet conference ID
   * @returns {Array} - Array of participant session objects
   */
  async getParticipantSessions(conferenceId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get conference record
      const conferenceRecord = await this.meet.conferenceRecords.get({
        name: `conferenceRecords/${conferenceId}`
      });

      if (!conferenceRecord.data) {
        console.warn('No conference record found for:', conferenceId);
        return [];
      }

      // Get all participants
      const participantsResponse = await this.meet.conferenceRecords.participants.list({
        parent: `conferenceRecords/${conferenceId}`
      });

      const participants = participantsResponse.data.participants || [];
      const allSessions = [];

      // Get sessions for each participant
      for (const participant of participants) {
        const sessionsResponse = await this.meet.conferenceRecords.participants.participantSessions.list({
          parent: `conferenceRecords/${conferenceId}/participants/${participant.name.split('/').pop()}`
        });

        const sessions = sessionsResponse.data.participantSessions || [];

        // Add participant info to each session
        sessions.forEach(session => {
          allSessions.push({
            ...session,
            participantInfo: participant
          });
        });
      }

      return allSessions;
    } catch (error) {
      console.error('Error fetching participant sessions:', error);
      throw error;
    }
  }

  /**
   * Calculate total duration for a user's sessions
   * @param {Array} sessions - Array of session objects
   * @returns {number} - Total duration in seconds
   */
  calculateTotalDuration(sessions) {
    return sessions.reduce((total, session) => {
      if (!session.startTime || !session.endTime) {
        return total; // Skip active or incomplete sessions
      }

      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);
      const duration = Math.max(0, (endTime - startTime) / 1000); // Convert to seconds

      return total + duration;
    }, 0);
  }

  /**
   * Map Google user email to our database user ID
   * @param {string} email - Google account email
   * @returns {string|null} - User ID from our database
   */
  async mapEmailToUserId(email) {
    try {
      const { data: user, error } = await db
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (error || !user) {
        console.warn('Could not map email to user ID:', email);
        return null;
      }

      return user.id;
    } catch (error) {
      console.error('Error mapping email to user ID:', error);
      return null;
    }
  }

  /**
   * Filter sessions by user ID
   * @param {Array} allSessions - All participant sessions
   * @param {string} userId - User ID to filter by
   * @returns {Array} - Sessions for the specified user
   */
  async filterSessionsByUserId(allSessions, userId) {
    const userSessions = [];

    for (const session of allSessions) {
      // Get user email from participant info
      const participantEmail = session.participantInfo?.anonymousUser?.displayName ||
                              session.participantInfo?.signedinUser?.user;

      if (participantEmail) {
        const sessionUserId = await this.mapEmailToUserId(participantEmail);
        if (sessionUserId === userId) {
          userSessions.push({
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.endTime ?
              Math.max(0, (new Date(session.endTime) - new Date(session.startTime)) / 1000) :
              null
          });
        }
      }
    }

    return userSessions;
  }

  /**
   * Save session data to database
   * @param {string} bookingId - Booking ID
   * @param {Object} sessionData - Session duration data
   */
  async saveSessionData(bookingId, sessionData) {
    try {
      // Check if booking_session_data table exists
      const { error: tableError } = await db
        .from('booking_session_data')
        .select('booking_id')
        .limit(1);

      if (tableError && tableError.message.includes('relation "public.booking_session_data" does not exist')) {
        console.warn('⚠️ booking_session_data table does not exist, skipping session data save');
        return;
      }

      // Try to update existing record first, then insert if it doesn't exist
      const { error: updateError } = await db
        .from('booking_session_data')
        .update({
          provider_total_duration: sessionData.providerDuration,
          customer_total_duration: sessionData.customerDuration,
          provider_sessions: sessionData.sessions.provider,
          customer_sessions: sessionData.sessions.customer,
          last_checked_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId);

      // If update failed (no rows affected), insert new record
      if (updateError || updateError?.code === 'PGRST116') {
        const { error: insertError } = await db
          .from('booking_session_data')
          .insert({
            booking_id: bookingId,
            provider_total_duration: sessionData.providerDuration,
            customer_total_duration: sessionData.customerDuration,
            provider_sessions: sessionData.sessions.provider,
            customer_sessions: sessionData.sessions.customer,
            last_checked_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting session data:', insertError);
          return;
        }
      }

      console.log('✅ Session data saved for booking:', bookingId);
    } catch (error) {
      console.error('Failed to save session data:', error);
      // Don't throw - session data saving is not critical for booking completion
    }
  }

  /**
   * Main function to check Google Meet session duration for a booking
   * @param {string} bookingId - Booking ID to check
   * @returns {Object} - Session analysis results
   */
  async checkGoogleMeetSessionDuration(bookingId) {
    try {
      console.log('🔍 Checking Google Meet session duration for booking:', bookingId);

      // Get booking details
      const { data: booking, error: bookingError } = await db
        .from('bookings')
        .select(`
          id,
          provider_id,
          customer_id,
          meeting_link,
          service:services (
            duration_minutes
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error(`Booking not found: ${bookingId}`);
      }

      // Check if it's an online booking with Google Meet link
      if (!booking.meeting_link || !booking.meeting_link.includes('meet.google.com')) {
        console.log('⚠️ Not a Google Meet booking, skipping session tracking');
        return {
          success: false,
          reason: 'Not a Google Meet booking',
          providerDuration: 0,
          customerDuration: 0,
          serviceDuration: booking.service?.duration_minutes * 60 || 0,
          providerMeetsThreshold: true, // Don't block non-Meet bookings
          threshold: 0.9,
          sessions: { provider: [], customer: [] }
        };
      }

      // Extract conference ID
      const conferenceId = this.extractConferenceId(booking.meeting_link);
      if (!conferenceId) {
        throw new Error('Invalid Google Meet link format');
      }

      // Get all participant sessions
      const allSessions = await this.getParticipantSessions(conferenceId);

      // Filter sessions by provider and customer
      const providerSessions = await this.filterSessionsByUserId(allSessions, booking.provider_id);
      const customerSessions = await this.filterSessionsByUserId(allSessions, booking.customer_id);

      // Calculate total durations
      const providerDuration = this.calculateTotalDuration(providerSessions);
      const customerDuration = this.calculateTotalDuration(customerSessions);
      const serviceDuration = (booking.service?.duration_minutes || 0) * 60; // Convert to seconds

      // Check if provider meets 90% threshold
      const threshold = 0.9;
      const requiredDuration = serviceDuration * threshold;
      const providerMeetsThreshold = providerDuration >= requiredDuration;

      const result = {
        success: true,
        providerDuration,
        customerDuration,
        serviceDuration,
        providerMeetsThreshold,
        threshold,
        sessions: {
          provider: providerSessions,
          customer: customerSessions
        }
      };

      // Save session data to database
      await this.saveSessionData(bookingId, result);

      console.log(`✅ Session analysis complete:
        Provider: ${Math.round(providerDuration)}s / ${Math.round(serviceDuration)}s (${Math.round(providerDuration/serviceDuration*100)}%)
        Threshold met: ${providerMeetsThreshold}
      `);

      return result;

    } catch (error) {
      console.error('❌ Error checking Google Meet session duration:', error);

      // Return failure result but don't block booking completion
      // API failures shouldn't prevent legitimate bookings from completing
      return {
        success: false,
        error: error.message,
        providerDuration: 0,
        customerDuration: 0,
        serviceDuration: 0,
        providerMeetsThreshold: true, // Don't block on API failures
        threshold: 0.9,
        sessions: { provider: [], customer: [] }
      };
    }
  }
}

// Export singleton instance
export const googleMeetSessionTracker = new GoogleMeetSessionTracker();

// Export the main function for easy use
export const checkGoogleMeetSessionDuration = (bookingId) => {
  return googleMeetSessionTracker.checkGoogleMeetSessionDuration(bookingId);
};