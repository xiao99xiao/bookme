import { useState } from "react";
import { cn } from "@/lib/utils";

interface TimeSlotSelectorProps {
  value: { [key: string]: boolean };
  onChange: (timeSlots: { [key: string]: boolean }) => void;
}

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' }
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return {
    value: hour,
    label: `${displayHour}${period}`,
    shortLabel: `${displayHour}`
  };
});

export const TimeSlotSelector = ({ value, onChange }: TimeSlotSelectorProps) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startSlot, setStartSlot] = useState<string | null>(null);

  const getSlotKey = (day: string, hour: number) => `${day}-${hour.toString().padStart(2, '0')}`;

  const isSlotSelected = (day: string, hour: number) => {
    const key = getSlotKey(day, hour);
    return value[key] || false;
  };

  const handleSlotClick = (day: string, hour: number) => {
    const key = getSlotKey(day, hour);
    const newValue = { ...value };
    
    if (newValue[key]) {
      delete newValue[key];
    } else {
      newValue[key] = true;
    }
    
    onChange(newValue);
  };

  const handleMouseDown = (day: string, hour: number) => {
    setIsSelecting(true);
    setStartSlot(getSlotKey(day, hour));
    handleSlotClick(day, hour);
  };

  const handleMouseEnter = (day: string, hour: number) => {
    if (isSelecting && startSlot) {
      const currentKey = getSlotKey(day, hour);
      const newValue = { ...value };
      
      // Simple selection - just toggle the current slot
      if (!newValue[currentKey]) {
        newValue[currentKey] = true;
        onChange(newValue);
      }
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartSlot(null);
  };

  const clearAll = () => {
    onChange({});
  };

  const selectWorkHours = () => {
    const newValue: { [key: string]: boolean } = {};
    DAYS.slice(0, 5).forEach(day => { // Monday to Friday
      for (let hour = 9; hour <= 17; hour++) { // 9 AM to 5 PM
        newValue[getSlotKey(day.key, hour)] = true;
      }
    });
    onChange(newValue);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={selectWorkHours}
            className="px-3 py-2 text-sm text-[#666666] font-body bg-gray-50 border border-[#cccccc] rounded-xl hover:bg-gray-100"
          >
            09:00-17:00 Weekdays
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-2 text-sm text-[#666666] font-body bg-gray-50 border border-[#cccccc] rounded-xl hover:bg-gray-100"
          >
            Clear All
          </button>
        </div>
        <span className="text-sm text-[#666666] font-body">
          Selected: {Object.keys(value).length} slots
        </span>
      </div>
      
      <div 
        className="select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header with days */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-xs font-medium text-gray-500 text-center py-2">
            Time
          </div>
          {DAYS.map(day => (
            <div key={day.key} className="text-xs font-medium text-gray-500 text-center py-2">
              {day.label}
            </div>
          ))}
        </div>

        {/* Time slots grid */}
        <div className="max-h-[400px] overflow-y-auto">
          {HOURS.map(hour => (
            <div key={hour.value} className="grid grid-cols-8 gap-1 mb-1">
              <div className="text-xs text-[#666666] font-body text-center py-1 flex items-center justify-center">
                {hour.label}
              </div>
              {DAYS.map(day => (
                <button
                  key={`${day.key}-${hour.value}`}
                  type="button"
                  className={cn(
                    "h-7 w-full rounded-[12px] text-xs transition-colors border",
                    isSlotSelected(day.key, hour.value)
                      ? "bg-[#eff7ff] border-[#3b9ef9]"
                      : "bg-neutral-50 border-[#eeeeee] hover:bg-[#f2f2f2] hover:border-[#cccccc]"
                  )}
                  onMouseDown={() => handleMouseDown(day.key, hour.value)}
                  onMouseEnter={() => handleMouseEnter(day.key, hour.value)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-xs text-gray-500">
        Click and drag to select multiple time slots. Selected: {Object.keys(value).length} slots
      </div>
    </div>
  );
};

export default TimeSlotSelector;