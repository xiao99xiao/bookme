'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { TimeSlotSelector } from './TimeSlotSelector';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';
import { ApiClient } from '@/lib/api-migration';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Updated schema for service with weekly schedule
const serviceSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  duration: z.number().min(15).max(480), // 15 minutes to 8 hours
  price: z.number().min(0).max(10000),
  location: z.enum(['online', 'phone', 'in-person']),
  meeting_platform: z.enum(['google_meet', 'zoom', 'teams']).optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface CreateServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ServiceFormData & { timeSlots: { [key: string]: boolean } }) => Promise<void>;
  isLoading?: boolean;
  editingService?: {
    id: string;
    title: string;
    description: string;
    price: number;
    duration_minutes: number;
    location?: string;
    is_online: boolean;
    meeting_platform?: string;
    timeSlots?: { [key: string]: boolean };
  } | null;
}

const locations = [
  { value: 'online', label: 'Online', icon: '💻' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'in-person', label: 'In-Person', icon: '📍' },
];

const meetingPlatforms = [
  { value: 'google_meet', label: 'Google Meet', icon: GoogleMeetIcon },
  { value: 'zoom', label: 'Zoom', icon: ZoomIcon, disabled: true },
  { value: 'teams', label: 'Microsoft Teams', icon: TeamsIcon, disabled: true },
];

