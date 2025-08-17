'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Clock, DollarSign, MapPin, Tag, FileText } from 'lucide-react';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { getSlotCategoryEmoji, getLocationIcon } from '@/lib/utils';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';
import { supabase } from '@/lib/supabase';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Edit Service</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side - Basic Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Service Details</h3>
              
              <div className="space-y-6">
                {/* Service Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="inline w-4 h-4 mr-1" />
                    Service Title
                  </label>
                  <input
                    type="text"
                    {...form.register('title')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 1-on-1 Python Tutoring"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Describe what you offer, your experience, and what clients can expect..."
                  />
                  {form.formState.errors.description && (
                    <p className="mt-1 text-sm text-red-600">{form.formState.errors.description.message}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Category</label>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((category) => (
                      <label key={category.value} className="relative">
                        <input
                          type="radio"
                          value={category.value}
                          {...form.register('category')}
                          className="sr-only peer"
                        />
                        <div className="flex items-center p-3 border-2 border-gray-200 rounded-xl cursor-pointer transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:border-gray-300">
                          <span className="text-lg mr-3">{category.emoji}</span>
                          <span className="text-sm font-medium text-gray-700 peer-checked:text-blue-700">{category.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Duration and Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="inline w-4 h-4 mr-1" />
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      {...form.register('duration', { valueAsNumber: true })}
                      min="15"
                      max="480"
                      step="15"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <DollarSign className="inline w-4 h-4 mr-1" />
                      Price ($)
                    </label>
                    <input
                      type="number"
                      {...form.register('price', { valueAsNumber: true })}
                      min="0"
                      max="10000"
                      step="5"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    Location
                  </label>
                  <div className="space-y-2">
                    {locations.map((location) => (
                      <label key={location.value} className="relative">
                        <input
                          type="radio"
                          value={location.value}
                          {...form.register('location')}
                          className="sr-only peer"
                        />
                        <div className="flex items-center p-3 border-2 border-gray-200 rounded-xl cursor-pointer transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:border-gray-300">
                          <span className="text-lg mr-3">{location.icon}</span>
                          <span className="text-sm font-medium text-gray-700 peer-checked:text-blue-700">{location.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Availability */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Availability Schedule
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({getTotalSlots()} slots selected)
                </span>
              </h3>
              
              <WeeklyScheduleGrid
                selectedSlots={availabilitySlots}
                onSlotsChange={setAvailabilitySlots}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Updating...' : 'Update Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}