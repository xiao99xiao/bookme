import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, CheckCircle, MessageSquare, Copy, Video, Star, XCircle, X, Link } from 'lucide-react';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient, Booking } from '@/lib/api-migration';
import { usePrivy } from '@privy-io/react-auth';
import ChatModal from '@/components/ChatModal';
import { EnhancedCancelBookingModal } from '@/components/EnhancedCancelBookingModal';
import { H2, H3, Text, Loading, EmptyState, Button as DSButton, StatusBadge, OnlineBadge, DurationBadge } from '@/design-system';
import { calculatePlatformFee } from '@/lib/config';

export default function ProviderOrders() {
  const { userId, user } = useAuth();
  const { getAccessToken } = usePrivy();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [chatModal, setChatModal] = useState<{
    isOpen: boolean;
    otherUserId: string;
    otherUserName: string;
    otherUserAvatar?: string;
    isReadOnly?: boolean;
  }>({
    isOpen: false,
    otherUserId: '',
    otherUserName: '',
    otherUserAvatar: undefined,
    isReadOnly: false
  });
  const [bookingReviews, setBookingReviews] = useState<Record<string, any>>({});
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    booking: Booking | null;
  }>({
    isOpen: false,
    booking: null
  });

  useEffect(() => {
    if (userId) {
      loadBookings();
    }
  }, [userId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const bookingsData = await ApiClient.getProviderBookings(userId!);
      setBookings(bookingsData);
      
      const reviewsMap: Record<string, any> = {};
      
      bookingsData.forEach((booking) => {
        // Each booking has at most one review (customer -> provider)
        if (booking.reviews) {
          reviewsMap[booking.id] = {
            id: booking.reviews.id,
            rating: booking.reviews.rating,
            comment: booking.reviews.comment || '',
            created_at: booking.reviews.created_at,
            updated_at: booking.reviews.updated_at,
            reviewer: booking.reviews.reviewer,
            reviewee: booking.reviews.reviewee
          };
        }
      });
      
      setBookingReviews(reviewsMap);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      toast.error('Failed to load incoming orders');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    try {
      await ApiClient.updateBookingStatus(
        bookingId, 
        newStatus as 'confirmed' | 'cancelled' | 'completed',
        undefined,
        userId
      );
      toast.success(`Booking ${newStatus}`);
      loadBookings();
    } catch (error) {
      console.error('Failed to update booking:', error);
      toast.error('Failed to update booking status');
    }
  };

  const handleRejectPaidBooking = async (bookingId: string) => {
    try {
      await ApiClient.rejectPaidBooking(bookingId, 'Booking declined by provider');
      toast.success('Paid booking rejected and refund processed');
      loadBookings();
    } catch (error) {
      console.error('Failed to reject paid booking:', error);
      toast.error('Failed to reject booking');
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      setCancelModal({
        isOpen: true,
        booking
      });
    }
  };

  const handleCancelConfirm = (result: any) => {
    toast.success('Booking cancelled successfully');
    loadBookings();
    setCancelModal({
      isOpen: false,
      booking: null
    });
  };

  const handleCancelClose = () => {
    setCancelModal({
      isOpen: false,
      booking: null
    });
  };

  const handleCopyMeetingLink = (link: string) => {
    console.log('🔗 Provider Copy Link clicked:', link);
    if (!link) {
      console.error('❌ No meeting link provided');
      toast.error('No meeting link available');
      return;
    }
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied to clipboard');
  };

  const handleJoinMeeting = (link: string) => {
    console.log('🚀 Provider Join Meeting clicked:', link);
    if (!link) {
      console.error('❌ No meeting link provided');
      toast.error('No meeting link available');
      return;
    }
    window.open(link, '_blank');
  };

  const handleGenerateMeetingLink = async (bookingId: string) => {
    try {
      console.log('🔗 Generate Meeting Link clicked for booking:', bookingId);
      toast.loading('Generating meeting link...');
      
      const accessToken = await getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/meeting/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bookingId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate meeting link');
      }
      
      if (data.meetingLink) {
        toast.success('Meeting link generated successfully!');
        loadBookings(); // Refresh to show the new meeting link
      } else {
        toast.error('Failed to generate meeting link - no link returned');
      }
    } catch (error) {
      console.error('Failed to generate meeting link:', error);
      
      // Show user-friendly error messages
      let errorMessage = error.message || 'Failed to generate meeting link';
      if (errorMessage.includes('Google') || errorMessage.includes('authentication') || errorMessage.includes('authorization')) {
        toast.error(errorMessage + ' Go to Integrations to reconnect.', {
          duration: 6000,
          action: {
            label: 'Go to Integrations',
            onClick: () => window.location.href = '/provider/integrations'
          }
        });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const getMeetingIcon = (platform?: string) => {
    switch (platform) {
      case 'google_meet':
        return <GoogleMeetIcon className="w-5 h-5" />;
      case 'zoom':
        return <ZoomIcon className="w-5 h-5" />;
      case 'teams':
        return <TeamsIcon className="w-5 h-5" />;
      default:
        return <Video className="w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 font-body">
            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
            Pending
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 font-body">
            <CheckCircle className="w-3.5 h-3.5 text-green-600 fill-green-600" />
            Paid
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 font-body">
            <CheckCircle className="w-3.5 h-3.5 text-green-600 fill-green-600" />
            Confirmed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 font-body">
            <CheckCircle className="w-3.5 h-3.5 text-green-600 fill-green-600" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 font-body">
            <XCircle className="w-3.5 h-3.5 text-[#F1343D]" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const handleGoogleCalendar = (booking: Booking) => {
    const startDate = new Date(booking.scheduled_at);
    const endDate = new Date(startDate.getTime() + booking.duration_minutes * 60000);
    
    const formatDateForGoogle = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${booking.service?.title || 'Service'} with ${booking.customer?.display_name || 'Customer'}`,
      dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
      details: `Booking for ${booking.service?.title}${booking.customer_notes ? `\n\nCustomer notes: ${booking.customer_notes}` : ''}`,
      location: booking.is_online ? 'Online Meeting' : (booking.location || ''),
    });

    const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
    window.open(url, '_blank');
  };

  const handleICSDownload = (booking: Booking) => {
    const startDate = new Date(booking.scheduled_at);
    const endDate = new Date(startDate.getTime() + booking.duration_minutes * 60000);
    
    const formatDateForICS = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
    };

    const title = `${booking.service?.title || 'Service'} with ${booking.customer?.display_name || 'Customer'}`;
    const description = `Booking for ${booking.service?.title}${booking.customer_notes ? `\n\nCustomer notes: ${booking.customer_notes}` : ''}`;
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BookMe//Booking Calendar//EN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@bookme.com`,
      `DTSTAMP:${formatDateForICS(new Date())}`,
      `DTSTART:${formatDateForICS(startDate)}`,
      `DTEND:${formatDateForICS(endDate)}`,
      `SUMMARY:${title}`,
      description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
      `LOCATION:${booking.is_online ? 'Online Meeting' : (booking.location || '')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success('Calendar event downloaded');
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return booking.status === 'pending' || booking.status === 'paid';
    return booking.status === activeTab;
  });

  const tabLabels = {
    all: 'All',
    pending: 'Pending', 
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Desktop Layout */}
        <div className="hidden lg:flex gap-8">
          {/* Left Sidebar - Desktop Only */}
          <div className="w-64 flex-shrink-0">
            <div className="mb-6">
              {/* Title - Spectral font */}
              <H2 className="mb-2">Orders</H2>
              {/* Subtitle - Baloo 2 font */}
              <p className="text-sm text-gray-500 font-body">Manage orders from your customers</p>
            </div>
            
            {/* Vertical Navigation - Baloo 2 font */}
            <nav className="space-y-1">
              {Object.entries(tabLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded-md transition-colors font-body ${
                    activeTab === key 
                      ? 'bg-gray-100 text-black' 
                      : 'text-gray-600 hover:text-black hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content Area - Desktop */}
          <div className="flex-1 flex flex-col min-h-[600px]">
            {loading ? (
              <Loading variant="spinner" size="md" text="Loading orders..." fullHeight={true} />
            ) : filteredBookings.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-full h-full" />}
                title={`No ${activeTab === 'all' ? '' : activeTab} orders`}
                description="Your incoming orders will appear here"
                size="md"
                fullHeight={true}
              />
            ) : (
              <div className="space-y-4">
                {/* Each booking is a separate CARD */}
                {filteredBookings.map((booking) => {
                  const review = bookingReviews[booking.id];
                  const fee = booking.service_fee || calculatePlatformFee(booking.total_price);
                  const earnings = booking.total_price - fee;
                  
                  return (
                    <div key={booking.id} className="bg-white rounded-2xl border border-[#eeeeee] p-6">
                      {/* Top Section: Title and Icons */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          {/* Service Title */}
                          <H3 className="mb-1">
                            {booking.service?.title || 'Online Teaching'}
                          </H3>
                          {/* Booked date */}
                          <p className="text-xs text-[#aaaaaa] font-body">
                            Booked {format(new Date(booking.created_at), 'MMM d,yyyy')}
                          </p>
                        </div>
                        
                        {/* Top Right Icons */}
                        <div className="flex items-center gap-2">
                          {(booking.status === 'confirmed' || booking.status === 'in_progress') ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <DSButton 
                                  variant="outline"
                                  size="small"
                                  iconPosition="only"
                                  asChild
                                >
                                  <button>
                                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M10 9.58325V12.0833" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                </DSButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleGoogleCalendar(booking)}>
                                  <svg
                                    className="w-4 h-4 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
                                      fill="#4285F4"
                                    />
                                    <path d="M8 9H16V11H8V9Z" fill="white" />
                                    <path d="M8 13H13V15H8V13Z" fill="white" />
                                  </svg>
                                  Google Calendar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleICSDownload(booking)}>
                                  <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                                  Download .ics file
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <DSButton 
                              variant="outline"
                              size="small"
                              iconPosition="only"
                              disabled={true}
                              icon={<Calendar className="w-5 h-5" />}
                            />
                          )}
                          <DSButton 
                            variant="outline"
                            size="small"
                            iconPosition="only"
                            icon={<MessageSquare className="w-5 h-5" />}
                            onClick={() => setChatModal({
                              isOpen: true,
                              otherUserId: booking.customer_id,
                              otherUserName: booking.customer?.display_name || 'Customer',
                              otherUserAvatar: booking.customer?.avatar,
                              isReadOnly: booking.status === 'cancelled'
                            })}
                          />
                        </div>
                      </div>

                      {/* Customer Name and Date */}
                      <div className="flex items-center gap-2 text-sm font-medium font-body mb-4">
                        <span className="text-black">{booking.customer?.display_name || 'Xiao xiao'}</span>
                        <span className="text-[#cccccc]">|</span>
                        <span className="text-black">{format(new Date(booking.scheduled_at), 'EEE, MMM d, yyyy')}</span>
                      </div>

                      {/* Status Pills and Price Row */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          {/* Status Badge */}
                          <StatusBadge status={booking.status as any} />
                          
                          {/* Online Badge */}
                          {booking.is_online && <OnlineBadge isOnline={booking.is_online} />}
                          
                          {/* Duration Badge */}
                          <DurationBadge minutes={booking.duration_minutes} />
                        </div>

                        {/* Total Price & Earnings */}
                        <div className="flex flex-col items-end">
                          <div className="text-sm text-[#666666] font-body">
                            Total: ${booking.total_price}
                          </div>
                          <div className="text-lg font-bold text-black font-body">
                            You earn: ${earnings.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Section: Timer and Actions - only for confirmed, in_progress, pending and paid bookings */}
                      {(booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'pending' || booking.status === 'paid') && (
                        <>
                          {/* Divider Line */}
                          <div className="border-t border-[#eeeeee] my-6"></div>

                          <div className="flex items-center justify-between">
                            {/* Cancel Button or Status Text */}
                            <div className="text-sm font-medium text-black font-body">
                              {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                                <DSButton
                                  variant="link"
                                  size="small"
                                  onClick={() => handleCancelBooking(booking.id)}
                                  icon={<X className="w-5 h-5" />}
                                >
                                  Cancel
                                </DSButton>
                              )}
                              {(booking.status === 'pending' || booking.status === 'paid') && 'New order'}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                              {(booking.status === 'confirmed' || booking.status === 'in_progress') && booking.is_online && booking.meeting_link && (
                                <>
                                  <DSButton
                                    variant="outline"
                                    size="small"
                                    onClick={() => handleCopyMeetingLink(booking.meeting_link)}
                                    icon={<Copy className="w-5 h-5" />}
                                  >
                                    Copy
                                  </DSButton>
                                  <DSButton
                                    variant="primary"
                                    size="small"
                                    onClick={() => handleJoinMeeting(booking.meeting_link)}
                                    icon={getMeetingIcon(booking.meeting_platform)}
                                  >
                                    Join
                                  </DSButton>
                                </>
                              )}
                              
                              {(booking.status === 'confirmed' || booking.status === 'in_progress') && booking.is_online && !booking.meeting_link && (
                                <DSButton
                                  variant="primary"
                                  size="small"
                                  onClick={() => handleGenerateMeetingLink(booking.id)}
                                  icon={<Link className="w-5 h-5" />}
                                >
                                  Generate Meeting Link
                                </DSButton>
                              )}

                              {(booking.status === 'pending' || booking.status === 'paid') && (
                                <>
                                  <DSButton
                                    variant="outline"
                                    size="small"
                                    onClick={() => {
                                      if (booking.status === 'paid') {
                                        handleRejectPaidBooking(booking.id);
                                      } else {
                                        handleUpdateStatus(booking.id, 'cancelled');
                                      }
                                    }}
                                  >
                                    Decline
                                  </DSButton>
                                  <DSButton
                                    variant="primary"
                                    size="small"
                                    onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                                  >
                                    Accept
                                  </DSButton>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Customer Review Section for Completed */}
                      {booking.status === 'completed' && (
                        <>
                          {/* Divider Line */}
                          <div className="border-t border-[#eeeeee] mt-6 mb-4"></div>
                          
                          <div>
                            {review ? (
                              <>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-medium text-black font-body">Customer Review</p>
                                  <div className="bg-[#fcf9f4] px-2 py-[5px] rounded-xl flex items-center gap-1 h-8">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-5 h-5 ${
                                          i < review.rating
                                            ? 'text-[#FFD43C] fill-[#FFD43C]'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                    <span className="text-sm font-medium text-black font-body ml-1">
                                      {review.rating}/5
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-[#666666] font-body italic">
                                  "{review.comment || 'No written review provided.'}"
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-black font-body mb-2">Customer Review</p>
                                <p className="text-sm text-[#999999] font-body italic">
                                  The customer has not provided a review yet. Once they leave a review, it will be displayed here.
                                </p>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden pb-20">
          {/* Top Header with Title and Tabs */}
          <div className="mb-6">
            {/* Title Section */}
            <div className="mb-4">
              <H2 className="mb-1">Orders</H2>
              <p className="text-sm text-gray-500 font-body">Manage orders from your customers</p>
            </div>
            
            {/* Horizontal Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
              {Object.entries(tabLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body ${
                    activeTab === key 
                      ? 'bg-white text-black shadow-sm' 
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Content Area */}
          <div className="flex flex-col min-h-[500px]">
            {loading ? (
              <Loading variant="spinner" size="md" text="Loading orders..." fullHeight={true} />
            ) : filteredBookings.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-full h-full" />}
                title={`No ${activeTab === 'all' ? '' : activeTab} orders`}
                description="Your incoming orders will appear here"
                size="md"
                fullHeight={true}
              />
            ) : (
              <div className="space-y-4">
                {/* Mobile Order Cards - Same content as desktop */}
                {filteredBookings.map((booking) => {
                  const review = bookingReviews[booking.id];
                  const fee = booking.service_fee || calculatePlatformFee(booking.total_price);
                  const earnings = booking.total_price - fee;
                  
                  return (
                    <div key={booking.id} className="bg-white rounded-2xl border border-[#eeeeee] p-4 sm:p-6">
                      {/* Top Section: Title and Icons */}
                      <div className="flex items-start justify-between mb-4 sm:mb-6">
                        <div className="flex-1 min-w-0">
                          {/* Service Title */}
                          <H3 className="mb-1 truncate">
                            {booking.service?.title || 'Online Teaching'}
                          </H3>
                          {/* Booked date */}
                          <p className="text-xs text-[#aaaaaa] font-body">
                            Booked {format(new Date(booking.created_at), 'MMM d,yyyy')}
                          </p>
                        </div>
                        
                        {/* Top Right Icons - Smaller on mobile */}
                        <div className="flex items-center gap-2 ml-2">
                          {(booking.status === 'confirmed' || booking.status === 'in_progress') ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <DSButton 
                                  variant="outline"
                                  size="small"
                                  iconPosition="only"
                                  asChild
                                >
                                  <button>
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M10 9.58325V12.0833" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                </DSButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleGoogleCalendar(booking)}>
                                  <svg
                                    className="w-4 h-4 mr-2"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
                                      fill="#4285F4"
                                    />
                                    <path d="M8 9H16V11H8V9Z" fill="white" />
                                    <path d="M8 13H13V15H8V13Z" fill="white" />
                                  </svg>
                                  Google Calendar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleICSDownload(booking)}>
                                  <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                                  Download .ics file
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <DSButton 
                              variant="outline"
                              size="small"
                              iconPosition="only"
                              disabled={true}
                              icon={<Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
                            />
                          )}
                          <DSButton 
                            variant="outline"
                            size="small"
                            iconPosition="only"
                            icon={<MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />}
                            onClick={() => setChatModal({
                              isOpen: true,
                              otherUserId: booking.customer_id,
                              otherUserName: booking.customer?.display_name || 'Customer',
                              otherUserAvatar: booking.customer?.avatar,
                              isReadOnly: booking.status === 'cancelled'
                            })}
                          />
                        </div>
                      </div>

                      {/* Customer Name and Date - Responsive text */}
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium font-body mb-4">
                        <span className="text-black">{booking.customer?.display_name || 'Xiao xiao'}</span>
                        <span className="text-[#cccccc]">|</span>
                        <span className="text-black">{format(new Date(booking.scheduled_at), 'EEE, MMM d, yyyy')}</span>
                      </div>

                      {/* Status Pills and Price Row - Responsive layout */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status Badge */}
                          <StatusBadge status={booking.status as any} />
                          
                          {/* Online Badge */}
                          {booking.is_online && (
                            <div className="bg-[#f3f3f3] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="none">
                                <rect x="3" y="5" width="14" height="10" rx="1" stroke="#666666" strokeWidth="1.5"/>
                                <line x1="7" y1="18" x2="13" y2="18" stroke="#666666" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              <span className="text-sm text-[#666666] font-body">Online</span>
                            </div>
                          )}
                          
                          {/* Duration Badge */}
                          <div className="bg-[#f3f3f3] px-1.5 py-1 rounded-lg flex items-center gap-1">
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#666666]" />
                            <span className="text-sm text-[#666666] font-body">{booking.duration_minutes} min</span>
                          </div>
                        </div>

                        {/* Total Price & Earnings */}
                        <div className="flex flex-col items-end">
                          <div className="text-xs sm:text-sm text-[#666666] font-body">
                            Total: ${booking.total_price}
                          </div>
                          <div className="text-base sm:text-lg font-bold text-black font-body">
                            You earn: ${earnings.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Section: Timer and Actions - only for confirmed, in_progress, pending and paid bookings */}
                      {(booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'pending' || booking.status === 'paid') && (
                        <>
                          {/* Divider Line */}
                          <div className="border-t border-[#eeeeee] my-6"></div>

                          <div className="flex items-center justify-between">
                            {/* Cancel Button or Status Text */}
                            <div className="text-sm font-medium text-black font-body">
                              {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                                <DSButton
                                  variant="link"
                                  size="small"
                                  onClick={() => handleCancelBooking(booking.id)}
                                  icon={<X className="w-5 h-5" />}
                                >
                                  Cancel
                                </DSButton>
                              )}
                              {(booking.status === 'pending' || booking.status === 'paid') && 'New order'}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 flex-wrap justify-end">
                              {(booking.status === 'confirmed' || booking.status === 'in_progress') && booking.is_online && booking.meeting_link && (
                                <>
                                  <DSButton
                                    variant="outline"
                                    size="small"
                                    onClick={() => handleCopyMeetingLink(booking.meeting_link)}
                                    icon={<Copy className="w-5 h-5" />}
                                  >
                                    Copy
                                  </DSButton>
                                  <DSButton
                                    variant="primary"
                                    size="small"
                                    onClick={() => handleJoinMeeting(booking.meeting_link)}
                                    icon={getMeetingIcon(booking.meeting_platform)}
                                  >
                                    Join
                                  </DSButton>
                                </>
                              )}
                              
                              {(booking.status === 'confirmed' || booking.status === 'in_progress') && booking.is_online && !booking.meeting_link && (
                                <DSButton
                                  variant="primary"
                                  size="small"
                                  onClick={() => handleGenerateMeetingLink(booking.id)}
                                  icon={<Link className="w-5 h-5" />}
                                >
                                  Generate Meeting Link
                                </DSButton>
                              )}

                              {(booking.status === 'pending' || booking.status === 'paid') && (
                                <>
                                  <DSButton
                                    variant="outline"
                                    size="small"
                                    onClick={() => {
                                      if (booking.status === 'paid') {
                                        handleRejectPaidBooking(booking.id);
                                      } else {
                                        handleUpdateStatus(booking.id, 'cancelled');
                                      }
                                    }}
                                  >
                                    Decline
                                  </DSButton>
                                  <DSButton
                                    variant="primary"
                                    size="small"
                                    onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                                  >
                                    Accept
                                  </DSButton>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Customer Review Section for Completed */}
                      {booking.status === 'completed' && (
                        <>
                          {/* Divider Line */}
                          <div className="border-t border-[#eeeeee] mt-6 mb-4"></div>
                          
                          <div>
                            {review ? (
                              <>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-medium text-black font-body">Customer Review</p>
                                  <div className="bg-[#fcf9f4] px-2 py-[5px] rounded-xl flex items-center gap-1 h-8">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-5 h-5 ${
                                          i < review.rating
                                            ? 'text-[#FFD43C] fill-[#FFD43C]'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                    <span className="text-sm font-medium text-black font-body ml-1">
                                      {review.rating}/5
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-[#666666] font-body italic">
                                  "{review.comment || 'No written review provided.'}"
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-black font-body mb-2">Customer Review</p>
                                <p className="text-sm text-[#999999] font-body italic">
                                  The customer has not provided a review yet. Once they leave a review, it will be displayed here.
                                </p>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Cancel Modal */}
      <EnhancedCancelBookingModal
        booking={cancelModal.booking}
        isOpen={cancelModal.isOpen}
        onClose={handleCancelClose}
        onConfirm={handleCancelConfirm}
      />

      {/* Chat Modal */}
      <ChatModal
        isOpen={chatModal.isOpen}
        onClose={() => setChatModal({
          isOpen: false,
          otherUserId: '',
          otherUserName: '',
          otherUserAvatar: undefined,
          isReadOnly: false
        })}
        otherUserId={chatModal.otherUserId}
        otherUserName={chatModal.otherUserName}
        otherUserAvatar={chatModal.otherUserAvatar}
        isReadOnly={chatModal.isReadOnly}
      />
    </div>
  );
}