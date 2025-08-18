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
            
            <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
              <Link href="/" className="text-muted" style={{ 
                fontWeight: '500',
                transition: 'color 0.2s ease',
                textDecoration: 'none'
              }}>
                Home
              </Link>
              {isAuthenticated ? (
                <Link href="/dashboard" className="text-muted" style={{ 
                  fontWeight: '500',
                  transition: 'color 0.2s ease',
                  textDecoration: 'none'
                }}>
                  Dashboard
                </Link>
              ) : (
                <Link href="/auth" style={{ textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ 
                    width: 'auto', 
                    padding: 'var(--space-md) var(--space-lg)',
                    fontSize: '0.875rem'
                  }}>
                    Sign In
                  </button>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="container-wide" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
        {/* Page Header */}
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: 'var(--space-md)' }}>Discover Services</h1>
          <p className="text-large text-muted">Find and book services from community members</p>
        </div>

        {/* Search and Filters */}
        <div className="card-elevated" style={{ marginBottom: 'var(--space-2xl)' }}>
          <div className="grid-responsive">
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: 'var(--space-lg)', 
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}>
                <Search size={20} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '3rem' }}
              />
            </div>

            {/* Category Filter */}
            <div style={{ position: 'relative' }}>
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: 'var(--space-lg)', 
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}>
                <Filter size={20} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '3rem', appearance: 'none' }}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div style={{ position: 'relative' }}>
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: 'var(--space-lg)', 
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}>
                <MapPin size={20} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '3rem', appearance: 'none' }}
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
            <div className="text-muted">Loading services...</div>
          </div>
        ) : (
          <div className="grid-2">
            {services.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-3xl) 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>🔍</div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-md)' }}>No services found</h3>
                <p className="text-muted">Try adjusting your search criteria</p>
              </div>
            ) : (
              services.map((service) => (
                <div key={service.id} className="card" style={{ transition: 'all 0.2s ease' }}>
                  {/* Provider Profile */}
                  <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <UserProfileCard user={service.provider} size="sm" />
                  </div>

                  {/* Service Info */}
                  <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                      <span style={{ fontSize: '1.5rem', marginRight: 'var(--space-md)' }}>{getSlotCategoryEmoji(service.category)}</span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: '600', flex: 1 }}>{service.title}</h4>
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 'var(--space-lg)' }}>{service.description}</p>
                  </div>

                  {/* Details */}
                  <div className="space-y-sm" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <Calendar size={16} style={{ marginRight: 'var(--space-sm)', flexShrink: 0 }} />
                      <span>{Object.values(service.availabilitySlots).reduce((total, slots) => total + slots.length, 0)} available slots</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <Clock size={16} style={{ marginRight: 'var(--space-sm)', flexShrink: 0 }} />
                      <span>{service.duration} min sessions</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontSize: '1.125rem', marginRight: 'var(--space-sm)' }}>{getLocationIcon(service.location)}</span>
                      <span style={{ textTransform: 'capitalize' }}>{service.location}</span>
                    </div>
                  </div>

                  {/* Provider Highlights */}
                  {(service.provider.hobbies?.length || service.provider.interests?.length) && (
                    <div className="space-y-md" style={{ marginBottom: 'var(--space-xl)' }}>
                      {service.provider.hobbies && service.provider.hobbies.length > 0 && (
                        <div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            fontSize: '0.75rem', 
                            fontWeight: '500', 
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-sm)'
                          }}>
                            <Heart size={12} style={{ marginRight: 'var(--space-xs)' }} />
                            Provider's Hobbies
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                            {service.provider.hobbies.slice(0, 4).map((hobby) => (
                              <span
                                key={hobby}
                                style={{
                                  padding: 'var(--space-xs) var(--space-sm)',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#fdf2f8',
                                  color: '#be185d',
                                  borderRadius: 'var(--radius-full)',
                                  border: '1px solid #fce7f3'
                                }}
                              >
                                {hobby}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {service.provider.interests && service.provider.interests.length > 0 && (
                        <div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            fontSize: '0.75rem', 
                            fontWeight: '500', 
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-sm)'
                          }}>
                            <Target size={12} style={{ marginRight: 'var(--space-xs)' }} />
                            Provider's Interests
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                            {service.provider.interests.slice(0, 4).map((interest) => (
                              <span
                                key={interest}
                                style={{
                                  padding: 'var(--space-xs) var(--space-sm)',
                                  fontSize: '0.75rem',
                                  backgroundColor: 'var(--accent-light)',
                                  color: 'var(--accent-primary)',
                                  borderRadius: 'var(--radius-full)',
                                  border: '1px solid var(--accent-primary)'
                                }}
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
                  <div className="flex-between" style={{ 
                    paddingTop: 'var(--space-lg)', 
                    borderTop: '1px solid var(--border-light)' 
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--success)' }}>
                      {formatPrice(service.price)}
                    </div>
                    <button
                      onClick={() => setShowBookingModal(service.id)}
                      disabled={!isAuthenticated}
                      className="btn-primary"
                      style={{ 
                        width: 'auto',
                        padding: 'var(--space-md) var(--space-lg)',
                        fontSize: '0.875rem',
                        opacity: !isAuthenticated ? '0.5' : '1',
                        cursor: !isAuthenticated ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <MessageCircle size={16} />
                      Book Now
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Booking Modal */}
        {showBookingModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-lg)',
            zIndex: 50,
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }}>
            <div className="card-elevated" style={{ maxWidth: '500px', width: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: 'var(--space-lg)' }}>Send Booking Request</h3>
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-sm)'
                }}>
                  Message to provider:
                </label>
                <textarea
                  value={bookingMessage}
                  onChange={(e) => setBookingMessage(e.target.value)}
                  placeholder="Introduce yourself and explain why you're interested in this service..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 'var(--space-lg)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
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
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
                  {bookingMessage.length}/500 characters (minimum 10)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                <button
                  onClick={() => setShowBookingModal(null)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: 'var(--space-lg)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBookingSubmit(showBookingModal)}
                  disabled={bookingMessage.trim().length < 10 || bookingLoading}
                  className="btn-primary"
                  style={{ 
                    flex: 1,
                    padding: 'var(--space-lg)',
                    opacity: (bookingMessage.trim().length < 10 || bookingLoading) ? '0.5' : '1',
                    cursor: (bookingMessage.trim().length < 10 || bookingLoading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {bookingLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <div className="card" style={{
            position: 'fixed',
            bottom: 'var(--space-lg)',
            right: 'var(--space-lg)',
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
            padding: 'var(--space-lg)',
            boxShadow: 'var(--shadow-heavy)',
            maxWidth: '300px'
          }}>
            <p style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: 'var(--space-sm)' }}>Sign in to book services</p>
            <Link href="/auth" style={{ 
              color: 'rgba(255, 255, 255, 0.8)', 
              fontSize: '0.875rem',
              textDecoration: 'underline',
              transition: 'color 0.2s ease'
            }}>
              Create an account →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}