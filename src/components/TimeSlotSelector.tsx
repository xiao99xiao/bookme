import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={selectWorkHours}
          className="text-xs"
        >
          9-5 Weekdays
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearAll}
          className="text-xs"
        >
          Clear All
        </Button>
      </div>
      
      <div 
        className="select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header with days */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-xs font-medium text-linear-text-secondary text-center py-2">
            Time
          </div>
          {DAYS.map(day => (
            <div key={day.key} className="text-xs font-medium text-linear-text-secondary text-center py-2">
              {day.label}
            </div>
          ))}
        </div>

        {/* Time slots grid */}
        <div className="max-h-[400px] overflow-y-auto">
          {HOURS.map(hour => (
            <div key={hour.value} className="grid grid-cols-8 gap-1 mb-1">
              <div className="text-xs text-linear-text-secondary text-center py-1 flex items-center justify-center">
                {hour.label}
              </div>
              {DAYS.map(day => (
                <button
                  key={`${day.key}-${hour.value}`}
                  type="button"
                  className={cn(
                    "h-6 w-full rounded text-xs transition-colors",
                    isSlotSelected(day.key, hour.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted-foreground/20 linear-border"
                  )}
                  onMouseDown={() => handleMouseDown(day.key, hour.value)}
                  onMouseEnter={() => handleMouseEnter(day.key, hour.value)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-xs text-linear-text-secondary">
        Click and drag to select multiple time slots. Selected: {Object.keys(value).length} slots
      </div>
    </div>
  );
};