export default function CreateServiceModal({ isOpen, onClose, onSubmit, isLoading = false, editingService }: CreateServiceModalProps) {
  const { userId } = useAuth();
  const [timeSlots, setTimeSlots] = useState<{ [key: string]: boolean }>({});
  const [userIntegrations, setUserIntegrations] = useState<any[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: '',
      description: '',
      duration: 60,
      price: 50,
      location: 'online',
      meeting_platform: 'google_meet',
    },
  });

  const watchLocation = form.watch('location');

  // Load user's meeting integrations
  useEffect(() => {
    if (isOpen && userId) {
      loadUserIntegrations();
    }
  }, [isOpen, userId]);

  // Populate form when editing an existing service
  useEffect(() => {
    if (editingService && isOpen) {
      form.reset({
        title: editingService.title,
        description: editingService.description,
        duration: editingService.duration_minutes,
        price: editingService.price,
        location: editingService.is_online ? 'online' : (editingService.location as 'online' | 'phone' | 'in-person' || 'online'),
        meeting_platform: editingService.meeting_platform as 'google_meet' | 'zoom' | 'teams' | undefined,
      });
      setTimeSlots(editingService.timeSlots || {});
    } else if (!editingService && isOpen) {
      // Reset form for new service
      form.reset({
        title: '',
        description: '',
        duration: 60,
        price: 50,
        location: 'online',
        meeting_platform: 'google_meet',
      });
      setTimeSlots({});
    }
  }, [editingService, isOpen, form]);

  const loadUserIntegrations = async () => {
    try {
      setLoadingIntegrations(true);
      const integrations = await ApiClient.getMeetingIntegrations(userId || undefined);
      setUserIntegrations(integrations);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const hasIntegration = (platform: string) => {
    return userIntegrations.some(i => i.platform === platform && i.is_active);
  };

  const handleSubmit = async (data: ServiceFormData) => {
    if (Object.keys(timeSlots).length === 0) {
      alert('Please select at least one time slot');
      return;
    }

    // Check if online service has meeting platform
    if (data.location === 'online' && data.meeting_platform) {
      if (!hasIntegration(data.meeting_platform)) {
        toast.error(`Please connect ${meetingPlatforms.find(p => p.value === data.meeting_platform)?.label} in Integrations first`);
        return;
      }
    }
    
    try {
      await onSubmit({ ...data, timeSlots });
      form.reset();
      setTimeSlots({});
      onClose();
    } catch (error) {
      console.error('Failed to create service:', error);
    }
  };

  const getTotalSlots = () => {
    return Object.keys(timeSlots).length;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] flex flex-col shadow-[0px_12px_16px_-4px_rgba(0,0,0,0.08),0px_4px_6px_-2px_rgba(0,0,0,0.03)]">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-10 py-8 pb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-black">{editingService ? 'Edit Service' : 'Create New Services'}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
        
        {/* Divider */}
        <div className="border-t border-[#eeeeee] mx-10"></div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
          {/* Content - Scrollable */}
          <div className="flex-1 px-10 py-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Side - Basic Info */}
              <div className="space-y-8">
              <h3 className="text-lg font-semibold font-body text-black">Details</h3>
              
              {/* Service Title */}
              <div className="space-y-2">
                <label className="text-sm text-[#666666] font-body">
                  Service Title
                </label>
                <div className="bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full">
                  <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                  <input
                    {...form.register('title')}
                    type="text"
                    placeholder="e.g., JavaScript Programming Fundamentals"
                    className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 bg-transparent placeholder:text-[#666666] focus:outline-none"
                  />
                </div>
                {form.formState.errors.title && (
                  <p className="mt-1 text-sm text-red-600 font-body">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm text-[#666666] font-body">
                  Description
                </label>
                <div className="bg-white box-border content-stretch flex items-start justify-start p-[12px] relative rounded-[8px] shrink-0 w-full min-h-[120px]">
                  <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                  <textarea
                    {...form.register('description')}
                    rows={5}
                    placeholder="Describe what you'll cover, who it's for, and what participants will learn."
                    className="basis-0 font-body font-normal grow leading-[1.5] min-h-full min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 bg-transparent placeholder:text-[#666666] resize-none focus:outline-none"
                  />
                </div>
                {form.formState.errors.description && (
                  <p className="mt-1 text-sm text-red-600 font-body">{form.formState.errors.description.message}</p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <label className="text-sm text-[#666666] font-body">
                  Location Type
                </label>
                <div className="relative">
                  <select
                    {...form.register('location')}
                    className="w-full h-12 px-3 py-2 pr-10 text-base font-body border border-[#eeeeee] rounded-[8px] focus:outline-none focus:border-[#3b9ef9] appearance-none bg-white"
                    >
                      {locations.map((location) => (
                        <option key={location.value} value={location.value}>
                          {location.icon} {location.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {form.formState.errors.location && (
                    <p className="mt-1 text-sm text-red-600 font-body">{form.formState.errors.location.message}</p>
                  )}
              </div>

              {/* Meeting Platform - Only show for online services */}
              {watchLocation === 'online' && (
                <div className="space-y-2">
                  <label className="text-sm text-[#666666] font-body">
                    Meeting Platform
                  </label>
                  <div className="space-y-2">
                    {meetingPlatforms.map((platform) => {
                      const IconComponent = platform.icon;
                      const isConnected = hasIntegration(platform.value);
                      const isSelected = form.watch('meeting_platform') === platform.value;
                      
                      return (
                        <label
                          key={platform.value}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                            platform.disabled ? 'opacity-50 cursor-not-allowed' : 
                            isSelected ? 'border-[#3b9ef9] bg-[#eff7ff]' : 'border-[#eeeeee] hover:border-[#cccccc]'
                          }`}
                        >
                          <input
                            type="radio"
                            {...form.register('meeting_platform')}
                            value={platform.value}
                            disabled={platform.disabled}
                            className="sr-only"
                          />
                          <IconComponent className="w-5 h-5 mr-3" />
                          <span className="flex-1 font-medium">{platform.label}</span>
                          {platform.disabled ? (
                            <span className="text-xs text-gray-500">Coming soon</span>
                          ) : isConnected ? (
                            <span className="text-xs text-green-600">Connected</span>
                          ) : (
                            <span className="text-xs text-amber-600">Not connected</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {watchLocation === 'online' && form.watch('meeting_platform') && !hasIntegration(form.watch('meeting_platform')!) && (
                    <div className="mt-2 p-3 bg-[#fcf9f4] border border-[#FFD43C] rounded-lg flex items-start">
                      <AlertCircle className="w-4 h-4 text-[#FFD43C] mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm text-[#666666] font-body">
                        <p className="font-medium">Integration Required</p>
                        <p className="mt-1">You need to connect {meetingPlatforms.find(p => p.value === form.watch('meeting_platform'))?.label} in your Integrations before creating this service.</p>
                        <a href="/provider/integrations" className="inline-block mt-2 text-[#3b9ef9] hover:text-[#2e7bc4] underline">
                          Go to Integrations →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Duration & Price */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-[#666666] font-body">
                    Session Duration
                  </label>
                  <div className="relative">
                    <select
                      {...form.register('duration', { valueAsNumber: true })}
                      className="w-full h-12 px-3 py-2 pr-10 text-base font-body border border-[#eeeeee] rounded-[8px] focus:outline-none focus:border-[#3b9ef9] appearance-none bg-white"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                      <option value={180}>3 hours</option>
                      <option value={240}>4 hours</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {form.formState.errors.duration && (
                    <p className="mt-1 text-sm text-red-600 font-body">{form.formState.errors.duration.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-[#666666] font-body">
                    Price per Session
                  </label>
                  <div className="bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full">
                    <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                    <input
                      {...form.register('price', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      max="10000"
                      placeholder="50"
                      className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 pr-12 bg-transparent placeholder:text-[#666666] focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-black font-body">USD</span>
                  </div>
                  {form.formState.errors.price && (
                    <p className="mt-1 text-sm text-red-600 font-body">{form.formState.errors.price.message}</p>
                  )}
                </div>
              </div>

            </div>

            {/* Right Side - Availability Schedule */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold font-body text-black mb-1">Available Time Slots</h3>
                <p className="text-xs text-[#aaaaaa] font-body">Click and drag to select multiple time slots.</p>
              </div>
              <div className="h-[440px] overflow-y-auto">
                <TimeSlotSelector
                  value={timeSlots}
                  onChange={setTimeSlots}
                />
              </div>
            </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#eeeeee] mx-10"></div>
          
          {/* Footer - Fixed */}
          <div className="flex-shrink-0 flex justify-end gap-6 px-10 py-8">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-base font-semibold font-body text-black border border-[#cccccc] rounded-full hover:bg-gray-50 transition-colors min-w-[227px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !form.formState.isValid || getTotalSlots() === 0}
              className="px-6 py-3 text-base font-semibold font-body text-white bg-black border border-black rounded-full hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (editingService ? 'Updating...' : 'Creating...') : 
               editingService ? `Update Service (${getTotalSlots()} slots)` : `Create Service (${getTotalSlots()} slots)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}