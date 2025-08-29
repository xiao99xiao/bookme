import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, User, DollarSign, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api';
import ChatModal from '@/components/ChatModal';
import AddToCalendar from '@/components/AddToCalendar';
import MeetingLinkDisplay from '@/components/MeetingLinkDisplay';

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
  meeting_link?: string;
  meeting_platform?: string;
  meeting_id?: string;
  created_at: string;
  services?: {
    id: string;
    title: string;
    short_description?: string;
    description?: string;
    price: number;
    images?: string[];
  };
  customer?: {
    display_name: string;
    email: string;
    avatar?: string;
  };
}

export default function DashboardOrders() {
  const { userId } = useAuth();
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
      const bookingsData = await ApiClient.getProviderBookings(userId!);
      setBookings(bookingsData);
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
        undefined, // no notes
        userId // pass userId for Privy users
      );
      toast.success(`Booking ${newStatus}`);
      loadBookings();
    } catch (error) {
      console.error('Failed to update booking:', error);
      toast.error('Failed to update booking status');
    }
  };

  const handleChatOpen = (booking: Booking) => {
    setChatModal({
      isOpen: true,
      otherUserId: booking.customer_id,
      otherUserName: booking.customer?.display_name || 'Customer',
      otherUserAvatar: booking.customer?.avatar,
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

  const hasBookingTimeStarted = (booking: Booking) => {
    const now = new Date();
    const scheduledStart = new Date(booking.scheduled_at);
    return now >= scheduledStart;
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 'all') return true;
    return booking.status === activeTab;
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Orders List */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Incoming Orders</h1>
        <p className="text-gray-600 mb-8">Manage bookings from your customers</p>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-8">
            {loading ? (
              <p className="text-center text-gray-500 py-8">Loading orders...</p>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No {activeTab === 'all' ? '' : activeTab} orders</p>
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
                              {booking.customer?.display_name || 'Customer'}
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
                            <div className="flex items-center text-gray-600">
                              <DollarSign className="w-4 h-4 mr-2" />
                              Total: ${booking.total_price}
                            </div>
                            <div className="flex items-center text-gray-600">
                              <DollarSign className="w-4 h-4 mr-2" />
                              Your earnings: ${(booking.total_price - (booking.service_fee || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {booking.customer_notes && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notes:</span> {booking.customer_notes}
                            </p>
                          </div>
                        )}

                        {booking.meeting_link && booking.status === 'confirmed' && (
                          <div className="mt-4">
                            <MeetingLinkDisplay
                              meetingLink={booking.meeting_link}
                              meetingPlatform={booking.meeting_platform}
                              scheduledAt={booking.scheduled_at}
                            />
                          </div>
                        )}

                        {isBookingOverdue(booking) && (
                          <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-400 rounded-lg">
                            <p className="text-sm text-red-700">
                              <span className="font-medium">⚠️ This booking is overdue!</span>
                              <br />
                              The scheduled time has passed. Please mark as completed or contact the customer.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col space-y-2 ml-4">
                        {(booking.status === 'confirmed' || booking.status === 'pending') && (
                          <>
                            {booking.status === 'confirmed' && (
                              <AddToCalendar
                                title={`${booking.services?.title || 'Service'} - ${booking.customer?.display_name || 'Customer'}`}
                                description={`Service booking with ${booking.customer?.display_name}${booking.customer_notes ? `\n\nCustomer notes: ${booking.customer_notes}` : ''}`}
                                startDate={new Date(booking.scheduled_at)}
                                endDate={new Date(new Date(booking.scheduled_at).getTime() + booking.duration_minutes * 60000)}
                                location={booking.location}
                                isOnline={booking.is_online}
                              />
                            )}
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
                        
                        {booking.status === 'pending' && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(booking.id, 'cancelled')}
                            >
                              Decline
                            </Button>
                          </div>
                        )}

                        {booking.status === 'confirmed' && hasBookingTimeStarted(booking) && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(booking.id, 'completed')}
                          >
                            Mark Complete
                          </Button>
                        )}

                        {booking.status === 'completed' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleChatOpen(booking)}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Message
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