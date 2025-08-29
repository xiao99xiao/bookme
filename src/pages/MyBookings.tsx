import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, CheckCircle, Clock, MapPin, X, Star, Loader2, Phone, Users } from "lucide-react";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api";
import { formatDateInTimezone, getBrowserTimezone, convertDateTimezone } from '@/lib/timezone';

interface Booking {
  id: string;
  service_id: string;
  customer_id: string;
  provider_id: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'refunded';
  scheduled_at: string;
  duration_minutes: number;
  total_price: number;
  service_fee: number;
  customer_notes?: string;
  provider_notes?: string;
  location?: string;
  is_online: boolean;
  meeting_link?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  services?: {
    title: string;
    description: string;
    price: number;
    duration_minutes: number;
    categories?: {
      name: string;
    };
  };
  provider?: {
    display_name: string;
    email: string;
    avatar?: string;
  };
  customer?: {
    display_name: string;
    email: string;
    avatar?: string;
  };
}

const MyBookings = () => {
  const { user, userId, profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providerBookings, setProviderBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'customer' | 'provider'>('customer');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Get user's timezone for proper date display
  const userTimezone = profile?.timezone || getBrowserTimezone();

  // Auto-set timezone for existing users who don't have one
  useEffect(() => {
    if (profile && !profile.timezone && userId) {
      const browserTimezone = getBrowserTimezone();
      ApiClient.updateProfile({ timezone: browserTimezone }, userId)
        .then(() => {
          console.log('Auto-set user timezone to:', browserTimezone);
        })
        .catch(error => {
          console.error('Failed to auto-set timezone:', error);
        });
    }
  }, [profile, userId]);

  // Helper function to format booking date in user's timezone
  const formatBookingDate = (dateString: string, formatString: string) => {
    const date = parseISO(dateString);
    return formatDateInTimezone(date, userTimezone, {
      year: 'numeric',
      month: formatString.includes('MMM') ? 'short' : 'numeric',
      day: 'numeric',
      hour: formatString.includes('h') ? 'numeric' : undefined,
      minute: formatString.includes('m') ? '2-digit' : undefined,
      hour12: formatString.includes('a'),
      weekday: formatString.includes('EEEE') ? 'long' : undefined
    });
  };

  // Load bookings data
  useEffect(() => {
    const loadBookings = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        const [customerBookings, providerBookings] = await Promise.all([
          ApiClient.getUserBookings(userId, 'customer'),
          ApiClient.getUserBookings(userId, 'provider')
        ]);
        
        setBookings(customerBookings);
        setProviderBookings(providerBookings);
      } catch (error) {
        console.error('Failed to load bookings:', error);
        toast.error('Failed to load bookings');
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [userId]);

  const handleStatusUpdate = async (bookingId: string, status: 'confirmed' | 'cancelled' | 'completed', notes?: string) => {
    setActionLoading(bookingId);
    try {
      await ApiClient.updateBookingStatus(bookingId, status, notes);
      
      // Reload bookings
      const [customerBookings, providerBookings] = await Promise.all([
        ApiClient.getUserBookings(userId || '', 'customer'),
        ApiClient.getUserBookings(userId || '', 'provider')
      ]);
      setBookings(customerBookings);
      setProviderBookings(providerBookings);
      
      toast.success(`Booking ${status} successfully`);
      setSelectedBooking(null);
      setCancelReason('');
    } catch (error) {
      console.error('Failed to update booking:', error);
      toast.error('Failed to update booking');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'outline' as const, color: 'text-yellow-600', label: 'Pending' },
      confirmed: { variant: 'default' as const, color: 'text-green-600', label: 'Confirmed' },
      in_progress: { variant: 'default' as const, color: 'text-blue-600', label: 'In Progress' },
      completed: { variant: 'secondary' as const, color: 'text-green-700', label: 'Completed' },
      cancelled: { variant: 'destructive' as const, color: 'text-red-600', label: 'Cancelled' },
      refunded: { variant: 'outline' as const, color: 'text-gray-600', label: 'Refunded' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getLocationIcon = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return <Video className="h-4 w-4" />;
    if (hasLocation) return <Users className="h-4 w-4" />;
    return <Phone className="h-4 w-4" />;
  };

  const getLocationText = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return "Online";
    if (hasLocation) return "In Person";
    return "Phone Call";
  };

  const renderBookingCard = (booking: Booking, isProvider: boolean) => {
    const otherUser = isProvider ? booking.customer : booking.provider;
    const scheduledDate = parseISO(booking.scheduled_at);
    
    // For past/future comparison, we can use the UTC time since the comparison
    // is relative to now and both are in the same timezone context
    const isUpcoming = isFuture(scheduledDate);
    const isPassed = isPast(scheduledDate);

    return (
      <Card key={booking.id} className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={otherUser?.avatar || ""} alt={otherUser?.display_name || "User"} />
                <AvatarFallback>
                  {otherUser?.display_name?.charAt(0) || otherUser?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base">{booking.services?.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  with {otherUser?.display_name || otherUser?.email?.split('@')[0]}
                </p>
              </div>
            </div>
            {getStatusBadge(booking.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatDateInTimezone(scheduledDate, userTimezone, {
                  month: 'short',
                  day: 'numeric', 
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                }).replace(',', ' •')}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getLocationIcon(booking.is_online, !!booking.location)}
                {getLocationText(booking.is_online, !!booking.location)}
              </div>
            </div>
            <div className="text-sm font-medium">${booking.total_price}</div>
          </div>

          {booking.customer_notes && (
            <div className="text-sm">
              <span className="font-medium">Notes: </span>
              <span className="text-muted-foreground">{booking.customer_notes}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedBooking(booking)}
            >
              View Details
            </Button>

            {isProvider && booking.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                  disabled={actionLoading === booking.id}
                >
                  {actionLoading === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedBooking(booking);
                    setCancelReason('');
                  }}
                  disabled={actionLoading === booking.id}
                >
                  Decline
                </Button>
              </>
            )}

            {booking.status === 'confirmed' && isPassed && (
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(booking.id, 'completed')}
                disabled={actionLoading === booking.id}
              >
                {actionLoading === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark Complete'}
              </Button>
            )}

            {(booking.status === 'pending' || booking.status === 'confirmed') && isUpcoming && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSelectedBooking(booking);
                  setCancelReason('');
                }}
                disabled={actionLoading === booking.id}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
          <p className="text-muted-foreground">Manage your service bookings and appointments</p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'customer' | 'provider')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customer">
              My Bookings ({bookings.length})
            </TabsTrigger>
            <TabsTrigger value="provider">
              Service Requests ({providerBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="space-y-6">
            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">You haven't made any bookings yet.</p>
                <Button onClick={() => window.location.href = '/discover'}>
                  Discover Services
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => renderBookingCard(booking, false))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="provider" className="space-y-6">
            {providerBookings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No service requests yet.</p>
                <Button onClick={() => window.location.href = '/edit-profile'}>
                  Create Services
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {providerBookings.map(booking => renderBookingCard(booking, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Booking Details Dialog */}
        <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
            </DialogHeader>
            
            {selectedBooking && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Service</h4>
                    <p>{selectedBooking.services?.title}</p>
                    <p className="text-sm text-muted-foreground">{selectedBooking.services?.categories?.name}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Date & Time</h4>
                    <p>{formatDateInTimezone(parseISO(selectedBooking.scheduled_at), userTimezone, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateInTimezone(parseISO(selectedBooking.scheduled_at), userTimezone, {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })} ({selectedBooking.duration_minutes} min)
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Location</h4>
                    <p>{getLocationText(selectedBooking.is_online, !!selectedBooking.location)}</p>
                    {selectedBooking.location && <p className="text-sm text-muted-foreground">{selectedBooking.location}</p>}
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Price</h4>
                    <p className="text-lg font-semibold">${selectedBooking.total_price}</p>
                    <p className="text-sm text-muted-foreground">Service fee: ${selectedBooking.service_fee}</p>
                  </div>
                </div>

                {selectedBooking.customer_notes && (
                  <div>
                    <h4 className="font-medium mb-2">Customer Notes</h4>
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded">{selectedBooking.customer_notes}</p>
                  </div>
                )}

                {selectedBooking.status === 'cancelled' && selectedBooking.cancellation_reason && (
                  <div>
                    <h4 className="font-medium mb-2">Cancellation Reason</h4>
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded">{selectedBooking.cancellation_reason}</p>
                  </div>
                )}

                {/* Cancel booking form */}
                {(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed') && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Cancel Booking</h4>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Please provide a reason for cancellation..."
                      className="mb-3"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleStatusUpdate(selectedBooking.id, 'cancelled', cancelReason)}
                        disabled={actionLoading === selectedBooking.id || !cancelReason.trim()}
                      >
                        {actionLoading === selectedBooking.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirm Cancellation
                      </Button>
                      <Button variant="outline" onClick={() => setCancelReason('')}>
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MyBookings;