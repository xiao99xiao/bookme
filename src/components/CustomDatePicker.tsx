import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomDatePickerProps {
  onDateTimeSelect: (date: Date) => void;
  selectedDateTime: Date | null;
  serviceDuration: number;
}

const CustomDatePicker = ({ onDateTimeSelect, selectedDateTime, serviceDuration }: CustomDatePickerProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

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

  // Generate time slots
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30'
  ];

  const handleDateClick = (date: Date) => {
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

  return (
    <div className="flex flex-col gap-6">
      {/* Calendar */}
      <div className="bg-white border border-[#eeeeee] rounded-[16px] p-4 flex flex-col gap-[22px]">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <h3 className="font-['Baloo_2'] font-semibold text-[18px] text-black leading-[1.5]">
            {formatMonthYear(currentMonth)}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="w-12 h-12 flex items-center justify-center border border-[#cccccc] rounded-[12px] hover:bg-gray-50"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="w-12 h-12 flex items-center justify-center border border-[#cccccc] rounded-[12px] hover:bg-gray-50"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => day.isCurrentMonth && handleDateClick(day.date)}
              disabled={!day.isCurrentMonth}
              className={cn(
                "h-12 flex items-center justify-center rounded-[12px] font-['Baloo_2'] text-[18px] leading-[1.5] transition-colors",
                day.isCurrentMonth ? 'font-semibold' : 'font-semibold',
                !day.isCurrentMonth && 'text-[#aaaaaa] cursor-default',
                day.isCurrentMonth && !isDateSelected(day.date) && !day.isWeekend && 'text-black hover:bg-gray-50',
                day.isCurrentMonth && day.isWeekend && !isDateSelected(day.date) && 'text-[#f1343d] bg-[#ffeff0]',
                isDateSelected(day.date) && 'bg-[#3b9ef9] text-white'
              )}
            >
              {day.date.getDate()}
            </button>
          ))}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div className="flex flex-col gap-4">
          <h4 className="font-['Baloo_2'] font-semibold text-[16px] text-black leading-[1.5]">
            Available Times: {formatSelectedDate()}
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => handleTimeClick(time)}
                className={cn(
                  "h-12 flex items-center justify-center rounded-[12px] font-['Baloo_2'] font-semibold text-[18px] leading-[1.5] transition-colors",
                  selectedTime === time
                    ? 'bg-[#3b9ef9] text-white'
                    : 'bg-white border border-[#cccccc] text-black hover:bg-gray-50'
                )}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Date/Time Confirmation */}
      {selectedDate && selectedTime && (
        <div className="bg-[#eff7ff] border border-[#3b9ef9] rounded-[16px] p-4 flex flex-col gap-2">
          <div className="flex gap-2 items-baseline text-[18px]">
            <span className="font-['Baloo_2'] font-semibold text-black leading-[1.5]">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
            <span className="font-['Baloo_2'] font-normal text-[#cccccc] text-center leading-[1.5]">|</span>
            <span className="font-['Baloo_2'] font-semibold text-black leading-[1.5]">
              {(() => {
                const [hours, minutes] = selectedTime.split(':').map(Number);
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
              })()}
            </span>
          </div>
          <div className="flex gap-2 items-baseline">
            <span className="font-['Baloo_2'] font-semibold text-black text-[18px] leading-[1.5]">{serviceDuration} minutes</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;