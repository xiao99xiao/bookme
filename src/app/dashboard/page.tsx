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
    <div className="page-layout">
      {/* Header */}
      <header style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container-wide" style={{ padding: 'var(--space-lg) var(--space-lg)' }}>
          <div className="flex-between">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <h1 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)'
              }}>
                BookMe
                <span style={{ color: '#22c55e', fontSize: '1.25rem' }}>●</span>
              </h1>
            </Link>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <button
                onClick={handleViewProfile}
                style={{
                  padding: 'var(--space-sm)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  transition: 'color 0.2s ease'
                }}
                title="View your public profile"
              >
                <ExternalLink size={20} />
              </button>
              <img 
                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=8b5cf6&color=fff`}
                alt={user.displayName}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: '2px solid var(--border-light)'
                }}
              />
              <div className="hidden md:block">
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {user.displayName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  {user.email}
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  padding: 'var(--space-sm)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  transition: 'color 0.2s ease'
                }}
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container-wide" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
        {/* Welcome Section */}
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: 'var(--space-sm)' }}>
            Welcome back, {user.displayName}!
          </h1>
          <p className="text-large text-muted">Manage your services and bookings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid-responsive" style={{ marginBottom: 'var(--space-2xl)' }}>
          <div className="card text-center">
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: 'var(--radius-md)', 
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-md)'
            }}>
              <Calendar size={24} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: 'var(--space-xs)' }}>
              {userServices.length}
            </div>
            <div className="text-small">Active Services</div>
          </div>
          
          <div className="card text-center">
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: 'var(--radius-md)', 
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-md)'
            }}>
              <MessageCircle size={24} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: 'var(--space-xs)' }}>
              {incomingRequests.filter(r => r.status === 'pending').length}
            </div>
            <div className="text-small">Pending Requests</div>
          </div>

          <div className="card text-center">
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: 'var(--radius-md)', 
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-md)'
            }}>
              <Star size={24} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: 'var(--space-xs)' }}>
              {user.rating.toFixed(1)}
            </div>
            <div className="text-small">Average Rating</div>
          </div>

          <div className="card text-center">
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: 'var(--radius-md)', 
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-md)'
            }}>
              <Clock size={24} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: 'var(--space-xs)' }}>
              {myRequests.length}
            </div>
            <div className="text-small">My Requests</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card-elevated">
          <div style={{ borderBottom: '1px solid var(--border-light)' }}>
            <nav style={{ 
              display: 'flex', 
              gap: 'var(--space-lg)', 
              padding: '0 var(--space-lg)',
              overflowX: 'auto'
            }}>
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
                  style={{
                    padding: 'var(--space-lg) var(--space-sm)',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent-primary)' : 'transparent'}`,
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease',
                    background: 'none',
                    cursor: 'pointer',
                    color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div style={{ padding: 'var(--space-xl)' }}>
            {activeTab === 'overview' && (
              <div className="space-y-xl">
                {/* Profile Section */}
                <div className="card" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <div className="flex-between" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ 
                        padding: 'var(--space-sm)', 
                        backgroundColor: 'var(--accent-primary)', 
                        borderRadius: 'var(--radius-md)',
                        marginRight: 'var(--space-lg)'
                      }}>
                        <User size={24} style={{ color: 'white' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>
                          Your Public Profile
                        </h3>
                        <p className="text-small">Share your profile link with potential clients</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                      <button
                        onClick={handleViewProfile}
                        className="btn-primary"
                        style={{ 
                          width: 'auto', 
                          padding: 'var(--space-sm) var(--space-lg)',
                          fontSize: '0.875rem'
                        }}
                      >
                        <ExternalLink size={16} />
                        Preview
                      </button>
                      <button
                        onClick={handleCopyProfileLink}
                        className="btn-secondary"
                        style={{ 
                          width: 'auto', 
                          padding: 'var(--space-sm) var(--space-lg)',
                          fontSize: '0.875rem'
                        }}
                      >
                        <Copy size={16} />
                        Copy Link
                      </button>
                    </div>
                  </div>
                  <div className="card" style={{ 
                    padding: 'var(--space-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)',
                    wordBreak: 'break-all'
                  }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/profile/${user.id}` : `/profile/${user.id}`}
                  </div>
                </div>

                <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>👋</div>
                  <h2 style={{ marginBottom: 'var(--space-md)' }}>Dashboard Overview</h2>
                  <p className="text-muted" style={{ 
                    marginBottom: 'var(--space-xl)',
                    maxWidth: '400px',
                    margin: '0 auto var(--space-xl)'
                  }}>
                    This is your central hub for managing services and bookings
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: 'var(--space-md)',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={() => setActiveTab('slots')}
                      className="btn-primary"
                      style={{ width: 'auto', padding: 'var(--space-lg) var(--space-xl)' }}
                    >
                      Manage Services
                    </button>
                    <Link href="/discover" style={{ textDecoration: 'none' }}>
                      <button 
                        className="btn-secondary"
                        style={{ width: 'auto', padding: 'var(--space-lg) var(--space-xl)' }}
                      >
                        Browse Services
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'slots' && (
              <div className="space-y-xl">
                <div className="flex-between">
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>My Services</h3>
                  <Link href="/create-service" style={{ textDecoration: 'none' }}>
                    <button className="btn-primary" style={{ 
                      width: 'auto', 
                      padding: 'var(--space-md) var(--space-lg)',
                      fontSize: '0.875rem'
                    }}>
                      <Plus size={16} />
                      Add Service
                    </button>
                  </Link>
                </div>

                {loading ? (
                  <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      border: '3px solid var(--border-light)', 
                      borderTop: '3px solid var(--accent-primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto var(--space-md)'
                    }}></div>
                    <div className="text-muted">Loading your services...</div>
                  </div>
                ) : userServices.length === 0 ? (
                  <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>📋</div>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>No services yet</h3>
                    <p className="text-muted" style={{ marginBottom: 'var(--space-xl)' }}>Create your first service to get started</p>
                    <Link href="/create-service" style={{ textDecoration: 'none' }}>
                      <button className="btn-primary" style={{ 
                        width: 'auto', 
                        padding: 'var(--space-lg) var(--space-xl)'
                      }}>
                        Create First Service
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid-responsive">
                    {userServices.map((service) => (
                      <div key={service.id} className="card" style={{ transition: 'all 0.2s ease' }}>
                        <div className="flex-between" style={{ marginBottom: 'var(--space-lg)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <span style={{ fontSize: '1.5rem', marginRight: 'var(--space-md)' }}>
                              {getSlotCategoryEmoji(service.category)}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 'var(--space-sm)', 
                                marginBottom: 'var(--space-xs)'
                              }}>
                                <h4 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{service.title}</h4>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: 'var(--space-xs) var(--space-sm)',
                                  borderRadius: 'var(--radius-full)',
                                  fontWeight: '500',
                                  backgroundColor: service.is_active ? 'var(--success)' : 'var(--error)',
                                  color: 'white'
                                }}>
                                  {service.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <p className="text-muted" style={{ fontSize: '0.875rem' }}>{service.description}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            <button
                              onClick={() => handleToggleServiceStatus(service.id, service.is_active)}
                              style={{
                                padding: 'var(--space-xs) var(--space-sm)',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                borderRadius: 'var(--radius-full)',
                                transition: 'all 0.2s ease',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: service.is_active ? 'var(--bg-secondary)' : 'var(--accent-light)',
                                color: service.is_active ? 'var(--text-secondary)' : 'var(--accent-primary)'
                              }}
                              title={service.is_active ? 'Click to deactivate service' : 'Click to activate service'}
                            >
                              {service.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => router.push(`/edit-service/${service.id}`)}
                              style={{
                                padding: 'var(--space-xs)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-tertiary)',
                                transition: 'color 0.2s ease'
                              }}
                              title="Edit service"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteService(service.id)}
                              style={{
                                padding: 'var(--space-xs)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-tertiary)',
                                transition: 'color 0.2s ease'
                              }}
                              title="Delete service"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-sm" style={{ marginBottom: 'var(--space-lg)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <Calendar size={16} style={{ marginRight: 'var(--space-sm)' }} />
                            <span>{Object.values(service.availabilitySlots).reduce((total, slots) => total + slots.length, 0)} availability slots</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <Clock size={16} style={{ marginRight: 'var(--space-sm)' }} />
                            <span>{service.duration} minutes per session</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontSize: '1.125rem', marginRight: 'var(--space-sm)' }}>{getLocationIcon(service.location)}</span>
                            <span style={{ textTransform: 'capitalize' }}>{service.location}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--success)' }}>
                          {formatPrice(service.price)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="space-y-xl">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Incoming Booking Requests</h3>

                {loading ? (
                  <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      border: '3px solid var(--border-light)', 
                      borderTop: '3px solid var(--accent-primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto var(--space-md)'
                    }}></div>
                    <div className="text-muted">Loading booking requests...</div>
                  </div>
                ) : incomingRequests.length === 0 ? (
                  <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>📬</div>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>No incoming requests</h3>
                    <p className="text-muted">New booking requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-lg">
                    {incomingRequests.map((booking) => (
                      <div key={booking.id} className="card">
                        <div className="flex-between" style={{ marginBottom: 'var(--space-lg)' }}>
                          <div>
                            <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>
                              {booking.service.title}
                            </h4>
                            <p className="text-muted" style={{ marginBottom: 'var(--space-xs)' }}>
                              Request from {booking.requester.displayName}
                            </p>
                            <p className="text-small">
                              {booking.service.duration} min • {booking.service.location} • ${booking.service.price}
                            </p>
                          </div>
                          <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            backgroundColor: 
                              booking.status === 'pending' ? 'var(--warning)' :
                              booking.status === 'confirmed' ? 'var(--success)' :
                              'var(--error)',
                            color: 'white'
                          }}>
                            {booking.status}
                          </div>
                        </div>

                        <div className="card" style={{ 
                          backgroundColor: 'var(--bg-secondary)', 
                          padding: 'var(--space-lg)',
                          marginBottom: 'var(--space-lg)'
                        }}>
                          <p style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                            "{booking.message}"
                          </p>
                        </div>

                        {booking.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <button
                              onClick={() => handleBookingResponse(booking.id, 'confirmed')}
                              className="btn-primary"
                              style={{ 
                                backgroundColor: 'var(--success)',
                                flex: 1,
                                padding: 'var(--space-lg)'
                              }}
                            >
                              <Check size={16} />
                              Accept
                            </button>
                            <button
                              onClick={() => handleBookingResponse(booking.id, 'declined')}
                              className="btn-secondary"
                              style={{ 
                                borderColor: 'var(--error)',
                                color: 'var(--error)',
                                flex: 1,
                                padding: 'var(--space-lg)'
                              }}
                            >
                              <X size={16} />
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
              <div className="space-y-xl">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>My Booking Requests</h3>

                {loading ? (
                  <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      border: '3px solid var(--border-light)', 
                      borderTop: '3px solid var(--accent-primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto var(--space-md)'
                    }}></div>
                    <div className="text-muted">Loading your requests...</div>
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>📋</div>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>No requests sent</h3>
                    <p className="text-muted" style={{ marginBottom: 'var(--space-xl)' }}>
                      <Link href="/discover" className="link-purple">
                        Browse services
                      </Link>
                      {' '}to send your first booking request
                    </p>
                  </div>
                ) : (
                  <div className="space-y-lg">
                    {myRequests.map((booking) => (
                      <div key={booking.id} className="card">
                        <div className="flex-between" style={{ marginBottom: 'var(--space-lg)' }}>
                          <div>
                            <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>
                              {booking.service.title}
                            </h4>
                            <p className="text-muted" style={{ marginBottom: 'var(--space-xs)' }}>
                              with Service Provider
                            </p>
                            <p className="text-small">
                              {booking.service.duration} min • {booking.service.location} • ${booking.service.price}
                            </p>
                          </div>
                          <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            backgroundColor: 
                              booking.status === 'pending' ? 'var(--warning)' :
                              booking.status === 'confirmed' ? 'var(--success)' :
                              'var(--error)',
                            color: 'white'
                          }}>
                            {booking.status}
                          </div>
                        </div>

                        <div className="card" style={{ 
                          backgroundColor: 'var(--bg-secondary)', 
                          padding: 'var(--space-lg)'
                        }}>
                          <p style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                            "{booking.message}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-xl">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Profile Settings</h3>
                
                <div className="grid-2">
                  {/* Profile Form */}
                  <div className="space-y-xl">
                    {/* Display Name */}
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '0.875rem', 
                        fontWeight: '500', 
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--space-sm)'
                      }}>
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={profileData.displayName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                        className="input-field"
                        placeholder="Your display name"
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '0.875rem', 
                        fontWeight: '500', 
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--space-sm)'
                      }}>
                        Location
                      </label>
                      <input
                        type="text"
                        value={profileData.location}
                        onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                        className="input-field"
                        placeholder="e.g., San Francisco, CA"
                      />
                    </div>

                    {/* Bio with Markdown Support */}
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '0.875rem', 
                        fontWeight: '500', 
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--space-sm)'
                      }}>
                        About Me (Bio)
                      </label>
                      <textarea
                        value={profileData.bio}
                        onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                        rows={8}
                        style={{
                          width: '100%',
                          padding: 'var(--space-lg) var(--space-lg)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-lg)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                          resize: 'none',
                          outline: 'none',
                          transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--accent-primary)';
                          e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--border-light)';
                          e.target.style.boxShadow = 'none';
                        }}
                        placeholder="Tell potential clients about yourself...

You can use basic markdown:
- **bold text**
- *italic text*
- [link text](https://example.com)
- ## Headings
- - Bullet points"
                        maxLength={1000}
                      />
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '0.75rem', 
                        color: 'var(--text-tertiary)',
                        marginTop: 'var(--space-xs)'
                      }}>
                        <span>Supports basic Markdown formatting</span>
                        <span>{profileData.bio.length}/1000</span>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleUpdateProfile}
                        disabled={profileLoading}
                        className="btn-primary"
                        style={{ 
                          width: 'auto',
                          padding: 'var(--space-lg) var(--space-xl)',
                          opacity: profileLoading ? '0.5' : '1',
                          cursor: profileLoading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {profileLoading ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-lg)' }}>Preview</h4>
                    <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-lg)', 
                        marginBottom: 'var(--space-lg)'
                      }}>
                        <img 
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.displayName || user.displayName)}&background=8b5cf6&color=fff`}
                          alt={profileData.displayName || user.displayName}
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            border: '4px solid var(--bg-primary)'
                          }}
                        />
                        <div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: 'var(--space-xs)' }}>
                            {profileData.displayName || 'Your Name'}
                          </h3>
                          {profileData.location && (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              color: 'var(--text-secondary)', 
                              fontSize: '0.875rem'
                            }}>
                              <MapPin size={16} style={{ marginRight: 'var(--space-xs)' }} />
                              {profileData.location}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {profileData.bio && (
                        <div>
                          <h4 style={{ fontWeight: '600', marginBottom: 'var(--space-sm)' }}>About</h4>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {profileData.bio.split('\n').map((line, index) => {
                              // Basic markdown rendering
                              let processedLine = line
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: var(--accent-primary); text-decoration: none;" target="_blank" rel="noopener noreferrer">$1</a>')
                                .replace(/^## (.+)$/g, '<h3 style="font-size: 1.125rem; font-weight: 600; margin-top: var(--space-md); margin-bottom: var(--space-xs);">$1</h3>')
                                .replace(/^- (.+)$/g, '<li style="margin-left: var(--space-lg);">• $1</li>');
                              
                              return (
                                <div key={index} dangerouslySetInnerHTML={{ __html: processedLine || '<br>' }} style={{ marginBottom: 'var(--space-sm)' }} />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ marginTop: 'var(--space-lg)', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
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