'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Clock, DollarSign, MapPin, Tag, FileText } from 'lucide-react';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { getSlotCategoryEmoji, getLocationIcon } from '@/lib/utils';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';

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
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          providerId: user.id,
          availabilitySlots: JSON.stringify(availabilitySlots),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        form.reset();
        setAvailabilitySlots({});
        router.push('/dashboard');
      } else {
        alert(result.error || 'Failed to create service');
      }
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 mr-4">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Create New Service</h1>
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

                {/* Category & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      {...form.register('category')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                    >
                      {categories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.emoji} {category.label}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.category && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.category.message}</p>
                    )}
                  </div>

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
                        <span className="text-xl mr-2">{getSlotCategoryEmoji(form.watch('category'))}</span>
                        <h4 className="font-semibold text-gray-900">{form.watch('title')}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{form.watch('description')}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{form.watch('duration')} min • {getLocationIcon(form.watch('location'))} {form.watch('location')}</span>
                        <span className="font-semibold text-green-600">${form.watch('price')}</span>
                      </div>
                      {getTotalSlots() > 0 && (
                        <div className="mt-2 text-xs text-blue-600">
                          {getTotalSlots()} availability slots selected
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Availability Schedule */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 h-fit">
              <WeeklyScheduleGrid
                selectedSlots={availabilitySlots}
                onSlotsChange={setAvailabilitySlots}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-8 mt-8">
            <Link
              href="/dashboard"
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-6 rounded-xl font-medium transition-colors text-center"
            >
              Cancel
            </Link>
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