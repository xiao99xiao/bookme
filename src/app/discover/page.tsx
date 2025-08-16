'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Clock, Star, Calendar, MessageCircle, Heart, Target } from 'lucide-react';
import Link from 'next/link';

import { useAuthStore } from '@/stores/auth';
import { formatDate, formatTime, formatPrice, getSlotCategoryEmoji, getLocationIcon } from '@/lib/utils';
import UserProfileCard from '@/components/UserProfileCard';

interface Provider {
  id: string;
  displayName: string;
  bio?: string;
  location?: string;
  hobbies?: string[];
  interests?: string[];
  avatar?: string;
  rating: number;
  reviewCount: number;
}

interface ServiceWithProvider {
  id: string;
  title: string;
  description: string;
  category: string;
  availabilitySlots: Record<string, string[]>;
  duration: number;
  price: number;
  location: string;
  isActive: boolean;
  provider: Provider;
}

export default function DiscoverPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [services, setServices] = useState<ServiceWithProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [showBookingModal, setShowBookingModal] = useState<string | null>(null);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const categories = ['all', 'consultation', 'coaching', 'tutoring', 'fitness', 'creative', 'other'];
  const locations = ['all', 'online', 'phone', 'in-person'];

  // Fetch services from database
  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedLocation !== 'all') params.append('location', selectedLocation);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/services?${params.toString()}`);
      const data = await response.json();
      
      if (response.ok) {
        setServices(data.services || []);
      } else {
        console.error('Failed to fetch services:', data.error);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [selectedCategory, selectedLocation, searchTerm]);

  const handleBookingSubmit = async (serviceId: string) => {
    if (!isAuthenticated || !user) {
      return;
    }

    if (bookingMessage.trim().length < 10) {
      return;
    }

    setBookingLoading(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          requesterId: user.id,
          message: bookingMessage.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setShowBookingModal(null);
        setBookingMessage('');
        alert('Booking request sent successfully!');
      } else {
        alert(result.error || 'Failed to send booking request');
      }
    } catch (error) {
      alert('Failed to send booking request. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                BookMe
              </h1>
            </Link>
            
            <nav className="flex items-center space-x-6">
              <Link href="/" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                Home
              </Link>
              {isAuthenticated ? (
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                  Dashboard
                </Link>
              ) : (
                <Link href="/auth" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Services</h1>
          <p className="text-lg text-gray-600">Find and book services from community members</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                {locations.map(location => (
                  <option key={location} value={location}>
                    {location === 'all' ? 'All Locations' : location.charAt(0).toUpperCase() + location.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">Loading services...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {services.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500 text-lg mb-2">No services found</div>
                <p className="text-gray-400">Try adjusting your search criteria</p>
              </div>
            ) : (
              services.map((service) => (
                <div key={service.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    {/* Provider Profile */}
                    <div className="mb-6">
                      <UserProfileCard user={service.provider} size="sm" />
                    </div>

                    {/* Service Info */}
                    <div className="mb-4">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">{getSlotCategoryEmoji(service.category)}</span>
                        <h4 className="font-semibold text-xl text-gray-900 flex-1">{service.title}</h4>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 mb-6 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>{Object.values(service.availabilitySlots).reduce((total, slots) => total + slots.length, 0)} available slots</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>{service.duration} min sessions</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <span className="text-lg mr-2">{getLocationIcon(service.location)}</span>
                        <span className="capitalize">{service.location}</span>
                      </div>
                    </div>

                    {/* Provider Highlights */}
                    {(service.provider.hobbies?.length || service.provider.interests?.length) && (
                      <div className="mb-6 space-y-3">
                        {service.provider.hobbies && service.provider.hobbies.length > 0 && (
                          <div>
                            <div className="flex items-center text-xs font-medium text-gray-500 mb-2">
                              <Heart className="w-3 h-3 mr-1" />
                              Provider's Hobbies
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {service.provider.hobbies.slice(0, 4).map((hobby) => (
                                <span
                                  key={hobby}
                                  className="px-2 py-1 text-xs bg-pink-50 text-pink-700 rounded-full border border-pink-200"
                                >
                                  {hobby}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {service.provider.interests && service.provider.interests.length > 0 && (
                          <div>
                            <div className="flex items-center text-xs font-medium text-gray-500 mb-2">
                              <Target className="w-3 h-3 mr-1" />
                              Provider's Interests
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {service.provider.interests.slice(0, 4).map((interest) => (
                                <span
                                  key={interest}
                                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200"
                                >
                                  {interest}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price and Action */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="text-3xl font-bold text-green-600">
                        {formatPrice(service.price)}
                      </div>
                      <button
                        onClick={() => setShowBookingModal(service.id)}
                        disabled={!isAuthenticated}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Booking Modal */}
        {showBookingModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold mb-4">Send Booking Request</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message to provider:
                </label>
                <textarea
                  value={bookingMessage}
                  onChange={(e) => setBookingMessage(e.target.value)}
                  placeholder="Introduce yourself and explain why you're interested in this service..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {bookingMessage.length}/500 characters (minimum 10)
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBookingModal(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBookingSubmit(showBookingModal)}
                  disabled={bookingMessage.trim().length < 10 || bookingLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  {bookingLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm">
            <p className="text-sm font-medium mb-2">Sign in to book services</p>
            <Link href="/auth" className="text-blue-200 hover:text-white text-sm underline">
              Create an account →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}