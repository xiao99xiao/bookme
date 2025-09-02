import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, DollarSign, Calendar, Phone, Video, Users, X, Star, ArrowLeft, Loader2, MessageSquare, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import BookingTimeSlots from "@/components/BookingTimeSlots";
import StarRating from "@/components/StarRating";
import { toast } from "sonner";
import { getBrowserTimezone } from "@/lib/timezone";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface Service {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  category_id?: string;
  price: number;
  duration_minutes: number;
  location?: string;
  is_online: boolean;
  images?: string[];
  tags?: string[];
  requirements?: string;
  cancellation_policy?: string;
  is_visible?: boolean;
  created_at: string;
  updated_at: string;
  categories?: {
    name: string;
    icon?: string;
    color?: string;
  };
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  phone: string | null;
  is_verified: boolean;
  rating: number;
  review_count: number;
  total_earnings: number;
  total_spent: number;
  is_provider: boolean;
  provider_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  service_id: string;
  rating: number;
  comment: string;
  is_public: boolean;
  created_at: string;
  services?: {
    title: string;
  };
  reviewer?: {
    display_name: string;
    avatar: string;
  };
}

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const { user: currentUser, profile: currentProfile, loading: authLoading, userId: currentUserId } = useAuth();
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsDisplayCount, setReviewsDisplayCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  // Determine which user's profile to show
  const targetUserId = userId || currentUserId;
  // Dynamic check for own profile that works even during auth loading
  const isOwnProfile = targetUserId && currentUserId && targetUserId === currentUserId;
  
  // Debug logging
  console.log('Profile page params:', { userId, targetUserId, currentUserId, isOwnProfile });

  // Load profile and services data immediately
  useEffect(() => {
    const loadProfileData = async () => {
      console.log('Loading profile data for:', targetUserId);
      
      if (!targetUserId) {
        console.log('No target user ID, setting error');
        setError('User not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Starting profile data load...');

        // Set a timeout to prevent infinite loading
        const loadTimeout = setTimeout(() => {
          console.warn('Profile loading timeout');
          setError('Profile loading timed out. Please try again.');
          setLoading(false);
        }, 10000);

        try {
          console.log('Fetching profile for user:', targetUserId);
          // Always fetch the profile data from API
          const profileData = await ApiClient.getUserProfileById(targetUserId);
          console.log('Profile fetched:', profileData);
          setProfile(profileData);

          console.log('Fetching services for user:', targetUserId);
          // Fetch services for the target user
          // Get viewer's timezone to properly display service time slots
          const viewerTimezone = profile?.timezone || getBrowserTimezone();
          const servicesData = await ApiClient.getUserServicesById(targetUserId, viewerTimezone);
          console.log('Services fetched:', servicesData?.length || 0, 'services');
          setServices(servicesData);
          
          // Fetch reviews for the provider
          if (profileData.is_provider) {
            console.log('Fetching reviews for provider:', targetUserId);
            const reviewsData = await ApiClient.getProviderReviews(targetUserId);
            console.log('Reviews fetched:', reviewsData?.length || 0, 'reviews');
            setReviews(reviewsData);
          }
          
          clearTimeout(loadTimeout);
        } catch (apiError) {
          clearTimeout(loadTimeout);
          throw apiError;
        }
      } catch (error) {
        console.error('Failed to load profile data:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          targetUserId,
          fromDiscover: searchParams.get('service')
        });
        
        setError(`Failed to load profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [targetUserId]);

  // Separate effect to handle auth-dependent UI updates
  useEffect(() => {
    console.log('Auth status changed:', { 
      authLoading, 
      currentUserId, 
      targetUserId, 
      isOwnProfile: targetUserId === currentUserId 
    });
  }, [authLoading, currentUserId, targetUserId]);

  // Handle service pre-selection from query parameter (from Discover page)
  useEffect(() => {
    const serviceId = searchParams.get('service');
    if (serviceId && services.length > 0) {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        console.log('Pre-selecting service from query param:', service.title);
        setSelectedService(service);
        setSelectedTimeSlot(null);
        setCustomerNotes('');
      }
    }
  }, [searchParams, services]);

  const getLocationIcon = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return <Video className="h-3.5 w-3.5" />;
    if (hasLocation) return <Users className="h-3.5 w-3.5" />;
    return <Phone className="h-3.5 w-3.5" />;
  };

  const getLocationText = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return "Online";
    if (hasLocation) return "In Person";
    return "Phone Call";
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setSelectedTimeSlot(null); // Reset time slot when selecting new service
    setCustomerNotes(''); // Reset notes
  };

  const handleBookingSubmit = async () => {
    if (!selectedService || !selectedTimeSlot || !currentUserId || !profile) {
      toast.error('Please select a time slot');
      return;
    }

    setIsBooking(true);
    try {
      const bookingData = {
        service_id: selectedService.id,
        provider_id: profile.id,
        scheduled_at: selectedTimeSlot.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        total_price: selectedService.price,
        customer_notes: customerNotes.trim() || undefined,
        location: selectedService.location,
        is_online: selectedService.is_online
      };

      console.log('Booking data:', bookingData);
      const booking = await ApiClient.createBooking(bookingData, currentUserId);
      
      toast.success('Booking request submitted successfully!');
      
      // Reset form
      setSelectedService(null);
      setSelectedTimeSlot(null);
      setCustomerNotes('');
      
      // Optional: Redirect to bookings page
      // navigate('/my-bookings');
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Failed to create booking. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || 'This profile does not exist or could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Main Content */}
        <div className={cn(
          "transition-all duration-300 ease-in-out h-screen overflow-y-auto pt-20",
          selectedService ? "w-1/2" : "w-full"
        )}>
          <div className="max-w-lg mx-auto py-8 px-6">
            {/* User Profile Section */}
            <div className="mb-12">
              <div className="text-center mb-10">
                <Avatar className="h-20 w-20 mx-auto mb-6">
                  <AvatarImage src={profile.avatar || ""} alt={profile.display_name || "User"} />
                  <AvatarFallback className="text-lg bg-muted text-foreground">
                    {profile.display_name?.charAt(0) || profile.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <h1 className="text-2xl font-medium text-foreground mb-2">
                  {profile.display_name || profile.email?.split('@')[0] || 'User'}
                </h1>
                {profile.location && (
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{profile.location}</span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <StarRating value={profile.rating} readonly size="sm" />
                  <span className="font-medium">{profile.rating.toFixed(1)}</span>
                  <span>({profile.review_count} {profile.review_count === 1 ? 'review' : 'reviews'})</span>
                </div>
              </div>
              
              {profile.bio && (
                <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                  <ReactMarkdown>{profile.bio}</ReactMarkdown>
                </div>
              )}
            </div>

            {/* Services Section */}
            {(profile.is_provider || services.length > 0) && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-foreground mb-1">Services</h2>
                  <p className="text-sm text-muted-foreground">
                    {isOwnProfile ? "Your services" : "Choose a service to book"}
                  </p>
                </div>
                
                {services.filter(service => service.is_visible !== false).length > 0 ? (
                  <div className="space-y-3">
                    {services.filter(service => service.is_visible !== false).map((service) => (
                      <div 
                        key={service.id} 
                        className="border rounded-lg p-4 transition-colors cursor-pointer hover:bg-muted/50"
                        onClick={() => handleServiceClick(service)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {service.categories?.name || 'General'}
                            </Badge>
                            <div className="flex items-center text-muted-foreground text-xs">
                              {getLocationIcon(service.is_online, !!service.location)}
                              <span className="ml-1">{getLocationText(service.is_online, !!service.location)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">${service.price}</div>
                            <div className="text-xs text-muted-foreground">{service.duration_minutes}m</div>
                          </div>
                        </div>
                        
                        <h3 className="text-sm font-medium mb-2">
                          {service.title}
                        </h3>
                        
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {service.description}
                        </p>
                        
                        {service.tags && service.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {service.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>{isOwnProfile ? "You haven't created any services yet." : "No services available."}</p>
                  </div>
                )}
              </div>
            )}

            {/* Reviews Section */}
            {profile?.is_provider && reviews.length > 0 && (
              <div className="mt-12">
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-foreground mb-1">Reviews</h2>
                  <p className="text-sm text-muted-foreground">
                    What customers are saying ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                  </p>
                </div>
                
                <div className="space-y-4">
                  {reviews.slice(0, reviewsDisplayCount).map((review) => (
                    <Card key={review.id} className="hover:bg-muted/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={review.reviewer?.avatar} />
                              <AvatarFallback>
                                {review.reviewer?.display_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {review.reviewer?.display_name || 'Anonymous'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {review.services?.title}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <StarRating value={review.rating} readonly size="sm" />
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(review.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      {review.comment && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {review.comment}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
                
                {/* Load More Button */}
                {reviews.length > reviewsDisplayCount && (
                  <div className="mt-6 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewsDisplayCount(prev => prev + 5)}
                      className="gap-2"
                    >
                      <span>Load more reviews</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel - Original Design */}
        {selectedService && (
          <div className="w-1/2 bg-background h-screen overflow-y-auto border-l">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-8 pb-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedService(null)}
                    className="h-8 w-8 p-0 hover:bg-muted rounded"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-medium text-foreground">{selectedService.title}</h2>
                </div>
              </div>
              
              <div className="space-y-8">
                {/* Service Details */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="secondary" 
                      className="bg-muted text-foreground border-0 rounded text-xs font-normal px-2 py-1"
                    >
                      {selectedService.categories?.name || 'General'}
                    </Badge>
                    <div className="flex items-center text-muted-foreground text-xs">
                      {getLocationIcon(selectedService.is_online, !!selectedService.location)}
                      <span className="ml-1">{getLocationText(selectedService.is_online, !!selectedService.location)}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">About</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{selectedService.description}</p>
                    
                    {selectedService.tags && selectedService.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedService.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-medium text-foreground">${selectedService.price}</div>
                        <div className="text-xs text-muted-foreground">Total price</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">{selectedService.duration_minutes} min</div>
                        <div className="text-xs text-muted-foreground">Duration</div>
                      </div>
                    </div>
                  </div>
                </div>

                {isOwnProfile ? (
                  /* Own Service View */
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="mb-2">This is your service</p>
                    <p className="text-sm">Other users can book this service from your profile page</p>
                  </div>
                ) : (
                  <>
                    {/* Time Slot Selection */}
                    <BookingTimeSlots
                      onSlotSelect={setSelectedTimeSlot}
                      selectedSlot={selectedTimeSlot}
                      service={{
                        duration_minutes: selectedService.duration_minutes,
                        is_online: selectedService.is_online,
                        location: selectedService.location
                      }}
                    />

                    {/* Customer Notes */}
                    <div>
                      <Label htmlFor="customer-notes" className="text-sm font-medium">
                        Additional Notes (Optional)
                      </Label>
                      <Textarea
                        id="customer-notes"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="Tell the provider anything specific about your booking..."
                        className="mt-2 min-h-[80px]"
                        maxLength={500}
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {customerNotes.length}/500 characters
                      </div>
                    </div>

                    {/* Confirm Button */}
                    <div className="pt-6">
                      <Button 
                        className="w-full h-9 text-sm font-medium rounded disabled:opacity-50" 
                        disabled={authLoading || !selectedTimeSlot || isBooking}
                        onClick={handleBookingSubmit}
                      >
                        {authLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : isBooking ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Booking...
                          </>
                        ) : selectedTimeSlot ? (
                          'Confirm booking'
                        ) : (
                          'Select a time'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;