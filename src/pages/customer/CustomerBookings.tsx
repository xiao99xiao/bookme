import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { Calendar, Clock, MapPin, User, DollarSign, CheckCircle, XCircle, AlertCircle, MessageSquare, Star, Copy, Video, CreditCard } from 'lucide-react';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { usePrivy } from '@privy-io/react-auth';
import { ApiClient, Booking } from '@/lib/api-migration';
import ChatModal from '@/components/ChatModal';
import ReviewDialog from '@/components/ReviewDialog';
import { H2, H3, Text, Description, Label, Button as DSButton, BookingEmptyState, Loading, StatusBadge, OnlineBadge, DurationBadge } from '@/design-system';
import { useBlockchainService } from '@/lib/blockchain-service';
import { usePaymentTransaction } from '@/hooks/useTransaction';
import { PaymentModal } from '@/components/TransactionModal';
import { BlockchainErrorHandler } from '@/lib/blockchain-errors';

export default function CustomerBookings() {
  const { userId, user } = useAuth();
  const { getAccessToken } = usePrivy();
  const navigate = useNavigate();
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
  const [reviewDialog, setReviewDialog] = useState<{
    isOpen: boolean;
    booking: Booking | null;
    existingReview: { rating: number; comment: string } | null;
  }>({
    isOpen: false,
    booking: null,
    existingReview: null
  });
  const [bookingReviews, setBookingReviews] = useState<Record<string, { rating: number; comment: string }>>({});

  // Blockchain integration
  const { blockchainService, initializeService, isWalletConnected } = useBlockchainService();
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const paymentTransaction = usePaymentTransaction({
    onSuccess: (txHash) => {
      toast.success('Payment successful! Booking confirmed.');
      setPayingBookingId(null);
      loadBookings(); // Refresh bookings to show updated status
    },
    onError: (error) => {
      toast.error(`Payment failed: ${error}`);
      setPayingBookingId(null);
    }
  });
  
  // Completion transaction - separate from payment
  const completionTransaction = usePaymentTransaction({
    onSuccess: (txHash) => {
      toast.success('Service completed successfully! Funds have been distributed.');
      setPayingBookingId(null);
      setShowPaymentModal(false);
      
      // Show review dialog after successful completion
      const booking = bookings.find(b => b.id === payingBookingId);
      if (booking) {
        setReviewDialog({
          isOpen: true,
          booking,
          existingReview: null
        });
      }
      
      loadBookings(); // Refresh bookings to show updated status
    },
    onError: (error) => {
      toast.error(`Service completion failed: ${error}`);
      setPayingBookingId(null);
      setShowPaymentModal(false);
    }
  });
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    if (userId) {
      loadBookings();
    }
  }, [userId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const bookingsData = await ApiClient.getMyBookings(userId!);
      setBookings(bookingsData);
      
      const reviewsMap: Record<string, { rating: number; comment: string }> = {};
      
      bookingsData.forEach((booking) => {
        // Handle both array and single object format
        if (booking.reviews) {
          const review = Array.isArray(booking.reviews) ? booking.reviews[0] : booking.reviews;
          if (review) {
            reviewsMap[booking.id] = {
              rating: review.rating,
              comment: review.comment || ''
            };
          }
        }
      });
      
      setBookingReviews(reviewsMap);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await ApiClient.updateBookingStatus(
        bookingId, 
        'cancelled',
        undefined,
        userId
      );
      toast.success('Booking cancelled successfully');
      loadBookings();
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      toast.error('Failed to cancel booking');
    }
  };

  const handleCompleteBooking = async (bookingId: string) => {
    if (!user || !isWalletConnected) {
      toast.error('Please connect your wallet to complete service');
      return;
    }

    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      toast.error('Booking not found');
      return;
    }

    try {
      console.log('🎉 Starting service completion for booking:', bookingId);

      // Step 1: Validate with backend that completion is allowed
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings/${bookingId}/complete-service`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to validate service completion');
      }

      const completionData = await response.json();
      console.log('✅ Backend validation successful:', completionData);
      
      // Check if booking has blockchain booking ID (from the response)
      const blockchainBookingId = completionData.booking?.blockchain_booking_id;
      if (!blockchainBookingId) {
        toast.error('This booking was not paid via blockchain and cannot be completed this way');
        return;
      }

      // Step 2: Initialize blockchain service
      await initializeService();

      // Step 3: Show payment modal and execute blockchain completion
      setPayingBookingId(bookingId); // Set the booking being completed
      setShowPaymentModal(true);
      
      await completionTransaction.executePayment(async (onStatusChange) => {
        return await blockchainService.completeService(
          bookingId,
          blockchainBookingId, // Pass the blockchain booking ID
          onStatusChange
        );
      });

    } catch (error: any) {
      console.error('❌ Service completion failed:', error);
      BlockchainErrorHandler.logError(error, 'Service Completion');
      
      const errorMessage = BlockchainErrorHandler.getErrorMessage(error);
      toast.error(errorMessage);
      setPayingBookingId(null);
      setShowPaymentModal(false);
    }
  };

  const handlePayNow = async (bookingId: string) => {
    if (!user || !isWalletConnected) {
      toast.error('Please connect your wallet to continue');
      return;
    }

    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
      toast.error('Booking not found');
      return;
    }

    setPayingBookingId(bookingId);
    
    try {
      // Step 1: Get payment authorization from backend
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings/${bookingId}/authorize-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get payment authorization');
      }

      const { authorization, signature } = await response.json();
      console.log('Got payment authorization for booking:', bookingId);

      // Step 2: Initialize blockchain service
      await initializeService();

      // Step 3: Show payment modal and execute blockchain payment
      setShowPaymentModal(true);
      
      await paymentTransaction.executePayment(async (onStatusChange) => {
        return await blockchainService.payForBooking(
          authorization,
          signature,
          onStatusChange
        );
      });

    } catch (error) {
      console.error('Payment error:', error);
      BlockchainErrorHandler.logError(error, 'Booking Payment');
      
      const errorMessage = BlockchainErrorHandler.getErrorMessage(error);
      toast.error(errorMessage);
      
      setPayingBookingId(null);
      setShowPaymentModal(false);
    }
  };

  const getMeetingIcon = (platform?: string) => {
    switch (platform) {
      case 'google_meet':
        return <GoogleMeetIcon className="w-4 h-4" />;
      case 'zoom':
        return <ZoomIcon className="w-4 h-4" />;
      case 'teams':
        return <TeamsIcon className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!reviewDialog.booking || !userId) return;
    
    try {
      await ApiClient.submitReview(
        reviewDialog.booking.id,
        rating,
        comment,
        userId
      );
      
      setBookingReviews(prev => ({
        ...prev,
        [reviewDialog.booking!.id]: { rating, comment }
      }));
      
      setReviewDialog({
        isOpen: false,
        booking: null,
        existingReview: null
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
      throw error;
    }
  };

  const handleCopyMeetingLink = (link: string) => {
    console.log('🔗 Copy Link clicked:', link);
    if (!link) {
      console.error('❌ No meeting link provided');
      toast.error('No meeting link available');
      return;
    }
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied to clipboard');
  };

  const handleJoinMeeting = (link: string) => {
    console.log('🚀 Join Meeting clicked:', link);
    if (!link) {
      console.error('❌ No meeting link provided');
      toast.error('No meeting link available');
      return;
    }
    window.open(link, '_blank');
  };

  const handleGoogleCalendar = (booking: Booking) => {
    const startDate = new Date(booking.scheduled_at);
    const endDate = new Date(startDate.getTime() + booking.duration_minutes * 60000);
    
    const formatDateForGoogle = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${booking.service?.title || 'Service'} with ${booking.provider?.display_name || 'Provider'}`,
      dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
      details: `Booking for ${booking.service?.title}${booking.customer_notes ? `\n\nNotes: ${booking.customer_notes}` : ''}`,
      location: booking.is_online ? 'Online Meeting' : (booking.location || ''),
    });

    const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
    window.open(url, '_blank');
  };

  const handleICSDownload = (booking: Booking) => {
    const startDate = new Date(booking.scheduled_at);
    const endDate = new Date(startDate.getTime() + booking.duration_minutes * 60000);
    
    const formatDateForICS = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const title = `${booking.service?.title || 'Service'} with ${booking.provider?.display_name || 'Provider'}`;
    const description = `Booking for ${booking.service?.title}${booking.customer_notes ? `\n\nNotes: ${booking.customer_notes}` : ''}`;
    
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleViewProviderProfile = async (providerId: string) => {
    const { navigateToUserProfile } = await import('@/lib/username');
    const success = await navigateToUserProfile(providerId, navigate);
    if (!success) {
      toast.error('This provider does not have a public profile');
    }
  };

  const canEditReview = (booking: Booking): boolean => {
    const now = new Date();
    const bookingEndTime = new Date(booking.scheduled_at);
    bookingEndTime.setMinutes(bookingEndTime.getMinutes() + booking.duration_minutes);
    
    const sevenDaysAfterBooking = new Date(bookingEndTime);
    sevenDaysAfterBooking.setDate(sevenDaysAfterBooking.getDate() + 7);
    
    return now <= sevenDaysAfterBooking;
  };

  const filteredBookings = bookings.filter(booking => {
    const bookingDateTime = new Date(booking.scheduled_at);
    const now = new Date();
    
    switch (activeTab) {
      case 'upcoming':
        return bookingDateTime > now && booking.status !== 'cancelled' && booking.status !== 'rejected' && booking.status !== 'completed';
      case 'past':
        return bookingDateTime <= now || booking.status === 'completed';
      case 'cancelled':
        return booking.status === 'cancelled' || booking.status === 'rejected';
      case 'paid':
        return booking.status === 'paid';
      case 'all':
      default:
        return true;
    }
  });

  const tabLabels = {
    all: 'All',
    upcoming: 'Upcoming',
    paid: 'Paid',
    past: 'Past',
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
              <H2 className="mb-2">My Bookings</H2>
              {/* Subtitle - Baloo 2 font */}
              <Text variant="small" color="secondary">Services you have booked from providers</Text>
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
              <Loading variant="spinner" size="md" text="Loading bookings..." fullHeight={true} />
            ) : filteredBookings.length === 0 ? (
              <BookingEmptyState
                type={activeTab as "upcoming" | "past" | "cancelled" | "all"}
                onBrowseServices={() => navigate('/discover')}
                fullHeight={true}
              />
            ) : (
              <div className="space-y-4">
                {/* Each booking is a separate CARD */}
                {filteredBookings.map((booking) => {
                  // Handle both array and single object format for reviews
                  const reviewFromBooking = booking.reviews ? 
                    (Array.isArray(booking.reviews) ? booking.reviews[0] : booking.reviews) : 
                    null;
                  const review = reviewFromBooking || bookingReviews[booking.id];
                  const bookingStartTime = new Date(booking.scheduled_at);
                  const hasStarted = isPast(bookingStartTime);
                  
                  return (
                    <div key={booking.id} className="bg-white rounded-2xl border border-[#eeeeee] p-6">
                      {/* Top Section: Title and Icons */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          {/* Service Title */}
                          <H3 className="mb-1">
                            {booking.service?.title || 'Service'}
                          </H3>
                          {/* Booked date */}
                          <Description>
                            Booked {format(new Date(booking.created_at), 'MMM d, yyyy')}
                          </Description>
                        </div>
                        
                        {/* Top Right Icons */}
                        <div className="flex items-center gap-2">
                          {booking.status === 'confirmed' ? (
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
                                      <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
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
                                      d="M19.5 3.5L18 2L17 3.5L16 2L15 3.5L14 2L13 3.5L12 2L11 3.5L10 2L9 3.5L8 2L7 3.5L6 2L5 3.5L4.5 2V22L6 20.5L7 22L8 20.5L9 22L10 20.5L11 22L12 20.5L13 22L14 20.5L15 22L16 20.5L17 22L18 20.5L19.5 22V2L19.5 3.5Z"
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
                              icon={
                                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              }
                            />
                          )}
                          <DSButton 
                            variant="outline"
                            size="small"
                            iconPosition="only"
                            icon={<MessageSquare className="w-5 h-5" />}
                            onClick={() => setChatModal({
                              isOpen: true,
                              otherUserId: booking.provider_id,
                              otherUserName: booking.provider?.display_name || 'Provider',
                              otherUserAvatar: booking.provider?.avatar,
                              isReadOnly: booking.status === 'cancelled'
                            })}
                          />
                        </div>
                      </div>

                      {/* Provider Name and Date */}
                      <div className="flex items-center gap-2 text-sm font-medium font-body mb-4">
                        <button 
                          onClick={() => handleViewProviderProfile(booking.provider_id)}
                          className="text-black hover:text-blue-600 hover:underline"
                        >
                          {booking.provider?.display_name || 'Provider'}
                        </button>
                        <span className="text-[#cccccc]">|</span>
                        <span className="text-black">{format(new Date(booking.scheduled_at), 'EEE, MMM d, yyyy')}</span>
                        <span className="text-[#cccccc]">|</span>
                        <span className="text-black">{format(new Date(booking.scheduled_at), 'h:mm a')}</span>
                      </div>

                      {/* Status Pills and Price Row */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {/* Status Badge */}
                            <StatusBadge status={booking.status as any} />
                            
                            {/* Online Badge */}
                            {booking.is_online && <OnlineBadge isOnline={booking.is_online} />}
                            
                            {/* Duration Badge */}
                            <DurationBadge minutes={booking.duration_minutes} />
                          </div>
                          
                          {/* Auto-completion explanation for in_progress bookings */}
                          {booking.status === 'in_progress' && (
                            <Text variant="small" color="tertiary" className="mt-1">
                              Will auto-complete {(() => {
                                const endTime = new Date(new Date(booking.scheduled_at).getTime() + (booking.duration_minutes * 60 * 1000));
                                const autoCompleteTime = new Date(endTime.getTime() + (30 * 60 * 1000));
                                return format(autoCompleteTime, 'MMM d \'at\' h:mm a');
                              })()}
                            </Text>
                          )}
                        </div>

                        {/* Total Price */}
                        <div className="text-lg font-bold text-black font-body">
                          Total: {booking.status === 'pending_payment' ? `${booking.total_price} USDC` : `$${booking.total_price}`}
                        </div>
                      </div>

                      {/* Customer Notes Section if present */}
                      {booking.customer_notes && (
                        <>
                          <div className="border-t border-[#eeeeee] my-4"></div>
                          <div className="mb-4">
                            <Text variant="small" className="text-[#666666]">
                              <span className="font-medium text-black">Your notes:</span> {booking.customer_notes}
                            </Text>
                          </div>
                        </>
                      )}

                      {/* Action Section - only for bookings that have actions */}
                      {(booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'pending' || booking.status === 'pending_payment' || booking.status === 'paid' || booking.status === 'rejected') && (
                        <>
                          <div className="border-t border-[#eeeeee] my-6"></div>
                          
                          {/* Bottom Section: Actions */}
                          <div className="flex items-center justify-between">
                            {/* Left Status Text */}
                            <div className="text-sm font-medium text-black font-body">
                              {booking.status === 'confirmed' && 'Upcoming'}
                              {booking.status === 'in_progress' && 'In Progress'}
                              {booking.status === 'pending' && 'Awaiting Confirmation'}
                              {booking.status === 'pending_payment' && 'Payment Required'}
                              {booking.status === 'paid' && 'Pending Provider\'s Confirmation'}
                              {booking.status === 'rejected' && 'Rejected by Provider'}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                          {booking.status === 'confirmed' && booking.is_online && booking.meeting_link && (
                            <>
                              <DSButton
                                variant="outline"
                                size="small"
                                onClick={() => {
                                  console.log('🔗 Copy button clicked (confirmed):', booking.id, 'meeting_link:', booking.meeting_link);
                                  handleCopyMeetingLink(booking.meeting_link!);
                                }}
                                icon={<Copy className="w-5 h-5" />}
                              >
                                Copy Link
                              </DSButton>
                              <DSButton
                                variant="primary"
                                size="small"
                                onClick={() => {
                                  console.log('🚀 Join button clicked (confirmed):', booking.id, 'meeting_link:', booking.meeting_link);
                                  handleJoinMeeting(booking.meeting_link!);
                                }}
                                icon={getMeetingIcon(booking.meeting_platform)}
                              >
                                Join
                              </DSButton>
                            </>
                          )}


                          {booking.status === 'in_progress' && (
                            <>
                              <DSButton
                                variant="success"
                                size="small"
                                onClick={() => handleCompleteBooking(booking.id)}
                                icon={<CheckCircle className="w-5 h-5" />}
                              >
                                Mark Complete
                              </DSButton>
                              {booking.is_online && booking.meeting_link && (
                                <>
                                  <DSButton
                                    variant="outline"
                                    size="small"
                                    onClick={() => {
                                      console.log('🔗 Copy button clicked (in_progress):', booking.id, 'meeting_link:', booking.meeting_link);
                                      handleCopyMeetingLink(booking.meeting_link!);
                                    }}
                                    icon={<Copy className="w-5 h-5" />}
                                  >
                                    Copy Link
                                  </DSButton>
                                  <DSButton
                                    variant="primary"
                                    size="small"
                                    onClick={() => {
                                      console.log('🚀 Join button clicked (in_progress):', booking.id, 'meeting_link:', booking.meeting_link);
                                      handleJoinMeeting(booking.meeting_link!);
                                    }}
                                    icon={getMeetingIcon(booking.meeting_platform)}
                                  >
                                    Join
                                  </DSButton>
                                </>
                              )}
                            </>
                          )}

                          {booking.status === 'pending' && (
                            <DSButton
                              variant="danger"
                              size="small"
                              onClick={() => handleCancelBooking(booking.id)}
                            >
                              Cancel Request
                            </DSButton>
                          )}

                          {booking.status === 'pending_payment' && (
                            <>
                              <DSButton
                                variant="danger"
                                size="small"
                                onClick={() => handleCancelBooking(booking.id)}
                                disabled={payingBookingId === booking.id}
                              >
                                Cancel
                              </DSButton>
                              <DSButton
                                variant="primary"
                                size="small"
                                onClick={() => handlePayNow(booking.id)}
                                disabled={!isWalletConnected || payingBookingId === booking.id}
                                icon={<CreditCard className="w-5 h-5" />}
                              >
                                {payingBookingId === booking.id ? 'Processing...' : `Pay ${booking.total_price} USDC`}
                              </DSButton>
                            </>
                          )}

                            </div>
                          </div>
                        </>
                      )}

                      {/* Review Section for Completed */}
                      {booking.status === 'completed' && (
                        <>
                          {/* Separator Line */}
                          <div className="border-t border-[#eeeeee] my-6"></div>
                          
                          {/* Review Content */}
                          <div className="flex items-start justify-between gap-4">
                            {/* Review Text */}
                            <div className="flex-1">
                              <Text variant="small" weight="medium" className="text-black mb-0.5">
                                {review ? 'Your Review' : 'Leave a Review'}
                              </Text>
                              {review ? (
                                <Text variant="small" className="text-[#666666]">
                                  "{review.comment}"
                                </Text>
                              ) : (
                                <Text variant="small" className="text-[#999999]">
                                  Share your experience with this service
                                </Text>
                              )}
                            </div>
                            
                            {/* Right side - Rating Badge and Edit Button */}
                            <div className="flex items-center gap-3">
                              {/* Rating Badge - only show if review exists */}
                              {review && (
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
                              )}
                              
                              {/* Edit/Leave Review Button */}
                              <Button
                                size="sm"
                                onClick={() => setReviewDialog({ 
                                  isOpen: true, 
                                  booking,
                                  existingReview: review || null
                                })}
                                disabled={review && !canEditReview(booking)}
                                className={`text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border font-body ${
                                  review && !canEditReview(booking)
                                    ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                                    : 'bg-[#FFD43C] hover:bg-[#f5c830] text-black border-[#cccccc]'
                                }`}
                              >
                                {review 
                                  ? (canEditReview(booking) ? 'Edit Review' : 'View Review')
                                  : 'Leave Review'
                                }
                              </Button>
                            </div>
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
              <H2 className="mb-1">My Bookings</H2>
              <Text variant="small" color="secondary">Services you have booked from providers</Text>
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
              <Loading variant="spinner" size="md" text="Loading bookings..." fullHeight={true} />
            ) : filteredBookings.length === 0 ? (
              <BookingEmptyState
                type={activeTab as "upcoming" | "past" | "cancelled" | "all"}
                onBrowseServices={() => navigate('/discover')}
                fullHeight={true}
              />
            ) : (
              <div className="space-y-4">
                {/* Mobile Booking Cards - Same content as desktop */}
                {filteredBookings.map((booking) => {
                  // Handle both array and single object format for reviews
                  const reviewFromBooking = booking.reviews ? 
                    (Array.isArray(booking.reviews) ? booking.reviews[0] : booking.reviews) : 
                    null;
                  const review = reviewFromBooking || bookingReviews[booking.id];
                  const bookingStartTime = new Date(booking.scheduled_at);
                  const hasStarted = isPast(bookingStartTime);
                  
                  return (
                    <div key={booking.id} className="bg-white rounded-2xl border border-[#eeeeee] p-4 sm:p-6">
                      {/* Top Section: Title and Icons */}
                      <div className="flex items-start justify-between mb-4 sm:mb-6">
                        <div className="flex-1 min-w-0">
                          {/* Service Title */}
                          <H3 className="mb-1 truncate">
                            {booking.service?.title || 'Service'}
                          </H3>
                          {/* Booked date */}
                          <Description>
                            Booked {format(new Date(booking.created_at), 'MMM d, yyyy')}
                          </Description>
                        </div>
                        
                        {/* Top Right Icons - Smaller on mobile */}
                        <div className="flex items-center gap-2 ml-2">
                          {booking.status === 'confirmed' ? (
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
                                      <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
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
                                      d="M19.5 3.5L18 2L17 3.5L16 2L15 3.5L14 2L13 3.5L12 2L11 3.5L10 2L9 3.5L8 2L7 3.5L6 2L5 3.5L4.5 2V22L6 20.5L7 22L8 20.5L9 22L10 20.5L11 22L12 20.5L13 22L14 20.5L15 22L16 20.5L17 22L18 20.5L19.5 22V2L19.5 3.5Z"
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
                              icon={
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              }
                            />
                          )}
                          <DSButton 
                            variant="outline"
                            size="small"
                            iconPosition="only"
                            icon={<MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />}
                            onClick={() => setChatModal({
                              isOpen: true,
                              otherUserId: booking.provider_id,
                              otherUserName: booking.provider?.display_name || 'Provider',
                              otherUserAvatar: booking.provider?.avatar,
                              isReadOnly: booking.status === 'cancelled'
                            })}
                          />
                        </div>
                      </div>

                      {/* Provider Name and Date - Responsive text */}
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium font-body mb-4">
                        <button 
                          onClick={() => handleViewProviderProfile(booking.provider_id)}
                          className="text-black hover:text-blue-600 hover:underline"
                        >
                          {booking.provider?.display_name || 'Provider'}
                        </button>
                        <span className="text-[#cccccc]">|</span>
                        <span className="text-black">{format(new Date(booking.scheduled_at), 'EEE, MMM d, yyyy')}</span>
                        <span className="text-[#cccccc] hidden sm:inline">|</span>
                        <span className="text-black">{format(new Date(booking.scheduled_at), 'h:mm a')}</span>
                      </div>

                      {/* Status Pills and Price Row - Responsive layout */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Status Badge */}
                            <StatusBadge status={booking.status as any} />
                            
                            {/* Online Badge */}
                            {booking.is_online && <OnlineBadge isOnline={booking.is_online} />}
                            
                            {/* Duration Badge */}
                            <DurationBadge minutes={booking.duration_minutes} />
                          </div>
                          
                          {/* Auto-completion explanation for in_progress bookings */}
                          {booking.status === 'in_progress' && (
                            <Text variant="small" color="tertiary" className="mt-1">
                              Will auto-complete {(() => {
                                const endTime = new Date(new Date(booking.scheduled_at).getTime() + (booking.duration_minutes * 60 * 1000));
                                const autoCompleteTime = new Date(endTime.getTime() + (30 * 60 * 1000));
                                return format(autoCompleteTime, 'MMM d \'at\' h:mm a');
                              })()}
                            </Text>
                          )}
                        </div>

                        {/* Total Price */}
                        <div className="text-base sm:text-lg font-bold text-black font-body">
                          Total: ${booking.total_price}
                        </div>
                      </div>

                      {/* Customer Notes - Same as desktop */}
                      {booking.customer_notes && (
                        <div className="mb-4 sm:mb-6 p-3 bg-[#f8f8f8] rounded-xl">
                          <Text variant="small" className="text-[#666666]">
                            <span className="font-semibold text-black">Your notes:</span> {booking.customer_notes}
                          </Text>
                        </div>
                      )}


                      {/* Action Buttons - Only for bookings that have actions */}
                      {(booking.status === 'confirmed' || booking.status === 'pending') && (
                        <div className="pt-4 sm:pt-6 border-t border-[#eeeeee]">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {booking.status === 'confirmed' && booking.is_online && booking.meeting_link && (
                              <>
                                <DSButton
                                  variant="outline"
                                  size="small"
                                  onClick={() => handleCopyMeetingLink(booking.meeting_link!)}
                                  icon={<Copy className="w-5 h-5" />}
                                >
                                  Copy Link
                                </DSButton>
                                <DSButton
                                  variant="primary"
                                  size="small"
                                  onClick={() => handleJoinMeeting(booking.meeting_link!)}
                                  icon={getMeetingIcon(booking.meeting_platform)}
                                >
                                  Join
                                </DSButton>
                              </>
                            )}

                            {booking.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelBooking(booking.id)}
                                className="text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border border-[#cccccc] text-[#F1343D] hover:bg-[#ffeff0] font-body"
                              >
                                Cancel Request
                              </Button>
                            )}

                          </div>
                        </div>
                      )}

                      {/* Review Section for Completed - Same as desktop */}
                      {booking.status === 'completed' && (
                        <>
                          {/* Separator Line */}
                          <div className="border-t border-[#eeeeee] my-6"></div>
                          
                          {/* Review Content */}
                          <div className="flex items-start justify-between gap-4">
                            {/* Review Text */}
                            <div className="flex-1">
                              <Text variant="small" weight="medium" className="text-black mb-0.5">
                                {review ? 'Your Review' : 'Leave a Review'}
                              </Text>
                              {review ? (
                                <Text variant="small" className="text-[#666666]">
                                  "{review.comment}"
                                </Text>
                              ) : (
                                <Text variant="small" className="text-[#999999]">
                                  Share your experience with this service
                                </Text>
                              )}
                            </div>
                            
                            {/* Right side - Rating Badge and Edit Button */}
                            <div className="flex items-center gap-3">
                              {/* Rating Badge - only show if review exists */}
                              {review && (
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
                              )}
                              
                              {/* Edit/Leave Review Button */}
                              <Button
                                size="sm"
                                onClick={() => setReviewDialog({ 
                                  isOpen: true, 
                                  booking,
                                  existingReview: review || null
                                })}
                                disabled={review && !canEditReview(booking)}
                                className={`text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border font-body ${
                                  review && !canEditReview(booking)
                                    ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                                    : 'bg-[#FFD43C] hover:bg-[#f5c830] text-black border-[#cccccc]'
                                }`}
                              >
                                {review 
                                  ? (canEditReview(booking) ? 'Edit Review' : 'View Review')
                                  : 'Leave Review'
                                }
                              </Button>
                            </div>
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
      
      {/* Review Dialog */}
      {reviewDialog.booking && (
        <ReviewDialog
          isOpen={reviewDialog.isOpen}
          onClose={() => setReviewDialog({ isOpen: false, booking: null, existingReview: null })}
          booking={reviewDialog.booking}
          existingReview={reviewDialog.existingReview}
          onSubmit={handleSubmitReview}
        />
      )}

      {/* Payment Modal */}
      {payingBookingId && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPayingBookingId(null);
          }}
          amount={bookings.find(b => b.id === payingBookingId)?.total_price || 0}
          currency="USDC"
          status={{
            status: paymentTransaction.status,
            message: paymentTransaction.message,
            txHash: paymentTransaction.txHash,
            error: paymentTransaction.error
          }}
          onRetry={() => {
            if (payingBookingId) {
              handlePayNow(payingBookingId);
            }
          }}
        />
      )}
    </div>
  );
}