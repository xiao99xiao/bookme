/**
 * Smart Booking Availability Service
 * 
 * This service handles all availability calculations for the booking system:
 * - Time slot generation based on service schedules
 * - Booking collision detection with buffer zones
 * - Calendar integration conflict detection
 * - Past time validation (current time + 1 hour minimum)
 * - Smart month-view availability calculation
 */

import { getSupabaseAdmin } from '../middleware/auth.js';

const supabaseAdmin = getSupabaseAdmin();

class AvailabilityService {
  constructor() {
    this.MINIMUM_ADVANCE_HOURS = 1; // Minimum 1 hour advance booking
    this.BUFFER_MINUTES = 60; // 1 hour buffer between bookings
    this.DEFAULT_SLOT_DURATION = 30; // 30-minute time slots
  }

  /**
   * Calculate month availability for calendar view
   * Returns which dates have available slots vs unavailable
   */
  async getMonthAvailability(serviceId, month, timezone = 'UTC') {
    try {
      console.log(`📅 Calculating month availability for service ${serviceId}, month ${month}`);
      
      // Get service with schedule
      const service = await this.getServiceWithSchedule(serviceId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Generate all days in the month
      const daysInMonth = this.getDaysInMonth(month);
      console.log(`📅 Processing ${daysInMonth.length} days in month ${month}`);

      // Get all bookings for the month to optimize database queries
      const startDate = new Date(month + '-01T00:00:00.000Z');
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      const monthBookings = await this.getBookingsForDateRange(
        service.provider_id, 
        startDate, 
        endDate
      );

      // Get calendar events for the month if integration exists
      const monthCalendarEvents = await this.getCalendarEventsForMonth(
        service.provider_id, 
        startDate, 
        endDate
      );

      // Calculate availability for each day in parallel
      const dailyAvailabilityPromises = daysInMonth.map(date => 
        this.calculateDayAvailability(
          service, 
          date, 
          timezone, 
          monthBookings, 
          monthCalendarEvents
        )
      );

      const dailyAvailability = await Promise.all(dailyAvailabilityPromises);

      // Separate available and unavailable dates
      const availableDates = dailyAvailability.filter(day => day.availableSlots > 0);
      const unavailableDates = dailyAvailability.filter(day => day.availableSlots === 0);

      // Find next available date if no availability in current month
      const nextAvailableDate = availableDates.length === 0 
        ? await this.findNextAvailableDate(service, endDate)
        : null;

      console.log(`✅ Month availability calculated: ${availableDates.length} available days, ${unavailableDates.length} unavailable days`);

      return {
        availableDates,
        unavailableDates,
        nextAvailableDate
      };

    } catch (error) {
      console.error('❌ Error calculating month availability:', error);
      console.error('❌ Error stack:', error.stack);
      console.error(`❌ Service ID: ${serviceId}, Month: ${month}, Timezone: ${timezone}`);
      throw error;
    }
  }

  /**
   * Calculate specific day availability with detailed time slots
   */
  async getDayAvailability(serviceId, date, timezone = 'UTC') {
    try {
      console.log(`🕐 Calculating day availability for service ${serviceId}, date ${date}, timezone ${timezone}`);

      // Get service with schedule
      const service = await this.getServiceWithSchedule(serviceId);
      if (!service) {
        console.error(`❌ Service not found: ${serviceId}`);
        throw new Error('Service not found');
      }

      console.log(`🔍 Service found: ${service.id}, availability_schedule:`, JSON.stringify(service.availability_schedule, null, 2));

      const targetDate = new Date(date);

      // Get bookings for this specific day
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayBookings = await this.getBookingsForDateRange(
        service.provider_id,
        dayStart,
        dayEnd
      );

      // Get calendar events for this day
      const calendarEvents = await this.getCalendarEventsForDay(
        service.provider_id,
        targetDate
      );

      // Calculate availability for this specific day
      const availability = await this.calculateDayAvailability(
        service,
        targetDate,
        timezone,
        dayBookings,
        calendarEvents,
        true // detailed = true for time slot breakdown
      );

      console.log(`✅ Day availability calculated: ${availability.availableSlots} slots available`);

      return {
        availableSlots: availability.availableTimeSlots || [],
        unavailableSlots: availability.unavailableTimeSlots || [],
        serviceSchedule: availability.serviceSchedule
      };

    } catch (error) {
      console.error('❌ Error calculating day availability:', error);
      throw error;
    }
  }

  /**
   * Core day availability calculation logic
   */
  async calculateDayAvailability(service, date, timezone, monthBookings, monthCalendarEvents, detailed = false) {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // 1. Check if service operates on this day of week
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      // Handle both new and legacy availability schedule formats
      let schedule;
      
      if (service.availability_schedule?.schedule?.[dayOfWeek]) {
        // New format: { schedule: { monday: { enabled: true, ... } } }
        schedule = service.availability_schedule.schedule[dayOfWeek];
      } else if (service.availability_schedule) {
        // Legacy format with day-hour schedule: { "friday-05": true, "tuesday-04": true }
        // Format: {day}-{hour} where hour is 24-hour format with leading zero
        const dayKeys = Object.keys(service.availability_schedule).filter(key => 
          key.startsWith(dayOfWeek + '-')
        );
        
        if (dayKeys.length > 0) {
          // Convert to expected format with available hours
          const availableHours = dayKeys.map(key => {
            const hour = key.split('-')[1];
            return `${hour}:00`;
          }).sort();
          
          schedule = {
            enabled: true,
            start: availableHours[0] || '09:00',
            end: availableHours[availableHours.length - 1] || '17:00',
            availableHours: availableHours
          };
        }
      }

      if (!schedule?.enabled) {
        return { 
          date: dateStr, 
          availableSlots: 0, 
          reason: 'no_service_hours',
          ...(detailed && { 
            availableTimeSlots: [], 
            unavailableTimeSlots: [],
            serviceSchedule: null 
          })
        };
      }

      // 2. Check for exceptions/holidays
      const exceptions = service.availability_schedule?.exceptions || [];
      const exception = exceptions.find(ex => ex.date === dateStr);

      if (exception && !exception.enabled) {
        return { 
          date: dateStr, 
          availableSlots: 0, 
          reason: 'provider_holiday',
          ...(detailed && { 
            availableTimeSlots: [], 
            unavailableTimeSlots: [],
            serviceSchedule: schedule 
          })
        };
      }

      // 3. Generate base time slots for this day
      const baseSlots = this.generateDayTimeSlots(schedule, date, timezone);

      // 4. Remove past slots (current time + minimum advance hours)
      const futureSlots = this.filterPastSlots(baseSlots, timezone);

      if (futureSlots.length === 0) {
        return { 
          date: dateStr, 
          availableSlots: 0, 
          reason: 'no_future_slots',
          ...(detailed && { 
            availableTimeSlots: [], 
            unavailableTimeSlots: baseSlots.map(slot => ({ 
              time: slot.toTimeString().substring(0, 5), 
              reason: 'past_time' 
            })),
            serviceSchedule: schedule 
          })
        };
      }

      // 5. Get relevant bookings for this day
      const dayBookings = monthBookings.filter(booking => {
        const bookingDate = new Date(booking.scheduled_at);
        return bookingDate.toDateString() === date.toDateString();
      });

      // 6. Get relevant calendar events for this day
      const dayCalendarEvents = monthCalendarEvents.filter(event => {
        const eventStart = new Date(event.start);
        return eventStart.toDateString() === date.toDateString();
      });

      // 7. Calculate available slots after conflicts
      const availabilityResult = this.calculateSlotAvailability(
        futureSlots,
        dayBookings,
        dayCalendarEvents,
        service.duration_minutes,
        detailed
      );

      const availableCount = detailed 
        ? availabilityResult.availableTimeSlots.length 
        : availabilityResult.availableSlots.length;

      return {
        date: dateStr,
        availableSlots: availableCount,
        reason: availableCount === 0 ? this.determineUnavailableReason(futureSlots, dayBookings, dayCalendarEvents) : null,
        ...(detailed && {
          availableTimeSlots: availabilityResult.availableTimeSlots,
          unavailableTimeSlots: availabilityResult.unavailableTimeSlots,
          serviceSchedule: schedule
        })
      };

    } catch (error) {
      console.error(`❌ Error calculating availability for ${dateStr}:`, error);
      console.error(`❌ Error stack:`, error.stack);
      console.error(`❌ Service data:`, JSON.stringify(service, null, 2));
      return { 
        date: dateStr, 
        availableSlots: 0, 
        reason: 'calculation_error',
        error: error.message, // Add error message for debugging
        ...(detailed && { 
          availableTimeSlots: [], 
          unavailableTimeSlots: [],
          serviceSchedule: null 
        })
      };
    }
  }

