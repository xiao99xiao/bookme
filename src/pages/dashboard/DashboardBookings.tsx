import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, User, DollarSign, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api';
import ChatModal from '@/components/ChatModal';
import AddToCalendar from '@/components/AddToCalendar';

interface Booking {
  id: string;
  service_id: string;
  provider_id: string;
  customer_id: string;
  scheduled_at: string; // Changed from booking_date
  duration_minutes: number;
  total_price: number;
  service_fee: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  customer_notes?: string; // Changed from notes
  location?: string;
  is_online?: boolean;
  created_at: string;
  services?: {
    id: string;
    title: string;
    short_description?: string;
    description?: string;
    price: number;
    images?: string[];
  };
  provider?: {
    display_name: string;
    email: string;
    avatar?: string;
  };
}

export default function DashboardBookings() {
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
        undefined, // no notes
        userId // pass userId for Privy users
      );
      toast.success('Booking cancelled successfully');
      loadBookings();
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      toast.error('Failed to cancel booking');
    }
  };

  const handleChatOpen = (booking: Booking) => {
    setChatModal({
      isOpen: true,
      otherUserId: booking.provider_id,
      otherUserName: booking.provider?.display_name || 'Provider',
      otherUserAvatar: booking.provider?.avatar,
      isReadOnly: booking.status === 'cancelled'
    });
  };

  const handleChatClose = () => {
    setChatModal({
      isOpen: false,
      otherUserId: '',
      otherUserName: '',
      otherUserAvatar: undefined,
      isReadOnly: false
    });
  };

  const handleViewProviderProfile = (providerId: string) => {
    navigate(`/profile/${providerId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const isBookingOverdue = (booking: Booking) => {
    const now = new Date();
    const scheduledEnd = new Date(booking.scheduled_at);
    scheduledEnd.setMinutes(scheduledEnd.getMinutes() + booking.duration_minutes);
    return now > scheduledEnd && (booking.status === 'confirmed' || booking.status === 'pending');
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Bookings List */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">My Bookings</h1>
        <p className="text-gray-600 mb-8">Services you have booked from other providers</p>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-8">
            {loading ? (
              <p className="text-center text-gray-500 py-8">Loading bookings...</p>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No {activeTab} bookings</p>
                {activeTab === 'upcoming' && (
                  <p className="text-sm text-gray-400 mt-1">
                    Browse services and make your first booking
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {filteredBookings.map((booking, index) => (
                  <div key={booking.id} className={`pb-8 ${index !== filteredBookings.length - 1 ? 'border-b border-gray-200' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <Badge className={getStatusColor(booking.status)}>
                            <span className="flex items-center space-x-1">
                              {getStatusIcon(booking.status)}
                              <span>{booking.status}</span>
                            </span>
                          </Badge>
                          {isBookingOverdue(booking) && (
                            <Badge className="bg-red-100 text-red-800">
                              <span className="flex items-center space-x-1">
                                <AlertCircle className="w-4 h-4" />
                                <span>OVERDUE</span>
                              </span>
                            </Badge>
                          )}
                          <span className="text-sm text-gray-500">
                            Booked {format(new Date(booking.created_at), 'MMM dd, yyyy')}
                          </span>
                        </div>

                        <h3 className="font-semibold text-lg mb-2">
                          {booking.services?.title || 'Service'}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center text-gray-600">
                              <User className="w-4 h-4 mr-2" />
                              Provider: <button 
                                onClick={() => handleViewProviderProfile(booking.provider_id)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium ml-1"
                              >
                                {booking.provider?.display_name || 'Provider'}
                              </button>
                            </div>
                            <div className="flex items-center text-gray-600">
                              <Calendar className="w-4 h-4 mr-2" />
                              {format(new Date(booking.scheduled_at), 'EEEE, MMMM dd, yyyy')}
                            </div>
                            <div className="flex items-center text-gray-600">
                              <Clock className="w-4 h-4 mr-2" />
                              {format(new Date(booking.scheduled_at), 'HH:mm')} ({booking.duration_minutes} min)
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center font-medium">
                              <DollarSign className="w-4 h-4 mr-2" />
                              Total Paid: ${booking.total_price.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {booking.customer_notes && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Your notes:</span> {booking.customer_notes}
                            </p>
                          </div>
                        )}

                        {isBookingOverdue(booking) && (
                          <div className="mt-4 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-lg">
                            <p className="text-sm text-orange-700">
                              <span className="font-medium">⏰ Service time has passed</span>
                              <br />
                              Please contact the provider to confirm if the service was completed.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col space-y-2 ml-4">
                        {(booking.status === 'confirmed' || booking.status === 'pending') && (
                          <>
                            <AddToCalendar
                              title={`${booking.services?.title || 'Service'} with ${booking.provider?.display_name || 'Provider'}`}
                              description={`Booking for ${booking.services?.title}${booking.customer_notes ? `\n\nNotes: ${booking.customer_notes}` : ''}`}
                              startDate={new Date(booking.scheduled_at)}
                              endDate={new Date(new Date(booking.scheduled_at).getTime() + booking.duration_minutes * 60000)}
                              location={booking.location}
                              isOnline={booking.is_online}
                            />
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleChatOpen(booking)}
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Message
                            </Button>
                          </>
                        )}
                        
                        {booking.status === 'confirmed' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            Cancel
                          </Button>
                        )}
                        
                        {booking.status === 'completed' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleChatOpen(booking)}
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Message
                            </Button>
                            <Button size="sm" variant="outline">
                              Leave Review
                            </Button>
                          </>
                        )}

                        {booking.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            Cancel Request
                          </Button>
                        )}

                        {booking.status === 'cancelled' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleChatOpen(booking)}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            View Chat
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Chat Modal */}
      <ChatModal
        isOpen={chatModal.isOpen}
        onClose={handleChatClose}
        otherUserId={chatModal.otherUserId}
        otherUserName={chatModal.otherUserName}
        otherUserAvatar={chatModal.otherUserAvatar}
        isReadOnly={chatModal.isReadOnly}
      />
    </div>
  );
}