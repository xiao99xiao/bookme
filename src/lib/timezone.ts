/**
 * Timezone utility functions for handling time conversions
 */

// Time slot key format: "monday-09", "tuesday-14", etc.
type TimeSlotKey = string;
type TimeSlots = { [key: TimeSlotKey]: boolean };

/**
 * Convert time slots from one timezone to another
 * @param timeSlots Original time slots object
 * @param fromTimezone Source timezone (e.g., 'America/New_York')
 * @param toTimezone Target timezone (e.g., 'UTC')
 * @returns Converted time slots
 */
export function convertTimeSlotsTimezone(
  timeSlots: TimeSlots,
  fromTimezone: string,
  toTimezone: string
): TimeSlots {
  if (fromTimezone === toTimezone) {
    return timeSlots;
  }

  const convertedSlots: TimeSlots = {};
  const now = new Date();

  // Get the current week's Monday as our reference point
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  Object.keys(timeSlots).forEach(slotKey => {
    const [dayName, hourStr] = slotKey.split('-');
    const hour = parseInt(hourStr, 10);
    const dayIndex = dayNames.indexOf(dayName);

    if (dayIndex === -1) return;

    // Create a date for this time slot in the original timezone
    const slotDate = new Date(monday);
    slotDate.setDate(monday.getDate() + ((dayIndex + 6) % 7)); // Adjust for Monday = 0
    slotDate.setHours(hour, 0, 0, 0);

    try {
      // Convert from source timezone to target timezone
      const sourceTime = new Date(slotDate.toLocaleString('en-US', { timeZone: fromTimezone }));
      const targetTime = new Date(slotDate.toLocaleString('en-US', { timeZone: toTimezone }));
      
      // Calculate the time difference
      const timeDiff = sourceTime.getTime() - targetTime.getTime();
      const convertedDate = new Date(slotDate.getTime() - timeDiff);

      const convertedDay = dayNames[convertedDate.getDay()];
      const convertedHour = convertedDate.getHours().toString().padStart(2, '0');
      const convertedKey = `${convertedDay}-${convertedHour}`;

      // Only add if it's a valid day (not extending beyond the week)
      if (convertedDate.getDate() >= monday.getDate() && 
          convertedDate.getDate() < monday.getDate() + 7) {
        convertedSlots[convertedKey] = true;
      }
    } catch (error) {
      console.error('Error converting timezone for slot:', slotKey, error);
      // Fallback: keep original slot
      convertedSlots[slotKey] = true;
    }
  });

  return convertedSlots;
}

/**
 * Convert a date/time from one timezone to another
 * @param date The date to convert
 * @param fromTimezone Source timezone
 * @param toTimezone Target timezone
 * @returns Converted date
 */
export function convertDateTimezone(
  date: Date,
  fromTimezone: string,
  toTimezone: string
): Date {
  if (fromTimezone === toTimezone) {
    return date;
  }

  try {
    // Create date string in source timezone
    const sourceString = date.toLocaleString('sv-SE', { timeZone: fromTimezone });
    const sourceDate = new Date(sourceString);
    
    // Create date string in target timezone  
    const targetString = date.toLocaleString('sv-SE', { timeZone: toTimezone });
    const targetDate = new Date(targetString);
    
    // Calculate offset and apply
    const offset = sourceDate.getTime() - targetDate.getTime();
    return new Date(date.getTime() - offset);
  } catch (error) {
    console.error('Error converting date timezone:', error);
    return date;
  }
}

/**
 * Get user's timezone from browser if available
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
}

/**
 * Format a date in a specific timezone
 * @param date Date to format
 * @param timezone Target timezone
 * @param options Intl.DateTimeFormatOptions
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      ...options
    });
  } catch (error) {
    console.error('Error formatting date in timezone:', error);
    return date.toLocaleString('en-US', options);
  }
}

/**
 * Get timezone offset in hours for display purposes
 * @param timezone Timezone identifier  
 * @returns Offset string like "GMT+8" or "GMT-5"
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    
    // Use Intl.DateTimeFormat to get the offset
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'longOffset'
    });
    
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');
    
    if (offsetPart && offsetPart.value) {
      // The value will be like "GMT+08:00" or "GMT-05:00"
      let offset = offsetPart.value;
      
      // Simplify the format to "GMT+8" instead of "GMT+08:00"
      if (offset.includes(':00')) {
        offset = offset.replace(':00', '');
      }
      if (offset.includes('+0')) {
        offset = offset.replace('+0', '+');
      }
      if (offset.includes('-0')) {
        offset = offset.replace('-0', '-');
      }
      
      return offset;
    }
    
    // Fallback for older browsers or unsupported timezones
    return 'GMT+0';
  } catch (error) {
    console.warn('Could not get timezone offset for:', timezone, error);
    return 'GMT+0';
  }
}