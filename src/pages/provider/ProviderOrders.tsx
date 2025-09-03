import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, CheckCircle, MessageSquare, Copy, Video, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient, Booking } from '@/lib/api-migration';
import ChatModal from '@/components/ChatModal';
import ReviewDialog from '@/components/ReviewDialog';

export default function ProviderOrders() {
  const { userId, user } = useAuth();
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
  const [reviewDialog, setReviewDialog] = useState<{
    isOpen: boolean;
    booking: Booking | null;
    existingReview: any | null;
  }>({
    isOpen: false,
    booking: null,
    existingReview: null
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
        if (booking.reviews && booking.reviews.length > 0) {
          const review = booking.reviews[0];
          reviewsMap[booking.id] = {
            id: review.id,
            rating: review.rating,
            comment: review.comment || '',
            created_at: review.created_at,
            updated_at: review.updated_at,
            reviewer: review.reviewer,
            reviewee: review.reviewee
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

  const handleCopyMeetingLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied to clipboard');
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
        return null;
      default:
        return null;
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 'all') return true;
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="mb-6">
              {/* Title - Spectral font */}
              <h2 className="text-2xl font-bold text-black font-heading mb-2">Orders</h2>
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

          {/* Main Content Area */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500 font-body">Loading orders...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-body">No {activeTab === 'all' ? '' : activeTab} orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Each booking is a separate CARD */}
                {filteredBookings.map((booking) => {
                  const review = bookingReviews[booking.id];
                  const earnings = booking.total_price - (booking.service_fee || 0);
                  
                  return (
                    <div key={booking.id} className="bg-white rounded-2xl border border-[#eeeeee] p-6">
                      {/* Top Section: Title and Icons */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          {/* Service Title */}
                          <h3 className="text-lg font-semibold text-black font-body mb-1">
                            {booking.service?.title || 'Online Teaching'}
                          </h3>
                          {/* Booked date */}
                          <p className="text-xs text-[#aaaaaa] font-body">
                            Booked {format(new Date(booking.created_at), 'MMM d,yyyy')}
                          </p>
                        </div>
                        
                        {/* Top Right Icons */}
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50">
                            <Calendar className="w-5 h-5 text-gray-600" />
                          </button>
                          <button 
                            className="p-1.5 border border-[#cccccc] rounded-xl hover:bg-gray-50"
                            onClick={() => setChatModal({
                              isOpen: true,
                              otherUserId: booking.customer_id,
                              otherUserName: booking.customer?.display_name || 'Customer',
                              otherUserAvatar: booking.customer?.avatar,
                              isReadOnly: booking.status === 'cancelled'
                            })}
                          >
                            <MessageSquare className="w-5 h-5 text-gray-600" />
                          </button>
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
                          {booking.status === 'confirmed' && (
                            <div className="bg-[#eff7ff] px-1.5 py-1 rounded-lg flex items-center gap-1">
                              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                                <path d="M5 10h10m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span className="text-sm text-black font-body">Ongoing</span>
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
                            <Calendar className="w-5 h-5 text-[#666666]" />
                            <span className="text-sm text-[#666666] font-body">{booking.duration_minutes} min</span>
                          </div>
                        </div>

                        {/* Total Price */}
                        <div className="text-lg font-bold text-black font-body">
                          Total: ${booking.total_price}
                        </div>
                      </div>

                      {/* Divider Line */}
                      <div className="border-t border-[#eeeeee] my-6"></div>

                      {/* Bottom Section: Timer and Actions */}
                      <div className="flex items-center justify-between">
                        {/* Timer or Status Text */}
                        <div className="text-sm font-medium text-black font-body">
                          {booking.status === 'confirmed' && '02:03:06'}
                          {booking.status === 'pending' && 'New order'}
                          {booking.status === 'completed' && 'Ended'}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                          {booking.status === 'confirmed' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleUpdateStatus(booking.id, 'completed')}
                                className="bg-[#36D267] hover:bg-[#2eb858] text-white text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-[#cccccc] font-body flex items-center gap-2"
                              >
                                <CheckCircle className="w-5 h-5" />
                                Mark Complete
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => booking.meeting_link && handleCopyMeetingLink(booking.meeting_link)}
                                className="text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-[#cccccc] text-[#666666] font-body flex items-center gap-2 min-w-[110px]"
                              >
                                <Copy className="w-5 h-5" />
                                Copy
                              </Button>
                              <Button
                                size="sm"
                                className="bg-black hover:bg-gray-900 text-white text-sm font-semibold px-2 py-1.5 h-8 rounded-xl border border-black font-body flex items-center gap-2 min-w-[110px]"
                              >
                                <Video className="w-5 h-5" />
                                Join
                              </Button>
                            </>
                          )}

                          {booking.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateStatus(booking.id, 'cancelled')}
                                className="text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border border-[#cccccc] text-[#666666] font-body"
                              >
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                                className="bg-black hover:bg-gray-900 text-white text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border border-black font-body"
                              >
                                Accept
                              </Button>
                            </>
                          )}

                          {booking.status === 'completed' && (
                            <>
                              {review && (
                                <div className="flex items-center gap-1 mr-4">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${
                                        i < (review?.rating || 5)
                                          ? 'text-[#FFD43C] fill-[#FFD43C]'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                  <span className="text-sm font-medium text-black font-body ml-1">
                                    {review?.rating || 5}/5
                                  </span>
                                </div>
                              )}
                              <Button
                                size="sm"
                                onClick={() => setReviewDialog({ 
                                  isOpen: true, 
                                  booking,
                                  existingReview: review
                                })}
                                className="bg-[#FFD43C] hover:bg-[#f5c830] text-black text-sm font-semibold px-4 py-1.5 h-8 rounded-xl border border-[#cccccc] font-body"
                              >
                                Review
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Customer Review Section for Completed */}
                      {booking.status === 'completed' && review && (
                        <div className="mt-4 pt-4 border-t border-[#eeeeee]">
                          <p className="text-sm font-medium text-black font-body mb-2">Customer Review</p>
                          <p className="text-sm text-[#666666] font-body italic">
                            "{review.comment || 'This is a test review that used to demo how a review will be displayed in the future.'}"
                          </p>
                        </div>
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
          forceReadOnly={true}
          onSubmit={async () => {
            throw new Error('Providers cannot submit reviews from incoming orders');
          }}
        />
      )}
    </div>
  );
}