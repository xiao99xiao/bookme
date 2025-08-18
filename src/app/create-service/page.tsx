'use client';

import React, { useState } from 'react';
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
import Link from 'next/link';

// Updated schema for service with weekly schedule
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

export default function CreateServicePage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [availabilitySlots, setAvailabilitySlots] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  
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
      // Create service directly with Supabase
      const { data: service, error } = await supabase
        .from('services')
        .insert({
          title: data.title,
          description: data.description,
          category: data.category,
          duration: data.duration,
          price: data.price,
          location: data.location,
          provider_id: user.id,
          availability_slots: JSON.stringify(availabilitySlots),
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        alert(error.message || 'Failed to create service');
        return;
      }

      // Success!
      form.reset();
      setAvailabilitySlots({});
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to create service:', error);
      alert('Failed to create service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalSlots = () => {
    return Object.values(availabilitySlots).reduce((total, daySlots) => total + daySlots.length, 0);
  };

  // Redirect to auth if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Page 
      title="Create New Service" 
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
                    placeholder="e.g., JavaScript Programming Fundamentals"
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
                    placeholder="Describe what you'll cover, who it's for, and what participants will learn..."
                    error={!!form.formState.errors.description}
                  />
                </FormField>

                {/* Category & Location */}
                <div className="grid-2">
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
                </div>

                {/* Duration & Price */}
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

                {/* Preview */}
                {form.watch('title') && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', border: '1px solid var(--border-light)' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>Preview:</h3>
                    <div className="card" style={{ background: 'var(--bg-primary)', padding: 'var(--space-lg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                        <span style={{ fontSize: '1.25rem', marginRight: 'var(--space-sm)' }}>{getSlotCategoryEmoji(form.watch('category'))}</span>
                        <h4 style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{form.watch('title')}</h4>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>{form.watch('description')}</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>{form.watch('duration')} min • {getLocationIcon(form.watch('location'))} {form.watch('location')}</span>
                        <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>${form.watch('price')}</span>
                      </div>
                      {getTotalSlots() > 0 && (
                        <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
                          {getTotalSlots()} availability slots selected
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Side - Availability Schedule */}
            <Card style={{ height: 'fit-content' }}>
              <CardHeader title="Availability Schedule" />
              <CardContent>
                <WeeklyScheduleGrid
                  selectedSlots={availabilitySlots}
                  onSlotsChange={setAvailabilitySlots}
                />
              </CardContent>
            </Card>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-lg)', paddingTop: 'var(--space-2xl)', marginTop: 'var(--space-2xl)', borderTop: '1px solid var(--border-light)' }}>
            <Link
              href="/dashboard"
              className="btn-secondary"
              style={{ flex: '1', textAlign: 'center', textDecoration: 'none' }}
            >
              Cancel
            </Link>
            <Button
              type="submit"
              disabled={isLoading || !form.formState.isValid || getTotalSlots() === 0}
              loading={isLoading}
              style={{ flex: '1' }}
            >
              {isLoading ? 'Creating...' : `Create Service (${getTotalSlots()} slots)`}
            </Button>
          </div>
        </form>
      </Page>
  );
}