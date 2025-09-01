import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Video, CheckCircle, Clock, MapPin, X, Star, Loader2, Phone, Users } from "lucide-react";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { toast } from "sonner";
import { useAuth} from "@/contexts/PrivyAuthContext";
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
  customer?: {
    display_name: string;
    email: string;
    avatar?: string;
  };
}

export default function MyOrders() {
  const { user } = useWeb3Auth();
  const [orders, setOrders] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Load orders data (provider bookings)
  useEffect(() => {
    const loadOrders = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const providerBookings = await ApiClient.getUserBookings('provider');
        setOrders(providerBookings);
      } catch (error) {
        console.error('Failed to load orders:', error);
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user]);

  const handleStatusUpdate = async (bookingId: string, status: 'confirmed' | 'cancelled' | 'completed', notes?: string) => {
    setActionLoading(bookingId);
    try {
      await ApiClient.updateBookingStatus(bookingId, status, notes);
      
      // Reload orders
      const providerBookings = await ApiClient.getUserBookings('provider');
      setOrders(providerBookings);
      
      toast.success(`Order ${status} successfully`);
      setSelectedOrder(null);
      setCancelReason('');
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order');
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

  const renderOrderCard = (order: Booking) => {
    const customer = order.customer;
    const scheduledDate = parseISO(order.scheduled_at);
    const isUpcoming = isFuture(scheduledDate);
    const isPassed = isPast(scheduledDate);

    return (
      <Card key={order.id} className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={customer?.avatar || ""} alt={customer?.display_name || "Customer"} />
                <AvatarFallback>
                  {customer?.display_name?.charAt(0) || customer?.email?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{order.services?.title}</CardTitle>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>Customer: {customer?.display_name || customer?.email}</span>
                  <span>•</span>
                  <span>{order.services?.categories?.name}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(order.status)}
              <div className="text-sm text-muted-foreground mt-1">
                Order #{order.id.slice(-8)}
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
                {isPassed && order.status === 'pending' && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                {getLocationIcon(order.is_online, !!order.location)}
                <span>{getLocationText(order.is_online, !!order.location)}</span>
                {order.location && !order.is_online && <span>• {order.location}</span>}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="font-medium">${order.total_price}</span>
                <span>• {order.duration_minutes} minutes</span>
              </div>
            </div>
            <div className="space-y-2">
              {order.customer_notes && (
                <div>
                  <div className="text-sm font-medium">Customer Notes:</div>
                  <div className="text-sm text-muted-foreground">{order.customer_notes}</div>
                </div>
              )}
              {order.provider_notes && (
                <div>
                  <div className="text-sm font-medium">Your Notes:</div>
                  <div className="text-sm text-muted-foreground">{order.provider_notes}</div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex space-x-2">
            {order.status === 'pending' && (
              <>
                <Button
                  onClick={() => handleStatusUpdate(order.id, 'confirmed')}
                  disabled={actionLoading === order.id}
                  size="sm"
                >
                  {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Accept Order
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Decline Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p>Please provide a reason for declining this order:</p>
                      <Textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for declining..."
                      />
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => {
                          setSelectedOrder(null);
                          setCancelReason('');
                        }}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleStatusUpdate(order.id, 'cancelled', cancelReason)}
                          disabled={!cancelReason.trim() || actionLoading === order.id}
                        >
                          {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Decline Order
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            
            {order.status === 'confirmed' && !isUpcoming && (
              <Button
                onClick={() => handleStatusUpdate(order.id, 'completed')}
                disabled={actionLoading === order.id}
                size="sm"
              >
                {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Mark as Completed
              </Button>
            )}

            {(order.status === 'confirmed' || order.status === 'pending') && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Order</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p>Please provide a reason for cancelling this order:</p>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason for cancellation..."
                    />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => {
                        setSelectedOrder(null);
                        setCancelReason('');
                      }}>
                        Keep Order
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleStatusUpdate(order.id, 'cancelled', cancelReason)}
                        disabled={!cancelReason.trim() || actionLoading === order.id}
                      >
                        {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Cancel Order
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Orders</h1>
          <p className="text-muted-foreground">
            Manage service requests from customers
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-card border rounded-lg p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">No Orders Yet</h3>
            <p className="text-muted-foreground mb-4">
              When customers book your services, their orders will appear here.
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/provider/services'}>
              Manage Services
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter by status */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm">All ({orders.length})</Button>
              <Button variant="outline" size="sm">
                Pending ({orders.filter(o => o.status === 'pending').length})
              </Button>
              <Button variant="outline" size="sm">
                Confirmed ({orders.filter(o => o.status === 'confirmed').length})
              </Button>
              <Button variant="outline" size="sm">
                Completed ({orders.filter(o => o.status === 'completed').length})
              </Button>
            </div>

            {/* Orders List */}
            <div>
              {orders.map(renderOrderCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}