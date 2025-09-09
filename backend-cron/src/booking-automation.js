/**
 * Booking Automation Logic
 * Handles time-based booking status transitions and notifications
 */

import { supabaseAdmin } from './supabase-admin.js';

/**
 * Main automation function - updates booking statuses based on time
 */
export async function updateBookingStatuses() {
  const startTime = Date.now();
  console.log('🤖 Starting booking automation job...');
  
  try {
    // Get current time
    const now = new Date();
    const nowISO = now.toISOString();
    
    console.log(`⏰ Current time: ${nowISO}`);

    // Step 1: Update confirmed bookings to in_progress (when start time has passed)
    const confirmedToInProgress = await transitionConfirmedToInProgress(nowISO);
    
    // Step 2: Update in_progress bookings to completed (when end time has passed) via blockchain
    const inProgressToCompleted = await transitionInProgressToCompleted(nowISO);
    
    // Step 3: Send upcoming booking reminders (placeholder for now)
    const remindersSent = await sendUpcomingReminders(now);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Automation job completed in ${duration}ms`);
    console.log(`📊 Summary: ${confirmedToInProgress} started, ${inProgressToCompleted} blockchain-completed, ${remindersSent} reminders sent`);
    
    return {
      success: true,
      duration,
      transitions: {
        confirmedToInProgress,
        inProgressToCompleted,
        remindersSent
      }
    };
    
  } catch (error) {
    console.error('❌ Booking automation failed:', error);
    throw error;
  }
}

/**
 * Transition confirmed bookings to in_progress when start time has passed
 */
async function transitionConfirmedToInProgress(nowISO) {
  console.log('🔄 Checking confirmed bookings to start...');
  
  try {
    // Find confirmed bookings whose start time has passed
    const { data: bookingsToStart, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, scheduled_at, duration_minutes, customer_id, provider_id, service_id, is_online, meeting_link')
      .eq('status', 'confirmed')
      .lte('scheduled_at', nowISO);

    if (fetchError) {
      console.error('Error fetching confirmed bookings:', fetchError);
      return 0;
    }

    if (!bookingsToStart || bookingsToStart.length === 0) {
      console.log('📋 No confirmed bookings to start');
      return 0;
    }

    console.log(`📋 Found ${bookingsToStart.length} bookings to start:`, 
      bookingsToStart.map(b => `${b.id.slice(0, 8)}... (${b.scheduled_at})`));

    // Update status to in_progress
    const bookingIds = bookingsToStart.map(b => b.id);
    const { error: updateError, count } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: 'in_progress',
        updated_at: nowISO
      })
      .in('id', bookingIds);

    if (updateError) {
      console.error('Error updating bookings to in_progress:', updateError);
      return 0;
    }

    console.log(`✅ Successfully started ${count || bookingIds.length} bookings`);
    
    // Generate meeting links for online bookings that don't have one yet (fallback)
    const onlineBookingsWithoutLink = bookingsToStart.filter(b => b.is_online && !b.meeting_link);
    if (onlineBookingsWithoutLink.length > 0) {
      console.log(`🔗 Generating meeting links for ${onlineBookingsWithoutLink.length} online bookings without links (fallback)...`);
      
      // Process meeting links in parallel
      await Promise.allSettled(
        onlineBookingsWithoutLink.map(async (booking) => {
          try {
            // Import meeting generation function
            const { generateMeetingLinkForBooking } = await import('../../backend/src/meeting-generation.js');
            const meetingLink = await generateMeetingLinkForBooking(booking.id);
            if (meetingLink) {
              console.log(`✅ Meeting link generated for booking ${booking.id.slice(0, 8)}... (fallback)`);
            } else {
              console.log(`⚠️ No meeting link generated for booking ${booking.id.slice(0, 8)}... (provider may not have integrations)`);
            }
          } catch (error) {
            console.error(`❌ Failed to generate meeting link for booking ${booking.id}:`, error);
          }
        })
      );
    }
    
    return count || bookingIds.length;

  } catch (error) {
    console.error('Error in transitionConfirmedToInProgress:', error);
    return 0;
  }
}

/**
 * Transition in_progress bookings to completed when end time has passed
 */
async function transitionInProgressToCompleted(nowISO) {
  console.log('🏁 Checking in_progress bookings to complete...');
  
  try {
    // Find in_progress bookings
    const { data: inProgressBookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, scheduled_at, duration_minutes')
      .eq('status', 'in_progress');

    if (fetchError) {
      console.error('Error fetching in_progress bookings:', fetchError);
      return 0;
    }

    if (!inProgressBookings || inProgressBookings.length === 0) {
      console.log('📋 No in_progress bookings to check');
      return 0;
    }

    // Filter bookings that should be completed (end time has passed)
    const now = new Date();
    const bookingsToComplete = [];

    for (const booking of inProgressBookings) {
      const startTime = new Date(booking.scheduled_at);
      const endTime = new Date(startTime.getTime() + (booking.duration_minutes * 60 * 1000));
      
      if (endTime <= now) {
        bookingsToComplete.push(booking);
        console.log(`📋 Booking ${booking.id.slice(0, 8)}... should complete (ended at ${endTime.toISOString()})`);
      }
    }

    if (bookingsToComplete.length === 0) {
      console.log('📋 No in_progress bookings to complete yet');
      return 0;
    }

    console.log(`📋 Found ${bookingsToComplete.length} bookings to complete`);

    // Complete services via blockchain (backend will call smart contract)
    let completedCount = 0;
    for (const booking of bookingsToComplete) {
      try {
        console.log(`🎉 Auto-completing booking ${booking.id.slice(0, 8)}... via blockchain`);
        
        // Call backend endpoint to complete service on blockchain
        const response = await fetch(`http://localhost:4001/api/bookings/${booking.id}/complete-service-backend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Blockchain completion successful for ${booking.id.slice(0, 8)}...: ${result.txHash}`);
          completedCount++;
        } else {
          const error = await response.text();
          console.error(`❌ Blockchain completion failed for ${booking.id.slice(0, 8)}...:`, error);
          
          // Fallback: Update database directly if blockchain fails
          await supabaseAdmin
            .from('bookings')
            .update({ 
              status: 'completed',
              completed_at: nowISO,
              updated_at: nowISO,
              auto_status_updated: true,
              completion_notes: 'Auto-completed by cron (blockchain completion failed)'
            })
            .eq('id', booking.id);
          
          completedCount++;
        }
      } catch (error) {
        console.error(`❌ Error completing booking ${booking.id}:`, error);
        
        // Fallback: Update database directly if request fails
        try {
          await supabaseAdmin
            .from('bookings')
            .update({ 
              status: 'completed',
              completed_at: nowISO,
              updated_at: nowISO,
              auto_status_updated: true,
              completion_notes: 'Auto-completed by cron (blockchain call failed)'
            })
            .eq('id', booking.id);
          
          completedCount++;
        } catch (dbError) {
          console.error(`❌ Failed to update booking ${booking.id} as fallback:`, dbError);
        }
      }
    }

    console.log(`✅ Successfully completed ${completedCount} bookings (${bookingsToComplete.length - completedCount} failures handled with fallback)`);
    return completedCount;

  } catch (error) {
    console.error('Error in transitionInProgressToCompleted:', error);
    return 0;
  }
}


