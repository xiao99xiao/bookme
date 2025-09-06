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
    
    // Step 2: Update in_progress bookings to completed (when end time has passed)
    const inProgressToCompleted = await transitionInProgressToCompleted(nowISO);
    
    // Step 3: Auto-complete ongoing bookings that are past end time + 30 minutes
    const ongoingToCompleted = await transitionOngoingToCompleted(nowISO);
    
    // Step 4: Send upcoming booking reminders (placeholder for now)
    const remindersSent = await sendUpcomingReminders(now);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Automation job completed in ${duration}ms`);
    console.log(`📊 Summary: ${confirmedToInProgress} started, ${inProgressToCompleted} in_progress->completed, ${ongoingToCompleted} ongoing->completed, ${remindersSent} reminders sent`);
    
    return {
      success: true,
      duration,
      transitions: {
        confirmedToInProgress,
        inProgressToCompleted,
        ongoingToCompleted,
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
      .select('id, scheduled_at, duration_minutes, customer_id, provider_id, service_id')
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

    // Update status to completed
    const bookingIds = bookingsToComplete.map(b => b.id);
    const { error: updateError, count } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: 'completed',
        completed_at: nowISO,
        updated_at: nowISO
      })
      .in('id', bookingIds);

    if (updateError) {
      console.error('Error updating bookings to completed:', updateError);
      return 0;
    }

    console.log(`✅ Successfully completed ${count || bookingIds.length} bookings`);
    return count || bookingIds.length;

  } catch (error) {
    console.error('Error in transitionInProgressToCompleted:', error);
    return 0;
  }
}

/**
 * Transition ongoing bookings to completed when end time + 30 minutes has passed
 * This gives a grace period for providers to mark bookings complete manually
 */
async function transitionOngoingToCompleted(nowISO) {
  console.log('🏁 Checking ongoing bookings to auto-complete (past end time + 30 min)...');
  
  try {
    // Find ongoing bookings
    const { data: ongoingBookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, scheduled_at, duration_minutes')
      .eq('status', 'ongoing');

    if (fetchError) {
      console.error('Error fetching ongoing bookings:', fetchError);
      return 0;
    }

    if (!ongoingBookings || ongoingBookings.length === 0) {
      console.log('📋 No ongoing bookings to check');
      return 0;
    }

    // Filter bookings that should be completed (end time + 30 min has passed)
    const now = new Date();
    const bookingsToComplete = [];
    const GRACE_PERIOD_MINUTES = 30;

    for (const booking of ongoingBookings) {
      const startTime = new Date(booking.scheduled_at);
      const endTime = new Date(startTime.getTime() + (booking.duration_minutes * 60 * 1000));
      const gracePeriodEnd = new Date(endTime.getTime() + (GRACE_PERIOD_MINUTES * 60 * 1000));
      
      if (gracePeriodEnd <= now) {
        bookingsToComplete.push(booking);
        console.log(`📋 Booking ${booking.id.slice(0, 8)}... should auto-complete (grace period ended at ${gracePeriodEnd.toISOString()})`);
      }
    }

    if (bookingsToComplete.length === 0) {
      console.log('📋 No ongoing bookings to auto-complete yet');
      return 0;
    }

    console.log(`📋 Found ${bookingsToComplete.length} bookings to auto-complete`);

    // Update status to completed
    const bookingIds = bookingsToComplete.map(b => b.id);
    const { error: updateError, count } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: 'completed',
        completed_at: nowISO,
        updated_at: nowISO,
        auto_status_updated: true  // Mark that this was auto-completed
      })
      .in('id', bookingIds);

    if (updateError) {
      console.error('Error updating ongoing bookings to completed:', updateError);
      return 0;
    }

    console.log(`✅ Successfully auto-completed ${count || bookingIds.length} ongoing bookings`);
    return count || bookingIds.length;

  } catch (error) {
    console.error('Error in transitionOngoingToCompleted:', error);
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