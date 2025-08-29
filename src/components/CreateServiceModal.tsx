'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Clock, DollarSign, MapPin, Tag, FileText, Video, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { getLocationIcon } from '@/lib/utils';
import { TimeSlotSelector } from './TimeSlotSelector';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';
import { ApiClient } from '@/lib/api';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { toast } from 'sonner';

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

export default function CreateServiceModal({ isOpen, onClose, onSubmit, isLoading = false }: CreateServiceModalProps) {
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
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Create New Service</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
          {/* Content - Scrollable */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[500px]">
              {/* Left Side - Basic Info */}
              <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Details</h3>
              
              {/* Service Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="inline w-4 h-4 mr-1" />
                  Service Title
                </label>
                <input
                  {...form.register('title')}
                  type="text"
                  placeholder="e.g., JavaScript Programming Fundamentals"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {form.formState.errors.title && (
                  <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="inline w-4 h-4 mr-1" />
                  Description
                </label>
                <textarea
                  {...form.register('description')}
                  rows={4}
                  placeholder="Describe what you'll cover, who it's for, and what participants will learn..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                {form.formState.errors.description && (
                  <p className="mt-1 text-sm text-red-600">{form.formState.errors.description.message}</p>
                )}
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    Location Type
                  </label>
                  <select
                    {...form.register('location')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    {locations.map((location) => (
                      <option key={location.value} value={location.value}>
                        {location.icon} {location.label}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.location && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.location.message}</p>
                  )}
                </div>
              </div>

              {/* Meeting Platform - Only show for online services */}
              {watchLocation === 'online' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Video className="inline w-4 h-4 mr-1" />
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
                          className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                            platform.disabled ? 'opacity-50 cursor-not-allowed' : 
                            isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
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
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">Integration Required</p>
                        <p className="mt-1">You need to connect {meetingPlatforms.find(p => p.value === form.watch('meeting_platform'))?.label} in your Integrations before creating this service.</p>
                        <a href="/dashboard/integrations" className="inline-block mt-2 text-amber-700 hover:text-amber-900 underline">
                          Go to Integrations →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Duration & Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="inline w-4 h-4 mr-1" />
                    Session Duration
                  </label>
                  <select
                    {...form.register('duration', { valueAsNumber: true })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
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
                  {form.formState.errors.duration && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.duration.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="inline w-4 h-4 mr-1" />
                    Price per Session
                  </label>
                  <input
                    {...form.register('price', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    max="10000"
                    placeholder="50.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.price && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.price.message}</p>
                  )}
                </div>
              </div>

              {/* Preview */}
              {form.watch('title') && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center mb-2">
                      <h4 className="font-semibold text-gray-900">{form.watch('title')}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{form.watch('description')}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{form.watch('duration')} min • {getLocationIcon(form.watch('location'))} {form.watch('location')}</span>
                      <span className="font-semibold text-green-600">${form.watch('price')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Availability Schedule */}
            <div className="h-[600px]">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Time Slots</h3>
              <TimeSlotSelector
                value={timeSlots}
                onChange={setTimeSlots}
              />
            </div>
            </div>
          </div>

          {/* Footer - Fixed */}
          <div className="flex-shrink-0 flex gap-4 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-6 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !form.formState.isValid || getTotalSlots() === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-medium transition-colors"
            >
              {isLoading ? 'Creating...' : `Create Service (${getTotalSlots()} slots)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}