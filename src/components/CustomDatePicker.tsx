import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ApiClient from '@/lib/api-migration';

interface CustomDatePickerProps {
  onDateTimeSelect: (date: Date) => void;
  selectedDateTime: Date | null;
  serviceDuration: number;
  serviceId: string;
  timezone?: string;
}

interface DayAvailability {
  date: string;
  availableSlots: number;
  reason?: string;
}

interface DaySlotAvailability {
  availableSlots: string[];
  unavailableSlots: Array<{
    time: string;
    reason: string;
    bookingId?: string;
    event?: string;
  }>;
  serviceSchedule: { start: string; end: string } | null;
}

const CustomDatePicker = ({ 
  onDateTimeSelect, 
  selectedDateTime, 
  serviceDuration, 
  serviceId,
  timezone = 'UTC'
}: CustomDatePickerProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  // Availability state
  const [monthAvailability, setMonthAvailability] = useState<{
    availableDates: DayAvailability[];
    unavailableDates: DayAvailability[];
  } | null>(null);
  const [dayAvailability, setDayAvailability] = useState<DaySlotAvailability | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch month availability when month changes
  useEffect(() => {
    fetchMonthAvailability();
  }, [currentMonth, serviceId, timezone]);

  // Fetch day availability when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchDayAvailability();
    } else {
      setDayAvailability(null);
    }
  }, [selectedDate, serviceId, timezone]);

  const fetchMonthAvailability = async () => {
    try {
      setLoadingCalendar(true);
      setError(null);
      
      const monthString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const data = await ApiClient.getServiceCalendarAvailability(serviceId, monthString, timezone);
      
      setMonthAvailability(data);
    } catch (err) {
      console.error('Error fetching month availability:', err);
      setError('Unable to load calendar availability');
      setMonthAvailability(null);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const fetchDayAvailability = async () => {
    if (!selectedDate) return;
    
    try {
      setLoadingTimeSlots(true);
      setError(null);
      
      // Fix timezone issue - use local date components instead of UTC conversion
      const dateString = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;
      console.log(`🗓️ [FRONTEND DEBUG] Fetching day availability for:`, {
        serviceId,
        dateString,
        timezone,
        selectedDate: selectedDate.toISOString()
      });
      
      const data = await ApiClient.getServiceDayAvailability(serviceId, dateString, timezone);
      
      console.log(`🗓️ [FRONTEND DEBUG] Day availability response:`, {
        availableSlots: data.availableSlots?.length || 0,
        unavailableSlots: data.unavailableSlots?.length || 0,
        serviceSchedule: data.serviceSchedule,
        fullResponse: data
      });
      
      setDayAvailability(data);
    } catch (err) {
      console.error('Error fetching day availability:', err);
      setError('Unable to load time slots');
      setDayAvailability(null);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add previous month's trailing days
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
        isWeekend: false,
      });
    }

    // Add current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const dayOfWeek = dayDate.getDay();
      days.push({
        date: dayDate,
        isCurrentMonth: true,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }

    // Add next month's leading days to complete the grid
    const remainingDays = 35 - days.length; // 5 rows × 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isWeekend: false,
      });
    }

    return days;
  };

  // Check if a date is available for booking
  const isDateAvailable = (date: Date): boolean => {
    if (!monthAvailability) return false;
    
    const dateString = date.toISOString().split('T')[0];
    return monthAvailability.availableDates.some(d => d.date === dateString);
  };

  // Get availability info for a date
  const getDateAvailabilityInfo = (date: Date) => {
    if (!monthAvailability) return null;
    
    const dateString = date.toISOString().split('T')[0];
    const available = monthAvailability.availableDates.find(d => d.date === dateString);
    const unavailable = monthAvailability.unavailableDates.find(d => d.date === dateString);
    
    return available || unavailable || null;
  };

  // Get reason text for unavailable date
  const getUnavailableReason = (reason: string): string => {
    switch (reason) {
      case 'no_service_hours':
        return 'No service hours';
      case 'provider_holiday':
        return 'Provider holiday';
      case 'no_future_slots':
        return 'Past date';
      case 'fully_booked':
        return 'Fully booked';
      case 'calendar_conflicts':
        return 'Provider busy';
      default:
        return 'Unavailable';
    }
  };

  const handleDateClick = (date: Date) => {
    if (!isDateAvailable(date)) return;
    
    setSelectedDate(date);
    setSelectedTime(null); // Reset time when date changes
  };

  const handleTimeClick = (time: string) => {
    if (selectedDate) {
      const [hours, minutes] = time.split(':').map(Number);
      const dateTime = new Date(selectedDate);
      dateTime.setHours(hours, minutes, 0, 0);
      setSelectedTime(time);
      onDateTimeSelect(dateTime);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
    // Reset selected date and time when changing months
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const days = getDaysInMonth(currentMonth);

  // Check if a date is selected
  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  // Format selected date for display
  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    return selectedDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get unavailable slot reason text
  const getSlotUnavailableReason = (slot: { time: string; reason: string; bookingId?: string; event?: string }): string => {
    switch (slot.reason) {
      case 'booked':
        return 'Already booked';
      case 'calendar_conflict':
        return slot.event ? `Busy: ${slot.event}` : 'Calendar conflict';
      case 'past_time':
        return 'Past time';
      default:
        return 'Unavailable';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 font-body text-[14px]">{error}</p>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white border border-[#eeeeee] rounded-[16px] p-4 flex flex-col gap-[22px]">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <h3 className="font-body font-semibold text-[18px] text-black leading-[1.5]">
            {formatMonthYear(currentMonth)}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="w-12 h-12 flex items-center justify-center border border-[#cccccc] rounded-[12px] hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="w-12 h-12 flex items-center justify-center border border-[#cccccc] rounded-[12px] hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Loading state for calendar */}
        {loadingCalendar && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b9ef9]"></div>
          </div>
        )}

        {/* Calendar Grid */}
        {!loadingCalendar && (
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const isCurrentMonth = day.isCurrentMonth;
              const isAvailable = isCurrentMonth && isDateAvailable(day.date);
              const availabilityInfo = isCurrentMonth ? getDateAvailabilityInfo(day.date) : null;
              const isSelected = isDateSelected(day.date);
              const isPast = day.date < new Date(new Date().setHours(0, 0, 0, 0));
              
              return (
                <div key={index} className="relative">
                  <button
                    onClick={() => isCurrentMonth && isAvailable && handleDateClick(day.date)}
                    disabled={!isCurrentMonth || !isAvailable}
                    title={
                      !isCurrentMonth ? '' :
                      !isAvailable && availabilityInfo ? getUnavailableReason(availabilityInfo.reason || '') :
                      isAvailable ? `${availabilityInfo?.availableSlots || 0} slots available` : ''
                    }
                    className={cn(
                      "h-12 w-full flex items-center justify-center rounded-[12px] font-body text-[18px] leading-[1.5] transition-all duration-200 relative",
                      
                      // Base styles
                      !isCurrentMonth && 'text-[#aaaaaa] cursor-default font-semibold',
                      
                      // Current month available dates
                      isCurrentMonth && isAvailable && !isSelected && 'text-black hover:bg-blue-50 font-semibold cursor-pointer hover:border-[#3b9ef9] border border-transparent',
                      
                      // Current month unavailable dates
                      isCurrentMonth && !isAvailable && !isPast && 'text-[#cccccc] cursor-not-allowed font-semibold bg-gray-50',
                      
                      // Past dates
                      isCurrentMonth && isPast && 'text-[#cccccc] cursor-not-allowed font-semibold opacity-50',
                      
                      // Selected date
                      isSelected && 'bg-[#3b9ef9] text-white font-semibold shadow-lg',
                      
                      // Weekend styling for available dates
                      isCurrentMonth && day.isWeekend && isAvailable && !isSelected && 'bg-blue-50'
                    )}
                  >
                    {day.date.getDate()}
                    
                    {/* Availability indicator */}
                    {isCurrentMonth && availabilityInfo && (
                      <div className={cn(
                        "absolute -top-1 -right-1 w-3 h-3 rounded-full",
                        isAvailable ? 'bg-green-400' : 'bg-red-400'
                      )} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Availability Legend */}
        {!loadingCalendar && (
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span className="font-body text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <span className="font-body text-gray-600">Unavailable</span>
            </div>
          </div>
        )}
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-[#3b9ef9]" />
            <h4 className="font-body font-semibold text-[16px] text-black leading-[1.5]">
              Available Times: {formatSelectedDate()}
            </h4>
          </div>

          {/* Loading state for time slots */}
          {loadingTimeSlots && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3b9ef9]"></div>
            </div>
          )}

          {/* Time slots grid */}
          {!loadingTimeSlots && dayAvailability && (
            <>
              {dayAvailability.availableSlots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {dayAvailability.availableSlots.map((time) => (
                    <button
                      key={time}
                      onClick={() => handleTimeClick(time)}
                      className={cn(
                        "h-12 flex items-center justify-center rounded-[12px] font-body font-semibold text-[16px] leading-[1.5] transition-all duration-200",
                        selectedTime === time
                          ? 'bg-[#3b9ef9] text-white shadow-lg'
                          : 'bg-white border border-[#cccccc] text-black hover:bg-blue-50 hover:border-[#3b9ef9]'
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-[16px] p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  <p className="text-orange-700 font-body text-[14px]">
                    No available time slots for this date. Please select another date.
                  </p>
                </div>
              )}

              {/* Show unavailable slots for transparency */}
              {dayAvailability.unavailableSlots.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer font-body text-gray-600 text-[14px] hover:text-gray-800">
                    Show unavailable times ({dayAvailability.unavailableSlots.length})
                  </summary>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {dayAvailability.unavailableSlots.map((slot, index) => (
                      <div
                        key={index}
                        title={getSlotUnavailableReason(slot)}
                        className="h-12 flex items-center justify-center rounded-[12px] font-body font-semibold text-[14px] leading-[1.5] bg-gray-100 text-gray-400 cursor-not-allowed"
                      >
                        {slot.time}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {/* No time slots available */}
          {!loadingTimeSlots && !dayAvailability && (
            <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 font-body text-[14px]">
                Unable to load time slots. Please try again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selected Date/Time Confirmation */}
      {selectedDate && selectedTime && (
        <div className="bg-[#eff7ff] border border-[#3b9ef9] rounded-[16px] p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-[#3b9ef9]" />
            <span className="font-body font-semibold text-[#3b9ef9] text-[16px]">Booking Details</span>
          </div>
          <div className="flex gap-2 items-baseline text-[18px]">
            <span className="font-body font-semibold text-black leading-[1.5]">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
            <span className="font-body font-normal text-[#cccccc] text-center leading-[1.5]">|</span>
            <span className="font-body font-semibold text-black leading-[1.5]">
              {(() => {
                const [hours, minutes] = selectedTime.split(':').map(Number);
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
              })()}
            </span>
          </div>
          <div className="flex gap-2 items-baseline">
            <span className="font-body font-semibold text-black text-[18px] leading-[1.5]">{serviceDuration} minutes</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;