/**
 * Send upcoming booking reminders (placeholder implementation)
 * TODO: Implement email/push notifications in Phase 2
 */
async function sendUpcomingReminders(now) {
  console.log('📧 Checking for upcoming booking reminders...');
  
  try {
    // Find bookings starting in the next 1-2 hours that need reminders
    const oneHour = new Date(now.getTime() + (60 * 60 * 1000));
    const twoHours = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    
    const { data: upcomingBookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, 
        scheduled_at, 
        customer_id,
        provider_id,
        services!inner(title),
        reminder_1h_sent
      `)
      .eq('status', 'confirmed')
      .gte('scheduled_at', oneHour.toISOString())
      .lte('scheduled_at', twoHours.toISOString())
      .is('reminder_1h_sent', null); // Only bookings that haven't received reminder yet

    if (error) {
      console.error('Error fetching upcoming bookings:', error);
      return 0;
    }

    if (!upcomingBookings || upcomingBookings.length === 0) {
      console.log('📧 No upcoming bookings need reminders');
      return 0;
    }

    console.log(`📧 Found ${upcomingBookings.length} bookings needing reminders`);

    // TODO: Replace with actual email/push notification service
    for (const booking of upcomingBookings) {
      await sendBookingReminder(booking);
    }

    // Mark reminders as sent
    const bookingIds = upcomingBookings.map(b => b.id);
    await supabaseAdmin
      .from('bookings')
      .update({ reminder_1h_sent: now.toISOString() })
      .in('id', bookingIds);

    console.log(`✅ Successfully sent ${upcomingBookings.length} reminders`);
    return upcomingBookings.length;

  } catch (error) {
    console.error('Error in sendUpcomingReminders:', error);
    return 0;
  }
}

/**
 * Send booking reminder (placeholder implementation)
 * TODO: Implement actual email/SMS/push notification
 */
async function sendBookingReminder(booking) {
  console.log(`📧 [PLACEHOLDER] Sending reminder for booking ${booking.id.slice(0, 8)}...`);
  console.log(`   Service: ${booking.services.title}`);
  console.log(`   Scheduled: ${booking.scheduled_at}`);
  console.log(`   Customer: ${booking.customer_id}`);
  console.log(`   Provider: ${booking.provider_id}`);
  
  // TODO: Implement actual notification sending
  // Examples:
  // - await emailService.sendBookingReminder(booking)
  // - await pushNotificationService.send(booking.customer_id, reminder)
  // - await smsService.sendReminder(booking.customer_phone, message)
  
  return true;
}