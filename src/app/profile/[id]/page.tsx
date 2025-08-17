'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  User, 
  MapPin, 
  Star, 
  Calendar, 
  Clock, 
  DollarSign,
  MessageCircle,
  ArrowLeft,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import { formatPrice, getSlotCategoryEmoji, getLocationIcon } from '@/lib/utils';

interface UserProfile {
  id: string;
  display_name: string;
  bio?: string;
  location?: string;
  avatar?: string;
  rating: number;
  review_count: number;
  is_active: boolean;
  created_at: string;
}

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  price: number;
  location: string;
  availability_slots: string;
  is_active: boolean;
  created_at: string;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  const userId = params.id as string;

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      // Load user profile
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('is_active', true)
        .single();

      if (userError || !userProfile) {
        console.error('User not found:', userError);
        router.push('/discover');
        return;
      }

      setProfile(userProfile);

      // Load user's active services
      const { data: userServices, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('provider_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!servicesError && userServices) {
        setServices(userServices);
      }

    } catch (error) {
      console.error('Error loading profile:', error);
      router.push('/discover');
    } finally {
      setLoading(false);
    }
  };

  const handleBookService = (service: Service) => {
    if (!isAuthenticated) {
      // Redirect to auth with return URL
      router.push(`/auth?returnTo=${encodeURIComponent(`/profile/${userId}`)}`);
      return;
    }

    if (currentUser?.id === userId) {
      alert("You can't book your own service!");
      return;
    }

    setSelectedService(service);
    setBookingMessage('');
    setShowBookingModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !currentUser) return;

    if (!bookingMessage.trim()) {
      alert('Please enter a message for your booking request');
      return;
    }

    setIsBookingLoading(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          requesterId: currentUser.id,
          message: bookingMessage.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Booking request sent successfully! The service provider will review your request.');
        setShowBookingModal(false);
        setSelectedService(null);
        setBookingMessage('');
      } else {
        alert(result.error || 'Failed to send booking request');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to send booking request. Please try again.');
    } finally {
      setIsBookingLoading(false);
    }
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
          <Link href="/discover" className="text-blue-600 hover:text-blue-700">
            ← Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/discover" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Discover
            </Link>
            <Link href="/" className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                BookMe
              </h1>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.display_name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-100">
                  <User className="h-12 w-12 text-gray-500" />
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {profile.display_name}
                  </h1>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {profile.location && (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {profile.location}
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Joined {formatJoinDate(profile.created_at)}
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-4 w-4 ${
                            i < Math.floor(profile.rating) 
                              ? 'text-yellow-400 fill-current' 
                              : 'text-gray-300'
                          }`} 
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">
                      {profile.rating.toFixed(1)} ({profile.review_count} reviews)
                    </span>
                  </div>
                </div>

                {/* Contact Button */}
                {isAuthenticated && currentUser?.id !== userId && (
                  <div className="mt-4 sm:mt-0">
                    <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Contact
                    </button>
                  </div>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">About</h3>
                  <div className="text-gray-700 leading-relaxed space-y-2">
                    {profile.bio.split('\n').map((line, index) => {
                      // Basic markdown rendering
                      let processedLine = line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
                        .replace(/^## (.+)$/g, '<h4 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h4>')
                        .replace(/^- (.+)$/g, '<li class="ml-4">• $1</li>');
                      
                      return (
                        <div key={index} dangerouslySetInnerHTML={{ __html: processedLine || '<br>' }} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Available Services</h2>
            <span className="text-sm text-gray-500">
              {services.length} service{services.length !== 1 ? 's' : ''} available
            </span>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Calendar className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Services Available</h3>
              <p className="text-gray-600">This user hasn't created any services yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <div key={service.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getSlotCategoryEmoji(service.category)}</span>
                      <div>
                        <h4 className="font-semibold text-lg text-gray-900">{service.title}</h4>
                        <p className="text-gray-600 text-sm line-clamp-2">{service.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>{service.duration} minutes</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span className="capitalize">{service.location}</span>
                    </div>
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 mr-2" />
                      <span className="capitalize">{service.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-green-600">{formatPrice(service.price)}</span>
                    <button
                      onClick={() => handleBookService(service)}
                      className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Request Booking</h3>
            
            {/* Service Details */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getSlotCategoryEmoji(selectedService.category)}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-lg text-gray-900 mb-1">{selectedService.title}</h4>
                  <p className="text-gray-600 text-sm mb-2">{selectedService.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {selectedService.duration} min
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {selectedService.location}
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      {formatPrice(selectedService.price)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message to {profile?.display_name}
              </label>
              <textarea
                value={bookingMessage}
                onChange={(e) => setBookingMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Tell the service provider why you're interested and any specific requirements..."
                maxLength={500}
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {bookingMessage.length}/500
              </div>
            </div>

            {/* Booking Info */}
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Your booking request will be sent to {profile?.display_name}</li>
                <li>• They'll review your request and respond within 24 hours</li>
                <li>• Once confirmed, you'll be able to message each other directly</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowBookingModal(false)}
                disabled={isBookingLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={isBookingLoading || !bookingMessage.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBookingLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}