import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge as DSBadge } from "@/design-system";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, DollarSign, Calendar, Phone, Video, Users, X, Star, ArrowLeft, MessageSquare, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { usePrivy } from "@privy-io/react-auth";
import { ApiClient } from "@/lib/api-migration";
import CustomDatePicker from "@/components/CustomDatePicker";
import StarRating from "@/components/StarRating";
import { toast } from "sonner";
import { getBrowserTimezone } from "@/lib/timezone";
import { H1, Text, Description, ServiceProfileCard, Loading, Badge } from '@/design-system';
import ReviewCommentDialog from "@/components/ReviewCommentDialog";
import { ProfileHeader } from "@/components/ProfileHeader";
import { SimpleServiceCard } from "@/components/SimpleServiceCard";
import { SimpleReviewItem } from "@/components/SimpleReviewItem";
import { useBlockchainService } from "@/lib/blockchain-service";
import { usePaymentTransaction } from "@/hooks/useTransaction";
import { PaymentModal } from "@/components/TransactionModal";
import { BlockchainErrorHandler } from "@/lib/blockchain-errors";

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
  const { userId, username } = useParams<{ userId?: string; username?: string }>();
  const [searchParams] = useSearchParams();
  const { user: currentUser, profile: currentProfile, loading: authLoading, userId: currentUserId } = useAuth();
  const { getAccessToken } = usePrivy();
  
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
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  // Blockchain payment integration
  const { blockchainService, initializeService } = useBlockchainService();
  const paymentTransaction = usePaymentTransaction();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // State for resolved user data
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  
  // Determine which user's profile to show
  const targetUserId = resolvedUserId || userId || currentUserId;
  // Dynamic check for own profile that works even during auth loading
  const isOwnProfile = targetUserId && currentUserId && targetUserId === currentUserId;
  
  // Debug logging
  console.log('Profile page params:', { userId, username, targetUserId, currentUserId, isOwnProfile });

  // Resolve username to userId if needed
  useEffect(() => {
    const resolveUsername = async () => {
      if (username && !userId) {
        try {
          const userData = await ApiClient.getPublicUserByUsername(username);
          setResolvedUserId(userData.id);
        } catch (error) {
          console.error('Failed to resolve username:', error);
          setError('User not found');
          setLoading(false);
        }
      } else if (userId) {
        setResolvedUserId(userId);
      }
    };

    resolveUsername();
  }, [username, userId]);

  // Load profile and services data immediately
  useEffect(() => {
    const loadProfileData = async () => {
      console.log('Loading profile data for:', targetUserId);
      
      // Wait for username resolution if needed
      if (username && !resolvedUserId) {
        console.log('Still resolving username, waiting...');
        return;
      }
      
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
          const profileData = await ApiClient.getPublicUserProfile(targetUserId);
          console.log('Profile fetched:', profileData);
          setProfile(profileData);

          console.log('Fetching services for user:', targetUserId);
          // Fetch services for the target user
          // Get viewer's timezone to properly display service time slots
          const viewerTimezone = profile?.timezone || getBrowserTimezone();
          const servicesData = await ApiClient.getPublicUserServices(targetUserId, viewerTimezone);
          console.log('Services fetched:', servicesData?.length || 0, 'services');
          setServices(servicesData);
          
          // Fetch reviews for the user (if they have services, they might have reviews)
          console.log('Fetching reviews for user:', targetUserId);
          const reviewsData = await ApiClient.getProviderReviews(targetUserId);
          console.log('Reviews fetched:', reviewsData?.length || 0, 'reviews');
          setReviews(reviewsData);
          
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
  }, [targetUserId, resolvedUserId, username]);

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

  const truncateComment = (comment: string, maxLength: number = 150) => {
    if (comment.length <= maxLength) return comment;
    return comment.slice(0, maxLength).trim() + '...';
  };

  const shouldTruncateComment = (comment: string, maxLength: number = 150) => {
    return comment.length > maxLength;
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

    // Users automatically have smart wallets via Privy - no need to check wallet connection
    setIsBooking(true);
    try {
      // Step 1: Create booking and get payment authorization
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

      console.log('Creating booking with blockchain payment...', bookingData);
      
      // Create booking - backend should return both booking and payment authorization
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`
        },
        body: JSON.stringify(bookingData)
      });

      if (!response.ok) {
        throw new Error('Failed to create booking');
      }

      const { authorization, signature } = await response.json();
      console.log('Booking created, starting payment...', { authorization });

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
      console.error('Booking error:', error);
      BlockchainErrorHandler.logError(error, 'Booking Creation');
      
      const errorMessage = BlockchainErrorHandler.getErrorMessage(error);
      toast.error(errorMessage);
      
      setIsBooking(false);
      setShowPaymentModal(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <Loading variant="spinner" size="lg" text="Loading profile..." />
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
          <Text color="secondary" className="mb-4">{error || 'This profile does not exist or could not be loaded.'}</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Main Content */}
        <div className={cn(
          "transition-all duration-300 ease-in-out h-screen overflow-y-auto pt-20 bg-white",
          selectedService ? "w-1/2" : "w-full"
        )}>
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex flex-col gap-16">
              {/* User Profile Section */}
              <div className="flex flex-col gap-10 items-center">
                <div className="w-full">
                  <ProfileHeader profile={profile} />
                </div>
              </div>
              
              {/* Bio Section */}
              {profile.bio && (
                <div className="font-['Baloo_2'] text-[16px] font-normal text-black leading-[1.5] w-full prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="font-['Baloo_2'] text-[16px] font-normal text-black leading-[1.5] mb-4">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-4">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-4">{children}</ol>,
                      li: ({ children }) => <li className="font-['Baloo_2'] text-[16px] font-normal text-black leading-[1.5] mb-1">{children}</li>,
                      h1: ({ children }) => <h1 className="font-['Spectral'] text-2xl font-bold mb-3">{children}</h1>,
                      h2: ({ children }) => <h2 className="font-['Spectral'] text-xl font-bold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="font-['Spectral'] text-lg font-bold mb-2">{children}</h3>,
                      a: ({ children, href }) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4">{children}</blockquote>,
                      code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>,
                      pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded overflow-x-auto mb-4">{children}</pre>,
                      hr: () => <div className="w-full h-px bg-[#eeeeee] my-6"></div>,
                    }}
                  >
                    {profile.bio}
                  </ReactMarkdown>
                </div>
              )}
              
              {/* Divider Line */}
              <div className="w-full h-px bg-[#eeeeee]"></div>

              {/* Services Section */}
              {(profile.is_provider || services.length > 0) && (
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-['Spectral'] text-[20px] font-bold text-black leading-[1.4]">Services</h2>
                  </div>
                  
                  {services.filter(service => service.is_visible !== false).length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {services.filter(service => service.is_visible !== false).map((service) => (
                        <SimpleServiceCard
                          key={service.id}
                          service={service}
                          onClick={handleServiceClick}
                        />
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
              {((profile?.is_provider || services.length > 0) && reviews.length > 0) && (
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-['Spectral'] text-[20px] font-bold text-black leading-[1.4]">Customer Review</h2>
                  </div>
                  
                  <div className="flex flex-col gap-10">
                    {reviews.slice(0, reviewsDisplayCount).map((review) => (
                      <SimpleReviewItem
                        key={review.id}
                        review={review}
                        onRevealComment={() => setSelectedReview(review)}
                        isCommentTruncated={shouldTruncateComment(review.comment)}
                      />
                    ))}
                  </div>
                  
                  {/* Load More Button */}
                  {reviews.length > reviewsDisplayCount && (
                    <div className="text-center">
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
        </div>

        {/* Detail Panel - Figma Design */}
        {selectedService && (
          <div className="w-1/2 bg-neutral-50 h-screen overflow-y-auto border-l border-gray-200">
            <div className="px-20 py-16 flex flex-col gap-10">
              
              {/* Header with Back Button */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedService(null)}
                  className="p-3 h-auto hover:bg-gray-100 rounded-[40px]"
                >
                  <ArrowLeft className="h-6 w-6" />
                </Button>
                <div className="flex flex-col gap-1 flex-1">
                  <h2 className="font-['Spectral'] text-[20px] font-bold text-black leading-[1.4]">Detail</h2>
                </div>
              </div>

              {/* Service Info Section */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="font-['Spectral'] text-[20px] font-bold text-black leading-[1.4]">{selectedService.title}</h1>
                </div>
                <p className="font-['Baloo_2'] text-[16px] font-normal text-black leading-[1.5]">
                  {selectedService.description}
                </p>
              </div>

              {/* Price Card */}
              <div className="bg-white border border-[#eeeeee] rounded-[16px] p-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-baseline text-[18px]">
                    <span className="font-['Baloo_2'] font-semibold text-black leading-[1.5]">${selectedService.price}</span>
                    <span className="font-['Baloo_2'] font-normal text-[#cccccc] text-center leading-[1.5]">|</span>
                    <span className="font-['Baloo_2'] font-semibold text-black leading-[1.5]">{selectedService.duration_minutes} minutes</span>
                  </div>
                  <div className="bg-[#f3f3f3] flex gap-1 items-center px-2 py-1 rounded-[8px]">
                    <Video className="h-5 w-5" />
                    <span className="font-['Baloo_2'] font-normal text-[#666666] text-[16px] leading-[1.5]">
                      {getLocationText(selectedService.is_online, !!selectedService.location)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#eeeeee]"></div>

              {isOwnProfile ? (
                /* Own Service View */
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-2">This is your service</p>
                  <p className="text-sm">Other users can book this service from your profile page</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Select Date Section */}
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-['Spectral'] text-[20px] font-bold text-black leading-[1.4]">Select Date</h3>
                    </div>
                    
                    {/* Custom Date Picker Component */}
                    <CustomDatePicker
                      onDateTimeSelect={setSelectedTimeSlot}
                      selectedDateTime={selectedTimeSlot}
                      serviceDuration={selectedService.duration_minutes}
                      serviceId={selectedService.id}
                      timezone={getBrowserTimezone()}
                    />
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-[#eeeeee]"></div>

                  {/* Additional Notes Section */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-['Spectral'] text-[20px] font-bold text-black leading-[1.4]">Additional Notes (Optional)</h3>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="bg-white border border-[#eeeeee] rounded-[8px] p-3 h-[120px] relative group">
                        <textarea
                          value={customerNotes}
                          onChange={(e) => setCustomerNotes(e.target.value)}
                          placeholder="Tell the provider anything specific about your booking..."
                          className="w-full h-full border-0 p-0 font-['Baloo_2'] text-[16px] font-normal leading-[1.5] text-black placeholder:text-[#aaaaaa] resize-none focus:ring-0 focus:outline-none bg-transparent"
                          maxLength={500}
                        />
                        {/* Resize grip indicator */}
                        <div className="absolute bottom-0.5 right-0.5 pointer-events-none">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 11L1 1" stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 6 6)"/>
                            <path d="M11 7L7 3" stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 6 6)"/>
                          </svg>
                        </div>
                      </div>
                      <p className="font-['Baloo_2'] text-[12px] font-normal text-[#aaaaaa] leading-[1.5]">
                        {customerNotes.length}/500 characters
                      </p>
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <div className="flex flex-col items-end">
                    <Button 
                      className="bg-black border border-black rounded-[40px] px-6 py-3 w-60 font-['Baloo_2'] font-semibold text-[16px] text-white leading-[1.5] hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" 
                      disabled={authLoading || !selectedTimeSlot || isBooking}
                      onClick={handleBookingSubmit}
                    >
                      {authLoading ? (
                        <Loading variant="inline" size="sm">
                          Loading...
                        </Loading>
                      ) : isBooking ? (
                        <Loading variant="inline" size="sm">
                          Processing...
                        </Loading>
                      ) : selectedTimeSlot ? (
                        `Pay ${selectedService.price} USDC`
                      ) : (
                        'Select a time'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Review Comment Dialog */}
      {selectedReview && (
        <ReviewCommentDialog
          isOpen={!!selectedReview}
          onClose={() => setSelectedReview(null)}
          review={selectedReview}
        />
      )}
      
      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setIsBooking(false);
        }}
        amount={selectedService?.price || 0}
        currency="USDC"
        status={{
          status: paymentTransaction.status,
          txHash: paymentTransaction.txHash,
          error: paymentTransaction.error,
          message: paymentTransaction.error || ''
        }}
        onRetry={() => {
          if (selectedService && selectedTimeSlot) {
            handleBookingSubmit();
          }
        }}
      />
    </div>
  );
};

export default Profile;