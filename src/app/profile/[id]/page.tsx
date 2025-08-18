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
      <div className="page-layout flex-center">
        <div className="text-center">
          <div style={{ 
            width: '32px', 
            height: '32px', 
            border: '3px solid var(--border-light)', 
            borderTop: '3px solid var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto var(--space-md)'
          }}></div>
          <p className="text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-layout flex-center">
        <div className="text-center">
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: 'var(--space-lg)' }}>Profile Not Found</h1>
          <Link href="/discover" className="link-purple">
            ← Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-layout">
      {/* Header */}
      <header style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container-wide" style={{ padding: 'var(--space-lg) var(--space-lg)' }}>
          <div className="flex-between">
            <Link href="/discover" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              textDecoration: 'none',
              color: 'var(--text-secondary)',
              transition: 'color 0.2s ease'
            }}>
              <ArrowLeft size={20} style={{ marginRight: 'var(--space-sm)' }} />
              Back to Discover
            </Link>
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
          </div>
        </div>
      </header>

      <div className="container-wide" style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
        {/* Profile Header */}
        <div className="card-elevated" style={{ marginBottom: 'var(--space-2xl)' }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--space-xl)'
          }}>
            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.display_name}
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '4px solid var(--bg-primary)',
                    flexShrink: 0
                  }}
                />
              ) : (
                <div style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '4px solid var(--bg-primary)',
                  flexShrink: 0
                }}>
                  <User size={48} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div style={{ flex: 1 }}>
              <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-lg)' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: 'var(--space-md)' }}>
                    {profile.display_name}
                  </h1>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-lg)', 
                    fontSize: '0.875rem', 
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-md)'
                  }}>
                    {profile.location && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <MapPin size={16} style={{ marginRight: 'var(--space-xs)' }} />
                        {profile.location}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Calendar size={16} style={{ marginRight: 'var(--space-xs)' }} />
                      Joined {formatJoinDate(profile.created_at)}
                    </div>
                  </div>

                  {/* Rating */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          size={16}
                          style={{
                            color: i < Math.floor(profile.rating) ? '#fbbf24' : 'var(--border-medium)',
                            fill: i < Math.floor(profile.rating) ? '#fbbf24' : 'none'
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-small">
                      {profile.rating.toFixed(1)} ({profile.review_count} reviews)
                    </span>
                  </div>
                </div>

                {/* Contact Button */}
                {isAuthenticated && currentUser?.id !== userId && (
                  <div>
                    <button className="btn-primary" style={{ 
                      width: 'auto', 
                      padding: 'var(--space-md) var(--space-lg)',
                      fontSize: '0.875rem'
                    }}>
                      <MessageCircle size={16} />
                      Contact
                    </button>
                  </div>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <div style={{ marginTop: 'var(--space-xl)' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-md)' }}>About</h3>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {profile.bio.split('\n').map((line, index) => {
                      // Basic markdown rendering
                      let processedLine = line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: var(--accent-primary); text-decoration: none;" target="_blank" rel="noopener noreferrer">$1</a>')
                        .replace(/^## (.+)$/g, '<h4 style="font-size: 1.125rem; font-weight: 600; margin-top: var(--space-lg); margin-bottom: var(--space-sm);">$1</h4>')
                        .replace(/^- (.+)$/g, '<li style="margin-left: var(--space-lg);">• $1</li>');
                      
                      return (
                        <div key={index} dangerouslySetInnerHTML={{ __html: processedLine || '<br>' }} style={{ marginBottom: 'var(--space-sm)' }} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services Section */}
        <div className="card-elevated">
          <div className="flex-between" style={{ marginBottom: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Available Services</h2>
            <span className="text-small">
              {services.length} service{services.length !== 1 ? 's' : ''} available
            </span>
          </div>

          {services.length === 0 ? (
            <div className="text-center" style={{ padding: 'var(--space-3xl) 0' }}>
              <div style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
                <Calendar size={64} style={{ margin: '0 auto' }} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-md)' }}>No Services Available</h3>
              <p className="text-muted">This user hasn't created any services yet.</p>
            </div>
          ) : (
            <div className="grid-responsive">
              {services.map((service) => (
                <div key={service.id} className="card" style={{ transition: 'all 0.2s ease' }}>
                  <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                      <span style={{ fontSize: '1.5rem', marginRight: 'var(--space-md)' }}>{getSlotCategoryEmoji(service.category)}</span>
                      <div>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>{service.title}</h4>
                        <p className="text-muted" style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>{service.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-sm" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <Clock size={16} style={{ marginRight: 'var(--space-sm)' }} />
                      <span>{service.duration} minutes</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <MapPin size={16} style={{ marginRight: 'var(--space-sm)' }} />
                      <span style={{ textTransform: 'capitalize' }}>{service.location}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <Tag size={16} style={{ marginRight: 'var(--space-sm)' }} />
                      <span style={{ textTransform: 'capitalize' }}>{service.category}</span>
                    </div>
                  </div>

                  <div className="flex-between">
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--success)' }}>{formatPrice(service.price)}</span>
                    <button
                      onClick={() => handleBookService(service)}
                      className="btn-primary"
                      style={{ 
                        width: 'auto', 
                        padding: 'var(--space-md) var(--space-lg)',
                        fontSize: '0.875rem'
                      }}
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
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-lg)',
          zIndex: 50
        }}>
          <div className="card-elevated" style={{
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: 'var(--space-lg)' }}>Request Booking</h3>
            
            {/* Service Details */}
            <div className="card" style={{ backgroundColor: 'var(--bg-secondary)', marginBottom: 'var(--space-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                <span style={{ fontSize: '1.5rem' }}>{getSlotCategoryEmoji(selectedService.category)}</span>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>{selectedService.title}</h4>
                  <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>{selectedService.description}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Clock size={16} style={{ marginRight: 'var(--space-xs)' }} />
                      {selectedService.duration} min
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <MapPin size={16} style={{ marginRight: 'var(--space-xs)' }} />
                      {selectedService.location}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <DollarSign size={16} style={{ marginRight: 'var(--space-xs)' }} />
                      {formatPrice(selectedService.price)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Input */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-sm)'
              }}>
                Message to {profile?.display_name}
              </label>
              <textarea
                value={bookingMessage}
                onChange={(e) => setBookingMessage(e.target.value)}
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
                placeholder="Tell the service provider why you're interested and any specific requirements..."
                maxLength={500}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-xs)' }}>
                {bookingMessage.length}/500
              </div>
            </div>

            {/* Booking Info */}
            <div className="card" style={{ backgroundColor: 'var(--accent-light)', marginBottom: 'var(--space-xl)' }}>
              <h4 style={{ fontWeight: '600', color: 'var(--accent-primary)', marginBottom: 'var(--space-md)' }}>What happens next?</h4>
              <ul style={{ fontSize: '0.875rem', color: 'var(--accent-primary)' }} className="space-y-xs">
                <li>• Your booking request will be sent to {profile?.display_name}</li>
                <li>• They'll review your request and respond within 24 hours</li>
                <li>• Once confirmed, you'll be able to message each other directly</li>
              </ul>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <button
                onClick={() => setShowBookingModal(false)}
                disabled={isBookingLoading}
                className="btn-secondary"
                style={{ 
                  flex: 1,
                  padding: 'var(--space-lg)',
                  opacity: isBookingLoading ? '0.5' : '1'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={isBookingLoading || !bookingMessage.trim()}
                className="btn-primary"
                style={{ 
                  flex: 1,
                  padding: 'var(--space-lg)',
                  opacity: (isBookingLoading || !bookingMessage.trim()) ? '0.5' : '1',
                  cursor: (isBookingLoading || !bookingMessage.trim()) ? 'not-allowed' : 'pointer'
                }}
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