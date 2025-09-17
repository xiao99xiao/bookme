import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { getBrowserTimezone, getTimezoneOffset } from '@/lib/timezone';
import { H2, H3, Text, Description } from '@/design-system';

const timezoneSchema = z.object({
  timezone: z.string().min(1, 'Please select a timezone'),
});

type TimezoneFormData = z.infer<typeof timezoneSchema>;

// Base timezone data with city names
const TIMEZONE_BASE_DATA = [
  { value: 'UTC', city: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', city: 'New York' },
  { value: 'America/Chicago', city: 'Chicago' },
  { value: 'America/Denver', city: 'Denver' },
  { value: 'America/Los_Angeles', city: 'Los Angeles' },
  { value: 'America/Phoenix', city: 'Phoenix' },
  { value: 'America/Anchorage', city: 'Anchorage' },
  { value: 'Pacific/Honolulu', city: 'Honolulu' },
  { value: 'America/Toronto', city: 'Toronto' },
  { value: 'America/Vancouver', city: 'Vancouver' },
  { value: 'Europe/London', city: 'London' },
  { value: 'Europe/Paris', city: 'Paris' },
  { value: 'Europe/Berlin', city: 'Berlin' },
  { value: 'Europe/Rome', city: 'Rome' },
  { value: 'Europe/Madrid', city: 'Madrid' },
  { value: 'Europe/Moscow', city: 'Moscow' },
  { value: 'Asia/Tokyo', city: 'Tokyo' },
  { value: 'Asia/Shanghai', city: 'Shanghai' },
  { value: 'Asia/Hong_Kong', city: 'Hong Kong' },
  { value: 'Asia/Singapore', city: 'Singapore' },
  { value: 'Asia/Dubai', city: 'Dubai' },
  { value: 'Asia/Kolkata', city: 'Mumbai' },
  { value: 'Australia/Sydney', city: 'Sydney' },
  { value: 'Australia/Melbourne', city: 'Melbourne' },
  { value: 'Australia/Perth', city: 'Perth' },
  { value: 'Pacific/Auckland', city: 'Auckland' },
];

export default function MobileTimezoneSettings() {
  const { profile, refreshProfile, userId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [timezoneOptions, setTimezoneOptions] = useState<Array<{
    value: string;
    city: string;
    offset: string;
    label: string;
  }>>([]);

  const form = useForm<TimezoneFormData>({
    resolver: zodResolver(timezoneSchema),
    defaultValues: {
      timezone: '',
    },
  });

  // Generate timezone options with current offsets
  useEffect(() => {
    const options = TIMEZONE_BASE_DATA.map(tz => {
      const offset = getTimezoneOffset(tz.value);
      return {
        ...tz,
        offset,
        label: `${tz.city} (${offset})`
      };
    });

    // Sort by offset for better UX
    options.sort((a, b) => {
      const aNum = parseFloat(a.offset.replace(/[^\d.-]/g, ''));
      const bNum = parseFloat(b.offset.replace(/[^\d.-]/g, ''));
      return aNum - bNum;
    });

    setTimezoneOptions(options);
  }, []);

  // Initialize form with existing timezone or browser timezone
  useEffect(() => {
    if (profile?.timezone) {
      form.setValue('timezone', profile.timezone);
    } else {
      const browserTimezone = getBrowserTimezone();
      form.setValue('timezone', browserTimezone);
    }
  }, [profile, form]);

  const onSubmit = async (data: TimezoneFormData) => {
    if (!userId) {
      toast.error('User not found');
      return;
    }

    setLoading(true);
    try {
      await ApiClient.updateProfile({ timezone: data.timezone }, userId);
      await refreshProfile();
      toast.success('Timezone updated successfully!');

      // Go back to Me page after successful update
      navigate('/me');
    } catch (error: any) {
      console.error('Failed to update timezone:', error);
      toast.error(error.message || 'Failed to update timezone');
    } finally {
      setLoading(false);
    }
  };

  const handleUseBrowserTimezone = () => {
    const browserTimezone = getBrowserTimezone();
    form.setValue('timezone', browserTimezone);
    toast.success('Set to your browser timezone');
  };

  const selectedTimezone = form.watch('timezone');
  const selectedOption = timezoneOptions.find(opt => opt.value === selectedTimezone);

  return (
    <div className="lg:hidden min-h-screen bg-gray-50 pb-20">
      <div className="px-4 py-6">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/me')}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <H2>Timezone</H2>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          {/* Description */}
          <div className="bg-white rounded-2xl border border-[#eeeeee] p-4">
            <Text variant="small" className="text-[#666666]">
              Set your timezone so booking times are displayed correctly for both you and your customers.
            </Text>
          </div>

          {/* Current timezone info */}
          {selectedOption && (
            <div className="bg-white rounded-2xl border border-[#eeeeee] p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <H3 className="text-base">{selectedOption.city}</H3>
                  <Text variant="small" className="text-[#666666]">
                    {selectedOption.offset} • {new Date().toLocaleString('en-US', {
                      timeZone: selectedOption.value,
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* Timezone selection form */}
          <div className="bg-white rounded-2xl border border-[#eeeeee] p-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-sm font-medium">
                  Select Timezone
                </Label>
                <Select
                  value={form.watch('timezone')}
                  onValueChange={(value) => form.setValue('timezone', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose your timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timezoneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.formState.errors.timezone && (
                  <Text variant="small" className="text-red-500">
                    {form.formState.errors.timezone.message}
                  </Text>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseBrowserTimezone}
                  className="flex-1"
                >
                  Use Browser Timezone
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Timezone'
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Help info */}
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
            <Text variant="small" className="text-blue-800">
              <strong>Tip:</strong> Your timezone affects how booking times are displayed to customers and when you receive notifications.
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}