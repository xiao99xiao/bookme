'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, MessageCircle, Star, Clock, MapPin, Edit, Trash2, Check, X, LogOut, ExternalLink, Copy, User } from 'lucide-react';
import Link from 'next/link';

import { useAuthStore } from '@/stores/auth';
import { formatDate, formatTime, formatPrice, getSlotCategoryEmoji, getLocationIcon } from '@/lib/utils';
import type { SlotFormData } from '@/lib/validations';
import { supabase } from '@/lib/supabase';

interface UserService {
  id: string;
  title: string;
  description: string;
  category: string;
  availabilitySlots: Record<string, string[]>;
  duration: number;
  price: number;
  location: string;
  isActive: boolean;
  createdAt: string;
}

interface Booking {
  id: string;
  serviceId: string;
  message: string;
  status: string;
  createdAt: string;
  requester: {
    id: string;
    displayName: string;
    avatar?: string;
    rating: number;
    reviewCount: number;
  };
  service: {
    id: string;
    title: string;
    description: string;
    duration: number;
    price: number;
    category: string;
    location: string;
    availabilitySlots: Record<string, string[]>;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'slots' | 'bookings' | 'requests' | 'profile'>('overview');
  const [userServices, setUserServices] = useState<UserService[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Booking[]>([]);
  const [myRequests, setMyRequests] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Profile settings state
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    location: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
  }, [isAuthenticated, router]);

