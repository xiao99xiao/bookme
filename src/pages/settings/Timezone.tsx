import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, Users, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { getBrowserTimezone, getTimezoneOffset } from '@/lib/timezone';
import { H2 } from '@/design-system';

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

// Generate timezone list with dynamic GMT offsets
const generateTimezoneList = () => {
  return TIMEZONE_BASE_DATA.map(tz => {
    const offset = getTimezoneOffset(tz.value);
    return {
      value: tz.value,
      label: `${offset} - ${tz.city}`
    };
  });
};

export default function Timezone() {
  const { profile, refreshProfile, userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [timezoneList, setTimezoneList] = useState(generateTimezoneList());
  const [selectedTimezone, setSelectedTimezone] = useState('');

  const form = useForm<TimezoneFormData>({
    resolver: zodResolver(timezoneSchema),
    defaultValues: {
      timezone: '',
    },
  });

  // Effect to populate form with profile data whenever profile changes or component mounts
  useEffect(() => {
    if (profile && userId) {
      // Ensure the timezone value exists in our list, fallback to browser timezone if not
      const profileTimezone = profile.timezone || getBrowserTimezone();
      const timezoneExists = TIMEZONE_BASE_DATA.some(tz => tz.value === profileTimezone);
      const finalTimezone = timezoneExists ? profileTimezone : getBrowserTimezone();
      
      
      setSelectedTimezone(finalTimezone);
      form.reset({
        timezone: finalTimezone,
      });
      
      // If user doesn't have a timezone set, automatically update their profile with browser timezone
      if (!profile.timezone) {
        const browserTimezone = getBrowserTimezone();
        // Silently update the user's timezone in the background
        ApiClient.updateProfile({ timezone: browserTimezone }, userId)
          .then(() => {
            refreshProfile(); // Refresh to get updated profile
          })
          .catch(error => {
            console.error('Failed to auto-set timezone:', error);
          });
      }
    }
  }, [profile, userId, refreshProfile]);

  const onSubmit = async (data: TimezoneFormData) => {
    try {
      setLoading(true);
      
      // Update timezone
      await ApiClient.updateProfile({
        timezone: data.timezone,
      }, userId);
      
      await refreshProfile();
      toast.success('Timezone updated successfully');
    } catch (error) {
      console.error('Timezone update error:', error);
      toast.error('Failed to update timezone');
    } finally {
      setLoading(false);
    }
  };

  // Get current time in selected timezone for preview
  const getCurrentTimeInTimezone = () => {
    if (selectedTimezone) {
      try {
        const now = new Date();
        return now.toLocaleString('en-US', {
          timeZone: selectedTimezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (error) {
        return 'Invalid timezone';
      }
    }
    return '';
  };

  const settingsTabLabels = {
    profile: 'Profile', 
    customize: 'Customize',
    timezone: 'Timezone'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Desktop Layout */}
        <div className="hidden lg:flex gap-8">
          {/* Left Sidebar - Desktop Only */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start overflow-clip px-8 py-10 relative shrink-0 w-64 rounded-2xl">
              <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                <H2 className="leading-[1.4]">Settings</H2>
                <div className="font-body text-xs text-tertiary w-full">
                  <p className="leading-[1.5] text-tertiary">Manage your timezone preferences</p>
                </div>
              </div>
              <div className="basis-0 content-stretch flex flex-col grow items-start justify-start min-h-px min-w-px relative shrink-0 w-full">
                <Link to="/settings/profile" className="box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full hover:bg-[#f3f3f3] transition-colors">
                  <div className="overflow-clip relative shrink-0 size-5">
                    <Users className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#666666] text-[16px] hover:text-black transition-colors">
                    <p className="leading-[1.5]">Profile</p>
                  </div>
                </Link>
                <Link to="/settings/customize" className="box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full hover:bg-[#f3f3f3] transition-colors">
                  <div className="overflow-clip relative shrink-0 size-5">
                    <Settings className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#666666] text-[16px] hover:text-black transition-colors">
                    <p className="leading-[1.5]">Customize</p>
                  </div>
                </Link>
                <div className="bg-[#f3f3f3] box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full">
                  <div className="overflow-clip relative shrink-0 size-5">
                    <Clock className="w-5 h-5 text-black" />
                  </div>
                  <div className="basis-0 font-body font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black">
                    <p className="leading-[1.5]">Timezone</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area - Desktop */}
          <div className="flex-1">
            <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start min-h-px min-w-px px-10 py-0 relative shrink-0 rounded-2xl">
              <div className="box-border content-stretch flex flex-col gap-10 items-start justify-start p-[40px] relative rounded-[16px] shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-8 items-start justify-start relative shrink-0 w-full">
                  {/* Timezone Section */}
                  <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                    <H2 className="leading-[1.4]">Timezone Settings</H2>
                    <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                      <p className="leading-[1.5]">Set your timezone for accurate booking and scheduling</p>
                    </div>
                  </div>
                  
                  <form onSubmit={form.handleSubmit(onSubmit)} className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                    {/* Timezone Selector */}
                    <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                      <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                        <Label>Your Timezone</Label>
                      </div>
                      <div className="bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full">
                        <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                        <Select
                          value={selectedTimezone}
                          onValueChange={(value) => {
                            setSelectedTimezone(value);
                            form.setValue('timezone', value);
                          }}
                        >
                          <SelectTrigger className="border-0 focus:ring-0 p-0 bg-transparent">
                            <SelectValue placeholder="Select your timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {timezoneList.map((timezone) => (
                              <SelectItem key={timezone.value} value={timezone.value}>
                                {timezone.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {form.formState.errors.timezone && (
                        <p className="text-[#b42318] text-sm">{form.formState.errors.timezone.message}</p>
                      )}
                    </div>
                    
                    {/* Current Time Preview */}
                    {getCurrentTimeInTimezone() && (
                      <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                        <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                          <Label>Current Time in Selected Timezone</Label>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full">
                          <div className="text-sm text-blue-800 font-medium">
                            {getCurrentTimeInTimezone()}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            This is how times will appear in your bookings and notifications
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Save Button */}
                    <div className="content-stretch flex gap-8 items-center justify-start relative shrink-0 w-full pt-6">
                      <div className="basis-0 grow min-h-px min-w-px"></div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-black box-border content-stretch flex gap-2 items-center justify-center px-6 py-3 relative rounded-[40px] shrink-0 w-40 hover:bg-gray-900"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span className="font-body font-semibold text-[16px] text-white">Save Changes</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Preview/Info - Desktop Only */}
          <div className="w-[400px] flex-shrink-0">
            <div className="content-stretch flex flex-col gap-6 h-full items-start justify-start relative shrink-0 border-l border-[#eeeeee] rounded-2xl">
              <div className="basis-0 box-border content-stretch flex flex-col gap-10 grow items-center justify-start min-h-px min-w-px p-[40px] relative shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-8 items-center justify-start relative shrink-0 w-full">
                  <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                    <H2 className="leading-[1.4]">Why Set Your Timezone?</H2>
                    <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                      <p className="leading-[1.5]">Ensure accurate scheduling across time zones</p>
                    </div>
                  </div>
                  
                  <div className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Accurate Scheduling</span>
                      </div>
                      <div className="text-xs text-blue-700">
                        Your timezone ensures that all booking times are displayed correctly for both you and your clients
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-3">
                      <p className="font-medium">Benefits of setting your timezone:</p>
                      <ul className="list-disc list-inside space-y-2 ml-2">
                        <li>Booking times display in your local time</li>
                        <li>Notifications sent at appropriate hours</li>
                        <li>Calendar integrations work correctly</li>
                        <li>Service availability shows accurate times</li>
                        <li>Meeting reminders sent at the right time</li>
                      </ul>
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span className="text-sm font-medium text-amber-900">Auto-Detection</span>
                      </div>
                      <div className="text-xs text-amber-700">
                        We automatically detect your timezone from your browser, but you can change it anytime
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden pb-20">
          {/* Top Header with Title and Tabs */}
          <div className="mb-6">
            {/* Title Section */}
            <div className="mb-4">
              <H2 className="mb-1">Settings</H2>
              <p className="text-sm text-gray-500 font-body">Manage your timezone preferences</p>
            </div>
            
            {/* Horizontal Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
              <Link
                to="/settings/profile"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Profile
              </Link>
              <Link
                to="/settings/customize"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Customize
              </Link>
              <div className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body bg-white text-black shadow-sm">
                Timezone
              </div>
            </div>
          </div>

          {/* Mobile Content Area */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#eeeeee] p-4 sm:p-6">
              {/* Timezone Section */}
              <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full mb-6">
                <H2 className="leading-[1.4]">Timezone Settings</H2>
                <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                  <p className="leading-[1.5]">Set your timezone for accurate booking and scheduling</p>
                </div>
              </div>
              
              <form onSubmit={form.handleSubmit(onSubmit)} className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                {/* Timezone Selector */}
                <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                  <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                    <Label>Your Timezone</Label>
                  </div>
                  <div className="bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full border border-[#eeeeee]">
                    <Select
                      value={selectedTimezone}
                      onValueChange={(value) => {
                        setSelectedTimezone(value);
                        form.setValue('timezone', value);
                      }}
                    >
                      <SelectTrigger className="border-0 focus:ring-0 p-0 bg-transparent">
                        <SelectValue placeholder="Select your timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {timezoneList.map((timezone) => (
                          <SelectItem key={timezone.value} value={timezone.value}>
                            {timezone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.formState.errors.timezone && (
                    <p className="text-[#b42318] text-sm">{form.formState.errors.timezone.message}</p>
                  )}
                </div>
                
                {/* Current Time Preview */}
                {getCurrentTimeInTimezone() && (
                  <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                    <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                      <Label>Current Time in Selected Timezone</Label>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full">
                      <div className="text-sm text-blue-800 font-medium">
                        {getCurrentTimeInTimezone()}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        This is how times will appear in your bookings and notifications
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Save Button */}
                <div className="content-stretch flex gap-8 items-center justify-end relative shrink-0 w-full pt-6">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-black box-border content-stretch flex gap-2 items-center justify-center px-6 py-3 relative rounded-[40px] shrink-0 w-40 hover:bg-gray-900"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span className="font-body font-semibold text-[16px] text-white">Save Changes</span>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}