import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { Calendar, Clock, MapPin, User, DollarSign, CheckCircle, XCircle, AlertCircle, MessageSquare, Star, Copy, Video } from 'lucide-react';
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
import { ApiClient, Booking } from '@/lib/api-migration';
import ChatModal from '@/components/ChatModal';
import ReviewDialog from '@/components/ReviewDialog';
import { H2, H3 } from '@/design-system';

export default function CustomerBookings() {
  const { userId } = useAuth();
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
    try {
      await ApiClient.updateBookingStatus(
        bookingId, 
        'completed',
        undefined,
        userId
      );
      toast.success('Booking marked as completed');
      
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        setReviewDialog({
          isOpen: true,
          booking,
          existingReview: null
        });
      }
      
      loadBookings();
    } catch (error) {
      console.error('Failed to complete booking:', error);
      toast.error('Failed to complete booking');
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
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied to clipboard');
  };

  const handleJoinMeeting = (link: string) => {
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
        return bookingDateTime > now && booking.status !== 'cancelled' && booking.status !== 'completed';
      case 'past':
        return bookingDateTime <= now || booking.status === 'completed';
      case 'cancelled':
        return booking.status === 'cancelled';
      case 'all':
      default:
        return true;
    }
  });

  const tabLabels = {
    all: 'All',
    upcoming: 'Upcoming',
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
              <p className="text-sm text-gray-500 font-body">Services you have booked from providers</p>
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
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500 font-body">Loading bookings...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-body">No {activeTab === 'all' ? '' : activeTab} bookings</p>
                {activeTab === 'upcoming' && (
                  <p className="text-sm text-gray-400 mt-1 font-body">
                    Browse services and make your first booking
                  </p>
                )}
              </div>
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
                          <p className="text-xs text-[#aaaaaa] font-body">
                            Booked {format(new Date(booking.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        
                        {/* Top Right Icons */}
                        <div className="flex items-center gap-2">
                          {booking.status === 'confirmed' ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50">
                                  {/* Calendar Plus icon from Figma */}
                                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
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
                            <button className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50 opacity-50 cursor-not-allowed">
                              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          )}
                          <button 
                            className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50"
                            onClick={() => setChatModal({
                              isOpen: true,
                              otherUserId: booking.provider_id,
                              otherUserName: booking.provider?.display_name || 'Provider',
                              otherUserAvatar: booking.provider?.avatar,
                              isReadOnly: booking.status === 'cancelled'
                            })}
                          >
                            <MessageSquare className="w-5 h-5 text-gray-600" />
                          </button>
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
                        <div className="flex items-center gap-2">
                          {/* Status Badge */}
                          {booking.status === 'confirmed' && (
                            <div className="bg-[#eff7ff] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-[#3B9EF9]" />
                              <span className="text-sm text-black font-body">Confirmed</span>
                            </div>
                          )}
                          {booking.status === 'pending' && (
                            <div className="bg-[#fcf9f4] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <span className="w-2 h-2 bg-[#FFD43C] rounded-full"></span>
                              <span className="text-sm text-black font-body">Pending</span>
                            </div>
                          )}
                          {booking.status === 'completed' && (
                            <div className="bg-[#e7fded] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-[#36D267]" />
                              <span className="text-sm text-black font-body">Completed</span>
                            </div>
                          )}
                          {booking.status === 'cancelled' && (
                            <div className="bg-[#ffeff0] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-[#F1343D]" />
                              <span className="text-sm text-black font-body">Cancelled</span>
                            </div>
                          )}
                          
                          {/* Online Badge */}
                          {booking.is_online && (
                            <div className="bg-[#f3f3f3] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                                <rect x="3" y="5" width="14" height="10" rx="1" stroke="#666666" strokeWidth="1.5"/>
                                <line x1="7" y1="18" x2="13" y2="18" stroke="#666666" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              <span className="text-sm text-[#666666] font-body">Online</span>
                            </div>
                          )}
                          
                          {/* Duration Badge */}
                          <div className="bg-[#f3f3f3] px-1.5 py-1 rounded-lg flex items-center gap-1">
                            <Clock className="w-5 h-5 text-[#666666]" />
                            <span className="text-sm text-[#666666] font-body">{booking.duration_minutes} min</span>
                          </div>
                        </div>

                        {/* Total Price */}
                        <div className="text-lg font-bold text-black font-body">
                          Total: ${booking.total_price}
                        </div>
                      </div>

                      {/* Customer Notes Section if present */}
                      {booking.customer_notes && (
                        <>
                          <div className="border-t border-[#eeeeee] my-4"></div>
                          <div className="mb-4">
                            <p className="text-sm text-[#666666] font-body">
                              <span className="font-medium text-black">Your notes:</span> {booking.customer_notes}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Action Section - only for bookings that have actions */}
                      {(booking.status === 'confirmed' || booking.status === 'pending') && (
                        <>
                          <div className="border-t border-[#eeeeee] my-6"></div>
                          
                          {/* Bottom Section: Actions */}
                          <div className="flex items-center justify-between">
                            {/* Left Status Text */}
                            <div className="text-sm font-medium text-black font-body">
                              {booking.status === 'confirmed' && (hasStarted ? 'In Progress' : 'Upcoming')}
                              {booking.status === 'pending' && 'Awaiting Confirmation'}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                          {booking.status === 'confirmed' && (
                            <>
                              {hasStarted ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleCompleteBooking(booking.id)}
                                  className="bg-[#36D267] hover:bg-[#2eb858] text-white text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-[#cccccc] font-body flex items-center gap-2"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                  Mark Complete
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border border-[#cccccc] text-[#F1343D] hover:bg-[#ffeff0] font-body"
                                >
                                  Cancel
                                </Button>
                              )}
                              {booking.meeting_link && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyMeetingLink(booking.meeting_link!)}
                                    className="text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-[#cccccc] text-[#666666] font-body flex items-center gap-2 min-w-[110px]"
                                  >
                                    <Copy className="w-5 h-5" />
                                    Copy Link
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleJoinMeeting(booking.meeting_link!)}
                                    className="bg-black hover:bg-gray-900 text-white text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-black font-body flex items-center gap-2 min-w-[110px]"
                                  >
                                    {getMeetingIcon(booking.meeting_platform)}
                                    Join
                                  </Button>
                                </>
                              )}
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
                              <p className="text-sm font-medium text-black font-body mb-0.5">
                                {review ? 'Your Review' : 'Leave a Review'}
                              </p>
                              {review ? (
                                <p className="text-sm text-[#666666] font-body">
                                  "{review.comment}"
                                </p>
                              ) : (
                                <p className="text-sm text-[#999999] font-body">
                                  Share your experience with this service
                                </p>
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
              <p className="text-sm text-gray-500 font-body">Services you have booked from providers</p>
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
          <div>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500 font-body">Loading bookings...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-body">No {activeTab === 'all' ? '' : activeTab} bookings</p>
                {activeTab === 'upcoming' && (
                  <p className="text-sm text-gray-400 mt-1 font-body">
                    Browse services and make your first booking
                  </p>
                )}
              </div>
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
                          <p className="text-xs text-[#aaaaaa] font-body">
                            Booked {format(new Date(booking.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        
                        {/* Top Right Icons - Smaller on mobile */}
                        <div className="flex items-center gap-2 ml-2">
                          {booking.status === 'confirmed' ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
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
                            <button className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50 opacity-50 cursor-not-allowed">
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6.66667 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M13.3333 1.66675V4.16675" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2.5 7.50008H17.5" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M17.5 3.33325H2.5C1.83696 3.33325 1.66667 3.50354 1.66667 4.16658V16.6666C1.66667 17.3296 1.83696 17.4999 2.5 17.4999H17.5C18.163 17.4999 18.3333 17.3296 18.3333 16.6666V4.16658C18.3333 3.50354 18.163 3.33325 17.5 3.33325Z" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M10 11.6667V14.1667" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8.75 12.9167H11.25" stroke="#666666" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          )}
                          <button 
                            className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50"
                            onClick={() => setChatModal({
                              isOpen: true,
                              otherUserId: booking.provider_id,
                              otherUserName: booking.provider?.display_name || 'Provider',
                              otherUserAvatar: booking.provider?.avatar,
                              isReadOnly: booking.status === 'cancelled'
                            })}
                          >
                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                          </button>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status Badge */}
                          {booking.status === 'confirmed' && (
                            <div className="bg-[#eff7ff] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-[#3B9EF9]" />
                              <span className="text-sm text-black font-body">Confirmed</span>
                            </div>
                          )}
                          {booking.status === 'pending' && (
                            <div className="bg-[#fcf9f4] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <span className="w-2 h-2 bg-[#FFD43C] rounded-full"></span>
                              <span className="text-sm text-black font-body">Pending</span>
                            </div>
                          )}
                          {booking.status === 'completed' && (
                            <div className="bg-[#e7fded] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-[#36D267]" />
                              <span className="text-sm text-black font-body">Completed</span>
                            </div>
                          )}
                          {booking.status === 'cancelled' && (
                            <div className="bg-[#ffeff0] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-[#F1343D]" />
                              <span className="text-sm text-black font-body">Cancelled</span>
                            </div>
                          )}
                          
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
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#666666]" />
                            <span className="text-sm text-[#666666] font-body">{booking.duration_minutes} min</span>
                          </div>
                        </div>

                        {/* Total Price */}
                        <div className="text-base sm:text-lg font-bold text-black font-body">
                          Total: ${booking.total_price}
                        </div>
                      </div>

                      {/* Customer Notes - Same as desktop */}
                      {booking.customer_notes && (
                        <div className="mb-4 sm:mb-6 p-3 bg-[#f8f8f8] rounded-xl">
                          <p className="text-sm text-[#666666] font-body">
                            <span className="font-semibold text-black">Your notes:</span> {booking.customer_notes}
                          </p>
                        </div>
                      )}


                      {/* Action Buttons - Only for bookings that have actions */}
                      {(booking.status === 'confirmed' || booking.status === 'pending') && (
                        <div className="pt-4 sm:pt-6 border-t border-[#eeeeee]">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {booking.status === 'confirmed' && (
                              <>
                                {hasStarted ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleCompleteBooking(booking.id)}
                                    className="bg-[#36D267] hover:bg-[#2eb858] text-white text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-[#cccccc] font-body flex items-center gap-2"
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                    Mark Complete
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancelBooking(booking.id)}
                                    className="text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border border-[#cccccc] text-[#F1343D] hover:bg-[#ffeff0] font-body"
                                  >
                                    Cancel
                                  </Button>
                                )}
                                {booking.meeting_link && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyMeetingLink(booking.meeting_link!)}
                                      className="text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-[#cccccc] text-[#666666] font-body flex items-center gap-2 min-w-[110px]"
                                    >
                                      <Copy className="w-5 h-5" />
                                      Copy Link
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleJoinMeeting(booking.meeting_link!)}
                                      className="bg-black hover:bg-gray-900 text-white text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-black font-body flex items-center gap-2 min-w-[110px]"
                                    >
                                      {getMeetingIcon(booking.meeting_platform)}
                                      Join
                                    </Button>
                                  </>
                                )}
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
                              <p className="text-sm font-medium text-black font-body mb-0.5">
                                {review ? 'Your Review' : 'Leave a Review'}
                              </p>
                              {review ? (
                                <p className="text-sm text-[#666666] font-body">
                                  "{review.comment}"
                                </p>
                              ) : (
                                <p className="text-sm text-[#999999] font-body">
                                  Share your experience with this service
                                </p>
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
    </div>
  );
}