  // Fetch user's data
  const fetchUserData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user's services directly from Supabase (bypasses API RLS issues)
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          provider:users(
            id,
            display_name,
            bio,
            location,
            hobbies,
            interests,
            avatar,
            rating,
            review_count
          )
        `)
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Direct Supabase query result:', { 
        servicesCount: services?.length || 0, 
        error: servicesError?.message,
        services: services 
      });

      if (!servicesError && services) {
        // Parse JSON fields for response
        const parsedServices = services.map(service => ({
          ...service,
          provider: {
            ...service.provider,
            hobbies: service.provider?.hobbies ? JSON.parse(service.provider.hobbies) : [],
            interests: service.provider?.interests ? JSON.parse(service.provider.interests) : [],
          },
          availabilitySlots: service.availability_slots ? JSON.parse(service.availability_slots) : {},
        }));
        
        setUserServices(parsedServices);
      } else if (servicesError) {
        console.error('Error fetching services:', servicesError);
      }

      // Fetch incoming booking requests
      const incomingResponse = await fetch(`/api/bookings?providerId=${user.id}`);
      const incomingData = await incomingResponse.json();
      if (incomingResponse.ok) {
        setIncomingRequests(incomingData.bookings || []);
      }

      // Fetch user's booking requests
      const userResponse = await fetch(`/api/bookings?userId=${user.id}`);
      const userData = await userResponse.json();
      if (userResponse.ok) {
        setMyRequests(userData.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserData();
      // Initialize profile data from user
      setProfileData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        location: user.location || '',
      });
    }
  }, [user]);

  const handleCreateService = async (data: SlotFormData) => {
    if (!user) return;
    
    setCreateLoading(true);
    try {
      const response = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          providerId: user.id,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        fetchUserData(); // Refresh the data
        alert('Service created successfully!');
      } else {
        alert(result.error || 'Failed to create service');
      }
    } catch (error) {
      alert('Failed to create service. Please try again.');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchUserData(); // Refresh the data
        alert('Service deleted successfully!');
      } else {
        alert('Failed to delete service');
      }
    } catch (error) {
      alert('Failed to delete service. Please try again.');
    }
  };

  const handleToggleServiceStatus = async (serviceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !currentStatus })
        .eq('id', serviceId)
        .eq('provider_id', user?.id); // Ensure user owns this service

      if (error) {
        console.error('Supabase error:', error);
        alert('Failed to update service status');
        return;
      }

      // Refresh the data
      fetchUserData();
      alert(`Service ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
    } catch (error) {
      console.error('Error toggling service status:', error);
      alert('Failed to update service status. Please try again.');
    }
  };

  const handleBookingResponse = async (bookingId: string, status: 'confirmed' | 'declined') => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        fetchUserData(); // Refresh the data
        alert(`Booking ${status} successfully!`);
      } else {
        alert(`Failed to ${status.toLowerCase()} booking`);
      }
    } catch (error) {
      alert('Failed to update booking. Please try again.');
    }
  };

  const handleLogout = () => {
    signOut();
    router.push('/');
  };

  const handleCopyProfileLink = async () => {
    if (!user) return;
    
    const profileUrl = `${window.location.origin}/profile/${user.id}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      alert('Profile link copied to clipboard!');
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = profileUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Profile link copied to clipboard!');
    }
  };

  const handleViewProfile = () => {
    if (!user) return;
    window.open(`/profile/${user.id}`, '_blank');
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          display_name: profileData.displayName,
          bio: profileData.bio,
          location: profileData.location,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Supabase error:', error);
        alert('Failed to update profile');
        return;
      }

      // Update local auth store
      await useAuthStore.getState().updateProfile({
        displayName: profileData.displayName,
        bio: profileData.bio,
        location: profileData.location,
      });

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

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
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleViewProfile}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                title="View your public profile"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
              <img 
                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=3b82f6&color=fff`}
                alt={user.displayName}
                className="w-10 h-10 rounded-full border-2 border-gray-200"
              />
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user.displayName}!</h1>
          <p className="text-lg text-gray-600">Manage your services and bookings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{userServices.length}</p>
                <p className="text-sm text-gray-600">Active Services</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{incomingRequests.filter(r => r.status === 'pending').length}</p>
                <p className="text-sm text-gray-600">Pending Requests</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{user.rating.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-gray-900">{myRequests.length}</p>
                <p className="text-sm text-gray-600">My Requests</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'slots', label: 'My Services' },
                { id: 'bookings', label: 'Incoming Requests' },
                { id: 'requests', label: 'My Requests' },
                { id: 'profile', label: 'Profile Settings' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Profile Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-4">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Your Public Profile</h3>
                        <p className="text-gray-600 text-sm">Share your profile link with potential clients</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleViewProfile}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Preview
                      </button>
                      <button
                        onClick={handleCopyProfileLink}
                        className="flex items-center px-3 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Link
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <code className="text-sm text-gray-600 break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/profile/${user.id}` : `/profile/${user.id}`}
                    </code>
                  </div>
                </div>

                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👋</div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard Overview</h3>
                  <p className="text-gray-600 mb-6">
                    This is your central hub for managing services and bookings
                  </p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => setActiveTab('slots')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Manage Services
                    </button>
                    <Link href="/discover" className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors">
                      Browse Services
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'slots' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900">My Services</h3>
                  <Link
                    href="/create-service"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Service
                  </Link>
                </div>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500">Loading your services...</div>
                  </div>
                ) : userServices.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">No services yet</div>
                    <p className="text-gray-500 mb-4">Create your first service to get started</p>
                    <Link
                      href="/create-service"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                    >
                      Create First Service
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {userServices.map((service) => (
                      <div key={service.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{getSlotCategoryEmoji(service.category)}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-lg text-gray-900">{service.title}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  service.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {service.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <p className="text-gray-600 text-sm">{service.description}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleToggleServiceStatus(service.id, service.is_active)}
                              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                service.is_active 
                                  ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' 
                                  : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'
                              }`}
                              title={service.is_active ? 'Click to deactivate service' : 'Click to activate service'}
                            >
                              {service.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => router.push(`/edit-service/${service.id}`)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit service"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(service.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete service"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            <span>{Object.values(service.availabilitySlots).reduce((total, slots) => total + slots.length, 0)} availability slots</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2" />
                            <span>{service.duration} minutes per session</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-lg mr-2">{getLocationIcon(service.location)}</span>
                            <span className="capitalize">{service.location}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold text-green-600">{formatPrice(service.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">Incoming Booking Requests</h3>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500">Loading booking requests...</div>
                  </div>
                ) : incomingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">No incoming requests</div>
                    <p className="text-gray-500">New booking requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incomingRequests.map((booking) => (
                      <div key={booking.id} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold text-lg text-gray-900 mb-1">{booking.service.title}</h4>
                            <p className="text-gray-600">Request from {booking.requester.displayName}</p>
                            <p className="text-sm text-gray-500">{booking.service.duration} min • {booking.service.location} • ${booking.service.price}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {booking.status}
                          </div>
                        </div>

                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700 italic">"{booking.message}"</p>
                        </div>

                        {booking.status === 'pending' && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleBookingResponse(booking.id, 'confirmed')}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleBookingResponse(booking.id, 'declined')}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">My Booking Requests</h3>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500">Loading your requests...</div>
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">No requests sent</div>
                    <p className="text-gray-500">
                      <Link href="/discover" className="text-blue-600 hover:text-blue-700 underline">
                        Browse services
                      </Link>
                      {' '}to send your first booking request
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myRequests.map((booking) => (
                      <div key={booking.id} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold text-lg text-gray-900 mb-1">{booking.service.title}</h4>
                            <p className="text-gray-600">with Service Provider</p>
                            <p className="text-sm text-gray-500">{booking.service.duration} min • {booking.service.location} • ${booking.service.price}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {booking.status}
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700 italic">"{booking.message}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">Profile Settings</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Profile Form */}
                  <div className="space-y-6">
                    {/* Display Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={profileData.displayName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your display name"
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={profileData.location}
                        onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., San Francisco, CA"
                      />
                    </div>

                    {/* Bio with Markdown Support */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        About Me (Bio)
                      </label>
                      <textarea
                        value={profileData.bio}
                        onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                        rows={8}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                        placeholder="Tell potential clients about yourself...

You can use basic markdown:
- **bold text**
- *italic text*
- [link text](https://example.com)
- ## Headings
- - Bullet points"
                        maxLength={1000}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Supports basic Markdown formatting</span>
                        <span>{profileData.bio.length}/1000</span>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={handleUpdateProfile}
                        disabled={profileLoading}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {profileLoading ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Preview</h4>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <div className="flex items-center gap-4 mb-4">
                        <img 
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.displayName || user.displayName)}&background=3b82f6&color=fff`}
                          alt={profileData.displayName || user.displayName}
                          className="w-16 h-16 rounded-full border-4 border-gray-100"
                        />
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {profileData.displayName || 'Your Name'}
                          </h3>
                          {profileData.location && (
                            <div className="flex items-center text-gray-600 text-sm">
                              <MapPin className="h-4 w-4 mr-1" />
                              {profileData.location}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {profileData.bio && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-2">About</h4>
                          <div className="text-gray-700 text-sm space-y-2">
                            {profileData.bio.split('\n').map((line, index) => {
                              // Basic markdown rendering
                              let processedLine = line
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
                                .replace(/^## (.+)$/g, '<h3 class="text-lg font-semibold text-gray-900 mt-3 mb-1">$1</h3>')
                                .replace(/^- (.+)$/g, '<li class="ml-4">• $1</li>');
                              
                              return (
                                <div key={index} dangerouslySetInnerHTML={{ __html: processedLine || '<br>' }} />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 text-sm text-gray-500">
                      <p>This is how your profile will appear to potential clients.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}