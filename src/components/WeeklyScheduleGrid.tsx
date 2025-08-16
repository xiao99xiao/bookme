'use client';

import { Check } from 'lucide-react';

interface WeeklyScheduleGridProps {
  selectedSlots: Record<string, string[]>;
  onSlotsChange: (slots: Record<string, string[]>) => void;
}

const days = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

// Generate all 24 hours (0-23)
const hours = Array.from({ length: 24 }, (_, i) => {
  const hour24 = i;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const period = hour24 < 12 ? 'AM' : 'PM';
  const label = `${hour12}:00 ${period}`;
  const value = `${hour24.toString().padStart(2, '0')}:00`;
  
  return {
    hour24,
    label,
    value,
  };
});

export default function WeeklyScheduleGrid({ selectedSlots, onSlotsChange }: WeeklyScheduleGridProps) {
  const toggleSlot = (day: string, timeValue: string) => {
    const currentDaySlots = selectedSlots[day] || [];
    const updatedDaySlots = currentDaySlots.includes(timeValue)
      ? currentDaySlots.filter(slot => slot !== timeValue)
      : [...currentDaySlots, timeValue].sort();

    const updatedSlots = {
      ...selectedSlots,
      [day]: updatedDaySlots,
    };

    // Remove empty days
    if (updatedDaySlots.length === 0) {
      delete updatedSlots[day];
    }

    onSlotsChange(updatedSlots);
  };

  const isSlotSelected = (day: string, timeValue: string) => {
    return (selectedSlots[day] || []).includes(timeValue);
  };

  const getTotalSelectedSlots = () => {
    return Object.values(selectedSlots).reduce((total, daySlots) => total + daySlots.length, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Weekly Availability</h3>
        <div className="text-sm text-gray-600">
          {getTotalSelectedSlots()} slots selected
        </div>
      </div>

      {/* Compact Table container with scroll */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white"
           style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        {/* Fixed header */}
        <div className="bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 w-16">
                  Time
                </th>
                {days.map(day => (
                  <th key={day.key} className="px-1 py-1 text-center text-xs font-medium text-gray-900 border-r border-gray-200 last:border-r-0 min-w-[60px]">
                    <div className="text-xs">{day.label.slice(0, 3)}</div>
                    <div className="text-xs text-blue-600 font-normal">
                      {(selectedSlots[day.key] || []).length || 0}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              {hours.map(hour => (
                <tr key={hour.value} className="hover:bg-gray-25">
                  {/* Time label */}
                  <td className="px-2 py-1 text-xs font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap w-16">
                    {hour.label}
                  </td>

                  {/* Day slots */}
                  {days.map(day => (
                    <td key={`${day.key}-${hour.value}`} className="px-1 py-0.5 text-center border-r border-gray-200 last:border-r-0">
                      <button
                        type="button"
                        onClick={() => toggleSlot(day.key, hour.value)}
                        className={`w-full h-5 rounded-sm text-xs font-medium transition-colors flex items-center justify-center ${
                          isSlotSelected(day.key, hour.value)
                            ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600 border border-blue-600'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-600'
                        }`}
                        title={`${day.label} ${hour.label}`}
                      >
                        <div className="w-3 h-3 flex items-center justify-center">
                          {isSlotSelected(day.key, hour.value) ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <span className="text-xs opacity-60 leading-none">•</span>
                          )}
                        </div>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick selection helpers */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={() => {
            const weekdaySlots = {
              monday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
              tuesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
              wednesday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
              thursday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
              friday: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
            };
            onSlotsChange(weekdaySlots);
          }}
          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
        >
          Business Hours (9AM-5PM)
        </button>
        
        <button
          type="button"
          onClick={() => {
            const eveningSlots = {
              monday: ['18:00', '19:00', '20:00', '21:00'],
              tuesday: ['18:00', '19:00', '20:00', '21:00'],
              wednesday: ['18:00', '19:00', '20:00', '21:00'],
              thursday: ['18:00', '19:00', '20:00', '21:00'],
              friday: ['18:00', '19:00', '20:00', '21:00'],
              saturday: ['18:00', '19:00', '20:00', '21:00'],
              sunday: ['18:00', '19:00', '20:00', '21:00'],
            };
            onSlotsChange(eveningSlots);
          }}
          className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
        >
          Evenings (6PM-9PM)
        </button>

        <button
          type="button"
          onClick={() => {
            const weekendSlots = {
              saturday: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
              sunday: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
            };
            onSlotsChange(weekendSlots);
          }}
          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
        >
          Weekends (10AM-4PM)
        </button>

        <button
          type="button"
          onClick={() => onSlotsChange({})}
          className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
        >
          Clear All
        </button>
      </div>

      {getTotalSelectedSlots() === 0 && (
        <div className="text-center py-4 text-sm text-gray-500">
          Click on the buttons in the table above to set your availability
        </div>
      )}
    </div>
  );
}