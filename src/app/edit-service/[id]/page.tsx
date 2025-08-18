'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, DollarSign, MapPin, Tag, FileText } from 'lucide-react';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { getSlotCategoryEmoji, getLocationIcon } from '@/lib/utils';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';
import { supabase } from '@/lib/supabase';
import { Page, FormField, Input, TextArea, Select, Button, Card, CardHeader, CardContent } from '@/components/ui';

// Schema for service editing
const serviceSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  category: z.enum(['consultation', 'coaching', 'tutoring', 'fitness', 'creative', 'other']),
  duration: z.number().min(15).max(480), // 15 minutes to 8 hours
  price: z.number().min(0).max(10000),
  location: z.enum(['online', 'phone', 'in-person']),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

const categories = [
  { value: 'consultation', label: 'Consultation', emoji: '💡' },
  { value: 'coaching', label: 'Coaching', emoji: '🎯' },
  { value: 'tutoring', label: 'Tutoring', emoji: '📚' },
  { value: 'fitness', label: 'Fitness', emoji: '💪' },
  { value: 'creative', label: 'Creative', emoji: '🎨' },
  { value: 'other', label: 'Other', emoji: '⚡' },
];

const locations = [
  { value: 'online', label: 'Online', icon: '💻' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'in-person', label: 'In-Person', icon: '📍' },
];

interface EditServicePageProps {
  params: Promise<{ id: string }>
}

export default function EditServicePage({ params }: EditServicePageProps) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [availabilitySlots, setAvailabilitySlots] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceId, setServiceId] = useState<string>('');
  
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'consultation',
      duration: 60,
      price: 50,
      location: 'online',
    },
  });

  // Load service data
  useEffect(() => {
    async function loadService() {
      try {
        const resolvedParams = await params;
        setServiceId(resolvedParams.id);
        
        if (!isAuthenticated || !user) {
          router.push('/auth');
          return;
        }

        const { data: service, error } = await supabase
          .from('services')
          .select('*')
          .eq('id', resolvedParams.id)
          .eq('provider_id', user.id) // Ensure user owns this service
          .single();

        if (error || !service) {
          alert('Service not found or access denied');
          router.push('/dashboard');
          return;
        }

        // Populate form with existing data
        form.reset({
          title: service.title,
          description: service.description,
          category: service.category as any,
          duration: service.duration,
          price: service.price,
          location: service.location as any,
        });

        // Parse and set availability slots
        if (service.availability_slots) {
          const slots = JSON.parse(service.availability_slots);
          setAvailabilitySlots(slots);
        }

        setServiceLoading(false);
      } catch (error) {
        console.error('Error loading service:', error);
        alert('Failed to load service');
        router.push('/dashboard');
      }
    }

    loadService();
  }, [params, user, isAuthenticated, router, form]);

  const handleSubmit = async (data: ServiceFormData) => {
    if (!isAuthenticated || !user) {
      router.push('/auth');
      return;
    }

    if (Object.keys(availabilitySlots).length === 0) {
      alert('Please select at least one availability slot');
      return;
    }
    
    setIsLoading(true);
    try {
      // Update service with Supabase
      const { error } = await supabase
        .from('services')
        .update({
          title: data.title,
          description: data.description,
          category: data.category,
          duration: data.duration,
          price: data.price,
          location: data.location,
          availability_slots: JSON.stringify(availabilitySlots),
          updated_at: new Date().toISOString(),
        })
        .eq('id', serviceId)
        .eq('provider_id', user.id); // Ensure user owns this service

      if (error) {
        console.error('Supabase error:', error);
        alert(error.message || 'Failed to update service');
        return;
      }

      // Success!
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to update service:', error);
      alert('Failed to update service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalSlots = () => {
    return Object.values(availabilitySlots).reduce((total, daySlots) => total + daySlots.length, 0);
  };

  if (serviceLoading) {
    return (
      <Page title="Edit Service" backUrl="/dashboard" backLabel="Back to Dashboard" maxWidth="xl">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            border: '2px solid var(--border-light)', 
            borderTop: '2px solid var(--accent-primary)', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
        </div>
      </Page>
    );
  }

  return (
    <Page 
      title="Edit Service" 
      backUrl="/dashboard" 
      backLabel="Back to Dashboard"
      maxWidth="xl"
    >
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid-responsive">
            {/* Left Side - Basic Info */}
            <Card>
              <CardHeader title="Service Details" />
              
              <CardContent spacing="xl">
                {/* Service Title */}
                <FormField 
                  label="Service Title" 
                  icon={<Tag size={16} />}
                  error={form.formState.errors.title?.message}
                >
                  <Input
                    {...form.register('title')}
                    type="text"
                    placeholder="e.g., 1-on-1 Python Tutoring"
                    error={!!form.formState.errors.title}
                  />
                </FormField>

                {/* Description */}
                <FormField 
                  label="Description" 
                  icon={<FileText size={16} />}
                  error={form.formState.errors.description?.message}
                >
                  <TextArea
                    {...form.register('description')}
                    rows={4}
                    placeholder="Describe what you offer, your experience, and what clients can expect..."
                    error={!!form.formState.errors.description}
                  />
                </FormField>

                {/* Category */}
                <FormField 
                  label="Category"
                  error={form.formState.errors.category?.message}
                >
                  <Select
                    {...form.register('category')}
                    error={!!form.formState.errors.category}
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.emoji} {category.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {/* Duration and Price */}
                <div className="grid-2">
                  <FormField 
                    label="Session Duration" 
                    icon={<Clock size={16} />}
                    error={form.formState.errors.duration?.message}
                  >
                    <Select
                      {...form.register('duration', { valueAsNumber: true })}
                      error={!!form.formState.errors.duration}
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                      <option value={180}>3 hours</option>
                      <option value={240}>4 hours</option>
                    </Select>
                  </FormField>

                  <FormField 
                    label="Price per Session" 
                    icon={<DollarSign size={16} />}
                    error={form.formState.errors.price?.message}
                  >
                    <Input
                      {...form.register('price', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      max="10000"
                      placeholder="50.00"
                      error={!!form.formState.errors.price}
                    />
                  </FormField>
                </div>

                {/* Location */}
                <FormField 
                  label="Location Type" 
                  icon={<MapPin size={16} />}
                  error={form.formState.errors.location?.message}
                >
                  <Select
                    {...form.register('location')}
                    error={!!form.formState.errors.location}
                  >
                    {locations.map((location) => (
                      <option key={location.value} value={location.value}>
                        {location.icon} {location.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </CardContent>
            </Card>

            {/* Right Side - Availability */}
            <Card style={{ height: 'fit-content' }}>
              <CardHeader 
                title="Availability Schedule" 
                subtitle={`${getTotalSlots()} slots selected`}
              />
              <CardContent>
                <WeeklyScheduleGrid
                  selectedSlots={availabilitySlots}
                  onSlotsChange={setAvailabilitySlots}
                />
              </CardContent>
            </Card>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-2xl)', marginTop: 'var(--space-2xl)', borderTop: '1px solid var(--border-light)' }}>
            <Button
              type="submit"
              disabled={isLoading || !form.formState.isValid || getTotalSlots() === 0}
              loading={isLoading}
              size="lg"
            >
              {isLoading ? 'Updating...' : 'Update Service'}
            </Button>
          </div>
        </form>
      </Page>
  );
}