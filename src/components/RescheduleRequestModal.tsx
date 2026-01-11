import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/design-system';
import { Textarea } from '@/design-system/components/Input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, AlertCircle, Loader2, ArrowRight, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isBefore, addHours, isAfter, addMonths } from 'date-fns';
import { t } from '@/lib/i18n';
import { ApiClient, Booking } from '@/lib/api-migration';

interface RescheduleRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  userRole: 'host' | 'visitor';
  visitorRescheduleRemaining: number | null;
  onSuccess: () => void;
}

interface TimeSlot {
  time: string;
  displayTime: string;
}

export default function RescheduleRequestModal({
  isOpen,
  onClose,
  booking,
  userRole,
  visitorRescheduleRemaining,
  onSuccess
}: RescheduleRequestModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Get the minimum selectable date (tomorrow or later for visitor, today for host)
  const getMinDate = () => {
    const now = new Date();
    if (userRole === 'visitor') {
      // Visitors must select at least 1 hour before booking
      const bookingTime = parseISO(booking.scheduled_at);
      const oneHourBefore = addHours(bookingTime, -1);
      if (isBefore(now, oneHourBefore)) {
        return format(now, 'yyyy-MM-dd');
      }
    }
    return format(now, 'yyyy-MM-dd');
  };

  // Load available dates when modal opens
  useEffect(() => {
    if (isOpen && booking.service_id) {
      loadAvailableDates();
    }
  }, [isOpen, booking.service_id]);

  // Load available time slots when date changes
  useEffect(() => {
    if (selectedDate && booking.service_id) {
      loadAvailableSlots(selectedDate);
    } else {
      setAvailableSlots([]);
      setSelectedTime('');
    }
  }, [selectedDate, booking.service_id]);

  const loadAvailableDates = async () => {
    setLoadingDates(true);
    try {
      // Get current month and next month's availability
      const now = new Date();
      const currentMonth = format(now, 'yyyy-MM');
      const nextMonth = format(addMonths(now, 1), 'yyyy-MM');

      // Load both months in parallel
      const [currentResult, nextResult] = await Promise.all([
        ApiClient.getServiceCalendarAvailability(booking.service_id, currentMonth),
        ApiClient.getServiceCalendarAvailability(booking.service_id, nextMonth)
      ]);

      // Combine and filter dates from both months
      const allDates = [
        ...currentResult.availableDates,
        ...nextResult.availableDates
      ];

      const dates = allDates
        .filter(d => d.availableSlots > 0)
        .map(d => d.date);

      setAvailableDates(dates);
    } catch (error) {
      console.error('Error loading available dates:', error);
    } finally {
      setLoadingDates(false);
    }
  };

  const loadAvailableSlots = async (date: string) => {
    setLoadingSlots(true);
    setSelectedTime('');
    try {
      const result = await ApiClient.getServiceDayAvailability(
        booking.service_id,
        date
      );

      const slots: TimeSlot[] = result.availableSlots.map(time => ({
        time,
        displayTime: format(parseISO(`${date}T${time}`), 'h:mm a')
      }));

      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error loading available slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Please select a new date and time');
      return;
    }

    // Build the proposed scheduled_at timestamp
    const proposedScheduledAt = `${selectedDate}T${selectedTime}:00`;

    // Validate the proposed time
    const proposedDate = parseISO(proposedScheduledAt);
    const now = new Date();

    if (isBefore(proposedDate, now)) {
      toast.error('Please select a future time');
      return;
    }

    // For visitors, check 1-hour-before rule
    if (userRole === 'visitor') {
      const currentBookingTime = parseISO(booking.scheduled_at);
      const oneHourBefore = addHours(currentBookingTime, -1);
      if (isAfter(now, oneHourBefore)) {
        toast.error('Cannot reschedule less than 1 hour before the booking');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await ApiClient.createRescheduleRequest(booking.id, {
        proposed_scheduled_at: proposedScheduledAt,
        reason: reason.trim() || undefined
      });

      toast.success(t.reschedule.requestSent);
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error creating reschedule request:', error);
      toast.error(error.message || 'Failed to send reschedule request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedDate('');
    setSelectedTime('');
    setReason('');
    onClose();
  };

  const currentBookingTime = booking.scheduled_at
    ? format(parseISO(booking.scheduled_at), 'EEEE, MMMM d, yyyy \'at\' h:mm a')
    : '';

  // Get user's timezone for display
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();

  // Format proposed time for comparison view
  const proposedTimeDisplay = selectedDate && selectedTime
    ? format(parseISO(`${selectedDate}T${selectedTime}`), 'EEEE, MMMM d, yyyy \'at\' h:mm a')
    : '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t.reschedule.requestTitle}
          </DialogTitle>
          <DialogDescription>
            {userRole === 'host'
              ? t.reschedule.hostUnlimitedReschedules
              : t.reschedule.oneRescheduleWarning
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Time comparison view */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            {/* Current time */}
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide">{t.reschedule.currentTime}</Label>
              <p className="font-medium text-gray-900 mt-1">{currentBookingTime}</p>
            </div>

            {/* Arrow and new time (when selected) */}
            {proposedTimeDisplay && (
              <>
                <div className="flex items-center gap-2 text-gray-400">
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-xs">{t.reschedule.changeTo}</span>
                </div>
                <div>
                  <Label className="text-xs text-green-600 uppercase tracking-wide">{t.reschedule.newTime}</Label>
                  <p className="font-medium text-green-700 mt-1">{proposedTimeDisplay}</p>
                </div>
              </>
            )}

            {/* Service name and timezone */}
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {booking.services?.title || booking.service?.title}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Globe className="w-3 h-3" />
                <span>{timezoneAbbr}</span>
              </div>
            </div>
          </div>

          {/* Visitor reschedule limit warning */}
          {userRole === 'visitor' && visitorRescheduleRemaining !== null && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${
              visitorRescheduleRemaining > 0
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <AlertCircle className={`w-4 h-4 mt-0.5 ${
                visitorRescheduleRemaining > 0 ? 'text-blue-600' : 'text-amber-600'
              }`} />
              <p className={`text-sm ${
                visitorRescheduleRemaining > 0 ? 'text-blue-700' : 'text-amber-700'
              }`}>
                {visitorRescheduleRemaining > 0
                  ? t.reschedule.remainingReschedules.replace('{{count}}', String(visitorRescheduleRemaining))
                  : t.reschedule.noReschedulesLeft
                }
              </p>
            </div>
          )}

          {/* Date selection */}
          <div className="space-y-2">
            <Label htmlFor="reschedule-date" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t.reschedule.selectNewDate}
            </Label>
            {loadingDates ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <input
                type="date"
                id="reschedule-date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
              />
            )}
          </div>

          {/* Time slot selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t.reschedule.selectNewTime}
              </Label>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedTime(slot.time)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        selectedTime === slot.time
                          ? 'bg-black text-white border-black'
                          : 'bg-white hover:bg-gray-50 border-gray-300'
                      }`}
                    >
                      {slot.displayTime}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No available times on this date
                </p>
              )}
            </div>
          )}

          {/* Reason (optional) */}
          <div className="space-y-2">
            <Label htmlFor="reason">{t.reschedule.reason}</Label>
            <Textarea
              fullWidth
              rows={3}
              id="reason"
              placeholder={t.reschedule.reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Info about what happens next */}
          {selectedDate && selectedTime && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {t.reschedule.otherPartyWillBeNotified.replace(
                  '{{name}}',
                  userRole === 'host'
                    ? booking.customer?.display_name || 'The visitor'
                    : booking.provider?.display_name || 'The host'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedDate || !selectedTime || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t.common.sending}
              </>
            ) : (
              t.reschedule.sendRequest
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
