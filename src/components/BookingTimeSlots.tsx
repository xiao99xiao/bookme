import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock } from "lucide-react";
import { format, addDays, isSameDay, isAfter, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface TimeSlot {
  time: string; // "09:00", "10:30", etc.
  available: boolean;
}

interface BookingTimeSlotsProps {
  onSlotSelect: (datetime: Date) => void;
  selectedSlot: Date | null;
  service: {
    duration_minutes: number;
    is_online: boolean;
    location?: string;
  };
}

const BookingTimeSlots = ({ onSlotSelect, selectedSlot, service }: BookingTimeSlotsProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  // Generate time slots (simplified - in real app, this would come from provider's availability)
  const generateTimeSlots = (date: Date): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = isSameDay(date, now);
    
    // Generate slots from 9 AM to 6 PM
    for (let hour = 9; hour < 18; hour++) {
      for (let minute of [0, 30]) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotDateTime = new Date(date);
        slotDateTime.setHours(hour, minute, 0, 0);
        
        // Don't show past slots for today
        const available = !isToday || isAfter(slotDateTime, now);
        
        slots.push({
          time: timeString,
          available
        });
      }
    }
    
    return slots;
  };

  const loadAvailableSlots = async (date: Date) => {
    setLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // In a real app, you'd fetch actual availability from the provider
      const slots = generateTimeSlots(date);
      setAvailableSlots(slots);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeSelect = (time: string) => {
    if (!selectedDate) return;
    
    const [hours, minutes] = time.split(':').map(Number);
    const datetime = new Date(selectedDate);
    datetime.setHours(hours, minutes, 0, 0);
    
    onSlotSelect(datetime);
  };

  const isSlotSelected = (time: string) => {
    if (!selectedSlot || !selectedDate) return false;
    return isSameDay(selectedSlot, selectedDate) && 
           format(selectedSlot, 'HH:mm') === time;
  };

  // Disable dates in the past
  const disabledDays = {
    before: startOfDay(new Date())
  };

  // Only show next 30 days
  const maxDate = addDays(new Date(), 30);

  return (
    <div className="space-y-6">
      {/* Service Info */}
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{service.duration_minutes} minutes</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {service.is_online ? "Online" : service.location ? "In Person" : "Phone"}
        </Badge>
      </div>

      {/* Calendar */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          Select Date
        </h3>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={disabledDays}
          fromDate={new Date()}
          toDate={maxDate}
          className="rounded-md border"
        />
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            Available Times - {format(selectedDate, 'EEEE, MMMM d')}
          </h3>
          
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableSlots.map(({ time, available }) => (
                <Button
                  key={time}
                  variant="outline"
                  size="sm"
                  disabled={!available}
                  className={cn(
                    "h-10 text-sm",
                    isSlotSelected(time) && "bg-primary text-primary-foreground border-primary",
                    !available && "opacity-30 cursor-not-allowed"
                  )}
                  onClick={() => handleTimeSelect(time)}
                >
                  {time}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Summary */}
      {selectedSlot && (
        <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
          <h4 className="text-sm font-medium text-primary mb-1">Selected Time</h4>
          <p className="text-sm text-muted-foreground">
            {format(selectedSlot, 'EEEE, MMMM d, yyyy')} at {format(selectedSlot, 'h:mm a')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Duration: {service.duration_minutes} minutes
          </p>
        </div>
      )}
    </div>
  );
};

export default BookingTimeSlots;