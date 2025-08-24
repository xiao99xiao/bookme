'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Clock, DollarSign, MapPin, Tag, FileText } from 'lucide-react';
import { z } from 'zod';
import { getLocationIcon } from '@/lib/utils';
import { TimeSlotSelector } from './TimeSlotSelector';

// Updated schema for service with weekly schedule
const serviceSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  duration: z.number().min(15).max(480), // 15 minutes to 8 hours
  price: z.number().min(0).max(10000),
  location: z.enum(['online', 'phone', 'in-person']),
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

export default function CreateServiceModal({ isOpen, onClose, onSubmit, isLoading = false }: CreateServiceModalProps) {
  const [timeSlots, setTimeSlots] = useState<{ [key: string]: boolean }>({});
  
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: '',
      description: '',
      duration: 60,
      price: 50,
      location: 'online',
    },
  });

  const handleSubmit = async (data: ServiceFormData) => {
    if (Object.keys(timeSlots).length === 0) {
      alert('Please select at least one time slot');
      return;
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
                    {getTotalSlots() > 0 && (
                      <div className="mt-2 text-xs text-blue-600">
                        {getTotalSlots()} time slots selected
                      </div>
                    )}
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