  /**
   * Calculate slot availability considering bookings and calendar conflicts
   */
  calculateSlotAvailability(timeSlots, bookings, calendarEvents, serviceDuration, detailed = false) {
    const availableTimeSlots = [];
    const unavailableTimeSlots = [];

    for (const slot of timeSlots) {
      const slotStart = new Date(slot);
      const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      // Check booking conflicts
      const bookingConflict = bookings.find(booking => {
        const bookingStart = new Date(booking.scheduled_at);
        const bookingEnd = new Date(bookingStart.getTime() + booking.duration_minutes * 60 * 1000 + this.BUFFER_MINUTES * 60 * 1000);
        
        return (slotStart < bookingEnd && slotEnd > bookingStart);
      });

      // Check calendar conflicts
      const calendarConflict = calendarEvents.find(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        
        return (slotStart < eventEnd && slotEnd > eventStart);
      });

      const timeString = slotStart.toTimeString().substring(0, 5);

      if (bookingConflict) {
        if (detailed) {
          unavailableTimeSlots.push({
            time: timeString,
            reason: 'booked',
            bookingId: bookingConflict.id
          });
        }
      } else if (calendarConflict) {
        if (detailed) {
          unavailableTimeSlots.push({
            time: timeString,
            reason: 'calendar_conflict',
            event: calendarConflict.title || 'Calendar Event'
          });
        }
      } else {
        if (detailed) {
          availableTimeSlots.push(timeString);
        } else {
          availableTimeSlots.push(slot);
        }
      }
    }

