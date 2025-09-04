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
import { 
  Card, 
  Stack, 
  Grid, 
  Text, 
  Heading,
  Button, 
  Input, 
  Textarea,
  Label,
  Description 
} from '@/design-system';

const serviceSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  duration: z.number().min(15).max(480),
  price: z.number().min(0).max(10000),
  location: z.enum(['online', 'phone', 'in-person']),
  meeting_platform: z.enum(['google_meet', 'zoom', 'teams']).optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface EditingService {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes: number;
  location?: string;
  is_online: boolean;
  meeting_platform?: string;
  timeSlots?: { [key: string]: boolean };
}

interface RefactoredServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ServiceFormData & { timeSlots: { [key: string]: boolean } }) => Promise<void>;
  isLoading?: boolean;
  editingService?: EditingService | null;
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

export function RefactoredServiceModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading = false, 
  editingService 
}: RefactoredServiceModalProps) {
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

  useEffect(() => {
    if (isOpen && userId) {
      loadUserIntegrations();
    }
  }, [isOpen, userId]);

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
      toast.error('Please select at least one time slot');
      return;
    }

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
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50">
      <Card 
        className="max-w-6xl w-full max-h-[90vh] flex flex-col"
        radius="xl"
      >
        {/* Header */}
        <Stack direction="row" justify="between" align="center" className="px-10 py-8">
          <Heading as="h2">
            {editingService ? 'Edit Service' : 'Create New Service'}
          </Heading>
          <Button variant="tertiary" size="small" iconPosition="only" icon={<X className="w-6 h-6" />} onClick={onClose} />
        </Stack>
        
        <hr className="border-neutralLightest mx-10" />

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
          {/* Content */}
          <div className="flex-1 px-10 py-6 overflow-y-auto">
            <Grid columns={2} spacing="3xl">
              {/* Left Side - Service Details */}
              <Stack spacing="xl">
                <Heading as="h3" className="text-lg">Details</Heading>
                
                {/* Service Title */}
                <Stack spacing="sm">
                  <Label>Service Title</Label>
                  <Input
                    {...form.register('title')}
                    placeholder="e.g., JavaScript Programming Fundamentals"
                    error={!!form.formState.errors.title}
                    fullWidth
                  />
                  {form.formState.errors.title && (
                    <Text variant="tiny" className="text-red-600">
                      {form.formState.errors.title.message}
                    </Text>
                  )}
                </Stack>

                {/* Description */}
                <Stack spacing="sm">
                  <Label>Description</Label>
                  <Textarea
                    {...form.register('description')}
                    rows={5}
                    placeholder="Describe what you'll cover, who it's for, and what participants will learn."
                    error={!!form.formState.errors.description}
                    fullWidth
                  />
                  {form.formState.errors.description && (
                    <Text variant="tiny" className="text-red-600">
                      {form.formState.errors.description.message}
                    </Text>
                  )}
                </Stack>

                {/* Location Type */}
                <Stack spacing="sm">
                  <Label>Location Type</Label>
                  <select
                    {...form.register('location')}
                    className="w-full h-12 px-3 py-2 pr-10 text-base border border-neutralLightest rounded-ds-sm focus:outline-none focus:border-blue-500 appearance-none bg-white"
                  >
                    {locations.map((location) => (
                      <option key={location.value} value={location.value}>
                        {location.icon} {location.label}
                      </option>
                    ))}
                  </select>
                </Stack>

                {/* Meeting Platform */}
                {watchLocation === 'online' && (
                  <Stack spacing="sm">
                    <Label>Meeting Platform</Label>
                    <Stack spacing="sm">
                      {meetingPlatforms.map((platform) => {
                        const IconComponent = platform.icon;
                        const isConnected = hasIntegration(platform.value);
                        const isSelected = form.watch('meeting_platform') === platform.value;
                        
                        return (
                          <label
                            key={platform.value}
                            className={`flex items-center p-3 border rounded-ds-md cursor-pointer transition-colors ${
                              platform.disabled ? 'opacity-50 cursor-not-allowed' : 
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-neutralLightest hover:border-neutral'
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
                            <Text className="flex-1" weight="medium">{platform.label}</Text>
                            {platform.disabled ? (
                              <Text variant="tiny" color="secondary">Coming soon</Text>
                            ) : isConnected ? (
                              <Text variant="tiny" className="text-green-600">Connected</Text>
                            ) : (
                              <Text variant="tiny" className="text-amber-600">Not connected</Text>
                            )}
                          </label>
                        );
                      })}
                    </Stack>
                    
                    {watchLocation === 'online' && form.watch('meeting_platform') && !hasIntegration(form.watch('meeting_platform')!) && (
                      <Card className="bg-brandLightYellow border-brandYellow">
                        <Stack direction="row" align="start" spacing="sm">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <Stack spacing="xs">
                            <Text variant="small" weight="medium">Integration Required</Text>
                            <Text variant="tiny">
                              You need to connect {meetingPlatforms.find(p => p.value === form.watch('meeting_platform'))?.label} in your Integrations before creating this service.
                            </Text>
                            <a href="/provider/integrations" className="inline-block mt-1 text-blue-600 hover:text-blue-800 underline text-sm">
                              Go to Integrations →
                            </a>
                          </Stack>
                        </Stack>
                      </Card>
                    )}
                  </Stack>
                )}

                {/* Duration & Price */}
                <Grid columns={2} spacing="lg">
                  <Stack spacing="sm">
                    <Label>Session Duration</Label>
                    <select
                      {...form.register('duration', { valueAsNumber: true })}
                      className="w-full h-12 px-3 py-2 pr-10 text-base border border-neutralLightest rounded-ds-sm focus:outline-none focus:border-blue-500 appearance-none bg-white"
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
                  </Stack>

                  <Stack spacing="sm">
                    <Label>Price per Session</Label>
                    <div className="relative">
                      <Input
                        {...form.register('price', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        max="10000"
                        placeholder="50"
                        className="pr-12"
                        error={!!form.formState.errors.price}
                        fullWidth
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-textPrimary">USD</span>
                    </div>
                  </Stack>
                </Grid>
              </Stack>

              {/* Right Side - Time Slots */}
              <Stack spacing="lg">
                <Stack spacing="xs">
                  <Heading as="h3" className="text-lg">Available Time Slots</Heading>
                  <Description>Click and drag to select multiple time slots.</Description>
                </Stack>
                <div className="h-[440px] overflow-y-auto">
                  <TimeSlotSelector
                    value={timeSlots}
                    onChange={setTimeSlots}
                  />
                </div>
              </Stack>
            </Grid>
          </div>

          <hr className="border-neutralLightest mx-10" />
          
          {/* Footer */}
          <Stack direction="row" justify="end" spacing="lg" className="px-10 py-8">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="min-w-[227px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !form.formState.isValid || getTotalSlots() === 0}
              className="min-w-[227px]"
            >
              {isLoading ? (editingService ? 'Updating...' : 'Creating...') : 
               editingService ? `Update Service (${getTotalSlots()} slots)` : `Create Service (${getTotalSlots()} slots)`}
            </Button>
          </Stack>
        </form>
      </Card>
    </div>
  );
}