import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Video, Clock, MapPin, X, Star, Loader2, Phone, Users, MessageCircle } from "lucide-react";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { toast } from "sonner";
import { useAuth} from "@/contexts/PrivyAuthContext";
import { H1, H3, Text, Label, Description } from '@/design-system';
import { ApiClient } from "@/lib/api-migration";

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
}

export default function MyBookingsCustomer() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Load bookings data (customer bookings)
  useEffect(() => {
    const loadBookings = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const customerBookings = await ApiClient.getUserBookings('customer');
        setBookings(customerBookings);
      } catch (error) {
        console.error('Failed to load bookings:', error);
        toast.error('Failed to load bookings');
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [user]);

  const handleCancelBooking = async (bookingId: string, reason: string) => {
    setActionLoading(bookingId);
    try {
      await ApiClient.updateBookingStatus(bookingId, 'cancelled', reason);
      
      // Reload bookings
      const customerBookings = await ApiClient.getUserBookings('customer');
      setBookings(customerBookings);
      
      toast.success('Booking cancelled successfully');
      setSelectedBooking(null);
      setCancelReason('');
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      toast.error('Failed to cancel booking');
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

  const renderBookingCard = (booking: Booking) => {
    const provider = booking.provider;
    const scheduledDate = parseISO(booking.scheduled_at);
    const isUpcoming = isFuture(scheduledDate);
    const isPassed = isPast(scheduledDate);

    return (
      <Card key={booking.id} className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={provider?.avatar || ""} alt={provider?.display_name || "Provider"} />
                <AvatarFallback>
                  {provider?.display_name?.charAt(0) || provider?.email?.charAt(0) || "P"}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{booking.services?.title}</CardTitle>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>Provider: {provider?.display_name || provider?.email}</span>
                  <span>•</span>
                  <span>{booking.services?.categories?.name}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(booking.status)}
              <div className="text-sm text-muted-foreground mt-1">
                Booking #{booking.id.slice(-8)}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{format(scheduledDate, 'PPp')}</span>
                {isUpcoming && <Badge variant="outline" className="text-xs">Upcoming</Badge>}
                {isPassed && booking.status === 'pending' && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                {getLocationIcon(booking.is_online, !!booking.location)}
                <span>{getLocationText(booking.is_online, !!booking.location)}</span>
                {booking.location && !booking.is_online && <span>• {booking.location}</span>}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="font-medium">${booking.total_price}</span>
                <span>• {booking.duration_minutes} minutes</span>
              </div>
            </div>
            <div className="space-y-2">
              {booking.customer_notes && (
                <div>
                  <Label>Your Notes:</Label>
                  <Text variant="small" color="secondary">{booking.customer_notes}</Text>
                </div>
              )}
              {booking.provider_notes && (
                <div>
                  <Label>Provider Notes:</Label>
                  <Text variant="small" color="secondary">{booking.provider_notes}</Text>
                </div>
              )}
              {booking.cancellation_reason && (
                <div>
                  <Label>Cancellation Reason:</Label>
                  <Text variant="small" color="secondary">{booking.cancellation_reason}</Text>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex space-x-2">
            {booking.status === 'confirmed' && booking.meeting_link && (
              <Button 
                onClick={() => window.open(booking.meeting_link, '_blank')}
                size="sm"
              >
                <Video className="h-4 w-4 mr-1" />
                Join Meeting
              </Button>
            )}

            {booking.status === 'confirmed' && isUpcoming && (
              <Button variant="outline" size="sm">
                <MessageCircle className="h-4 w-4 mr-1" />
                Message Provider
              </Button>
            )}

            {(booking.status === 'pending' || booking.status === 'confirmed') && isUpcoming && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setSelectedBooking(booking)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel Booking
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Booking</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p>Are you sure you want to cancel this booking? Please provide a reason:</p>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason for cancellation..."
                    />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => {
                        setSelectedBooking(null);
                        setCancelReason('');
                      }}>
                        Keep Booking
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleCancelBooking(booking.id, cancelReason)}
                        disabled={!cancelReason.trim() || actionLoading === booking.id}
                      >
                        {actionLoading === booking.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Cancel Booking
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {booking.status === 'completed' && (
              <Button variant="outline" size="sm">
                <Star className="h-4 w-4 mr-1" />
                Leave Review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <Text color="secondary">Loading bookings...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <H1 className="mb-2">My Bookings</H1>
          <Text color="secondary">
            View and manage your service bookings
          </Text>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-card border rounded-lg p-8 text-center">
            <H3 className="mb-2">No Bookings Yet</H3>
            <Text color="secondary" className="mb-4">
              When you book services from providers, they will appear here.
            </Text>
            <Button variant="outline" onClick={() => window.location.href = '/discover'}>
              Discover Services
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter by status */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm">All ({bookings.length})</Button>
              <Button variant="outline" size="sm">
                Pending ({bookings.filter(b => b.status === 'pending').length})
              </Button>
              <Button variant="outline" size="sm">
                Confirmed ({bookings.filter(b => b.status === 'confirmed').length})
              </Button>
              <Button variant="outline" size="sm">
                Completed ({bookings.filter(b => b.status === 'completed').length})
              </Button>
            </div>

            {/* Bookings List */}
            <div>
              {bookings.map(renderBookingCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}