    return detailed 
      ? { availableTimeSlots, unavailableTimeSlots }
      : { availableSlots: availableTimeSlots };
  }

  /**
   * Generate time slots for a specific day based on service schedule
   */
  generateDayTimeSlots(schedule, date, timezone) {
    const slots = [];
    const slotDate = new Date(date);

    // If we have specific available hours (from legacy format conversion)
    if (schedule.availableHours && Array.isArray(schedule.availableHours)) {
      // Generate slots only for the explicitly available hours
      for (const hourTime of schedule.availableHours) {
        const [hour, minute] = hourTime.split(':').map(Number);
        const slotTime = new Date(slotDate);
        slotTime.setHours(hour, minute, 0, 0);
        slots.push(new Date(slotTime));
      }
    } else {
      // Fallback: generate continuous slots between start and end (for new format)
      const [startHour, startMinute] = schedule.start.split(':').map(Number);
      const [endHour, endMinute] = schedule.end.split(':').map(Number);

      const startTime = new Date(slotDate);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      const endTime = new Date(slotDate);
      endTime.setHours(endHour, endMinute, 0, 0);

      let currentSlot = new Date(startTime);

      while (currentSlot < endTime) {
        slots.push(new Date(currentSlot));
        currentSlot.setMinutes(currentSlot.getMinutes() + this.DEFAULT_SLOT_DURATION);
      }
    }

    return slots;
  }

  /**
   * Filter out past time slots (enforce minimum advance booking)
   */
  filterPastSlots(slots, timezone) {
    const now = new Date();
    const minimumTime = new Date(now.getTime() + this.MINIMUM_ADVANCE_HOURS * 60 * 60 * 1000);

    return slots.filter(slot => slot >= minimumTime);
  }

  /**
   * Get service with availability schedule
   */
  async getServiceWithSchedule(serviceId) {
    const { data: service, error } = await supabaseAdmin
      .from('services')
      .select('id, provider_id, duration_minutes, availability_schedule, service_timezone')
      .eq('id', serviceId)
      .eq('is_visible', true)
      .single();

    if (error) {
      console.error('Error fetching service:', error);
      return null;
    }

    return service;
  }

  /**
   * Get bookings for a date range (optimized for month queries)
   */
  async getBookingsForDateRange(providerId, startDate, endDate) {
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('id, scheduled_at, duration_minutes, status')
      .eq('provider_id', providerId)
      .gte('scheduled_at', startDate.toISOString())
      .lt('scheduled_at', endDate.toISOString())
      .in('status', ['confirmed', 'in_progress', 'pending', 'paid', 'pending_payment']);

    if (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }

    return bookings || [];
  }

  /**
   * Get calendar events for a month (will be implemented in calendar service)
   */
  async getCalendarEventsForMonth(providerId, startDate, endDate) {
    try {
      // Import calendar service dynamically to avoid circular dependencies
      const { CalendarService } = await import('./calendar-service.js');
      const calendarService = new CalendarService();
      
      return await calendarService.getProviderCalendarEvents(providerId, startDate, endDate);
    } catch (error) {
      console.error('Calendar service not available:', error);
      return []; // Graceful fallback - continue without calendar integration
    }
  }

  /**
   * Get calendar events for a specific day
   */
  async getCalendarEventsForDay(providerId, date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return await this.getCalendarEventsForMonth(providerId, dayStart, dayEnd);
  }

  /**
   * Generate all days in a month
   */
  getDaysInMonth(monthString) {
    const [year, month] = monthString.split('-').map(Number);
    const date = new Date(year, month - 1, 1); // month is 0-indexed
    const days = [];

    while (date.getMonth() === month - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    return days;
  }

  /**
   * Find the next available date after a given date
   */
  async findNextAvailableDate(service, afterDate) {
    // Search up to 3 months ahead for the next available date
    const searchDate = new Date(afterDate);
    const maxSearchDate = new Date(afterDate);
    maxSearchDate.setMonth(maxSearchDate.getMonth() + 3);

    while (searchDate <= maxSearchDate) {
      const availability = await this.calculateDayAvailability(
        service,
        searchDate,
        'UTC',
        [], // Empty bookings array for future dates
        []  // Empty calendar events for future dates
      );

      if (availability.availableSlots > 0) {
        return searchDate.toISOString().split('T')[0];
      }

      searchDate.setDate(searchDate.getDate() + 1);
    }

    return null; // No availability found in next 3 months
  }

  /**
   * Determine why a date is unavailable
   */
  determineUnavailableReason(baseSlots, bookings, calendarEvents) {
    if (baseSlots.length === 0) return 'no_future_slots';
    if (bookings.length > 0) return 'fully_booked';
    if (calendarEvents.length > 0) return 'calendar_conflicts';
    return 'unknown';
  }
}

// Export singleton instance
const availabilityService = new AvailabilityService();
export default availabilityService;