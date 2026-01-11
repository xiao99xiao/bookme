/**
 * PublicProfile - Themeable public user page
 *
 * This component renders the public-facing user profile with:
 * - Complete style isolation from the main app
 * - Support for preset themes and custom CSS
 * - Service listing and booking functionality
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Star, Video, Users, Phone, ChevronDown, ExternalLink, Twitter, Instagram, Youtube, Github, Linkedin, Globe, Mail, MessageCircle, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { usePrivy } from "@privy-io/react-auth";
import { ApiClient } from "@/lib/api-migration";
import CustomDatePicker from "@/components/CustomDatePicker";
import { toast } from "sonner";
import { getBrowserTimezone } from "@/lib/timezone";
import { Loading } from '@/design-system';
import ReviewCommentDialog from "@/components/ReviewCommentDialog";
import { useBlockchainService } from "@/lib/blockchain-service";
import { usePaymentTransaction } from "@/hooks/useTransaction";
import { PaymentModal } from "@/components/TransactionModal";
import { BlockchainErrorHandler } from "@/lib/blockchain-errors";
import { usePoints } from "@/hooks/usePoints";
import { useFunding } from "@/hooks/useFunding";

// Theme system imports
import {
  getTheme,
  mergeThemeWithSettings,
  themeToCSSVars,
  getThemeVersionAttribute,
  sanitizeCSS,
  ThemeConfig,
  ThemeSettings,
  ProfileButton,
  THEME_CLASS_PREFIX,
} from "@/lib/themes";

// Import isolated styles
import "./styles/public-profile.css";

// =====================================================
// Types
// =====================================================

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
  services?: { title: string };
  reviewer?: { display_name: string; avatar: string };
}

interface UserThemeData {
  theme: string;
  custom_css: string | null;
  settings: ThemeSettings;
}

// =====================================================
// Helper Functions
// =====================================================

const getLocationText = (isOnline: boolean, hasLocation: boolean): string => {
  if (isOnline) return "Online";
  if (hasLocation) return "In Person";
  return "Phone Call";
};

const getLocationIcon = (isOnline: boolean, hasLocation: boolean) => {
  if (isOnline) return Video;
  if (hasLocation) return Users;
  return Phone;
};

const shouldTruncateComment = (comment: string, maxLength: number = 150): boolean => {
  return comment.length > maxLength;
};

/**
 * Map icon name to Lucide icon component
 */
const getButtonIcon = (iconName?: string) => {
  if (!iconName) return ExternalLink;

  const iconMap: Record<string, typeof ExternalLink> = {
    twitter: Twitter,
    instagram: Instagram,
    youtube: Youtube,
    github: Github,
    linkedin: Linkedin,
    globe: Globe,
    website: Globe,
    email: Mail,
    mail: Mail,
    telegram: MessageCircle,
    discord: MessageCircle,
    link: ExternalLink,
  };

  return iconMap[iconName.toLowerCase()] || ExternalLink;
};

// =====================================================
// Component
// =====================================================

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loading: authLoading, userId: currentUserId } = useAuth();
  const { getAccessToken, authenticated } = usePrivy();

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsDisplayCount, setReviewsDisplayCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  // Theme state
  const [themeData, setThemeData] = useState<UserThemeData | null>(null);

  // Profile buttons state
  const [profileButtons, setProfileButtons] = useState<ProfileButton[]>([]);

  // Booking state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null);
  const [customerNotes, setCustomerNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  // Blockchain payment
  const { blockchainService, initializeService } = useBlockchainService();
  const paymentTransaction = usePaymentTransaction();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Points system
  const { balance: pointsBalance, formatPoints, formatUsdValue, calculateForService } = usePoints();
  const [usePointsForPayment, setUsePointsForPayment] = useState(false);
  const [pointsCalculation, setPointsCalculation] = useState<{
    pointsToUse: number;
    pointsValue: number;
    usdcToPay: number;
    originalPrice: number;
  } | null>(null);

  // Funding system
  const { fundWallet } = useFunding();
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Computed values
  const isOwnProfile = resolvedUserId && currentUserId && resolvedUserId === currentUserId;

  // Compute theme
  const currentTheme = useMemo<ThemeConfig>(() => {
    const baseTheme = getTheme(themeData?.theme || "default");
    if (themeData?.settings) {
      return mergeThemeWithSettings(baseTheme, themeData.settings);
    }
    return baseTheme;
  }, [themeData]);

  // Compute sanitized custom CSS
  const sanitizedCustomCSS = useMemo(() => {
    if (!themeData?.custom_css) return null;
    return sanitizeCSS(themeData.custom_css);
  }, [themeData?.custom_css]);

  // =====================================================
  // Data Loading
  // =====================================================

  // Resolve username to userId
  useEffect(() => {
    const resolveUsername = async () => {
      if (!username) {
        setError("User not found");
        setLoading(false);
        return;
      }

      try {
        const userData = await ApiClient.getPublicUserByUsername(username);
        setResolvedUserId(userData.id);
      } catch (err) {
        console.error("Failed to resolve username:", err);
        setError("User not found");
        setLoading(false);
      }
    };

    resolveUsername();
  }, [username]);

  // Load profile data and theme
  useEffect(() => {
    const loadData = async () => {
      if (!resolvedUserId) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch profile, services, reviews, theme, and buttons in parallel
        const [profileData, servicesData, reviewsData, themeResponse, buttonsResponse] = await Promise.all([
          ApiClient.getPublicUserProfile(resolvedUserId),
          ApiClient.getPublicUserServices(resolvedUserId, getBrowserTimezone()),
          ApiClient.getProviderReviews(resolvedUserId),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/${resolvedUserId}/theme`).then((r) =>
            r.ok ? r.json() : { theme: "default", custom_css: null, settings: {} }
          ),
          fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/${resolvedUserId}/buttons`).then((r) =>
            r.ok ? r.json() : { buttons: [] }
          ),
        ]);

        setProfile(profileData);
        setServices(servicesData);
        setReviews(reviewsData);
        setThemeData(themeResponse);
        setProfileButtons(buttonsResponse.buttons || []);
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [resolvedUserId]);

  // Handle service pre-selection from query parameter
  useEffect(() => {
    const serviceId = searchParams.get("service");
    if (serviceId && services.length > 0) {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        setSelectedService(service);
        setSelectedTimeSlot(null);
        setCustomerNotes("");
      }
    }
  }, [searchParams, services]);

  // Calculate points when service is selected and user has points
  useEffect(() => {
    const updatePointsCalculation = async () => {
      if (selectedService && pointsBalance > 0) {
        const calc = await calculateForService(selectedService.price);
        setPointsCalculation(calc);
      } else {
        setPointsCalculation(null);
      }
    };
    updatePointsCalculation();
  }, [selectedService, pointsBalance, calculateForService]);

  // =====================================================
  // Event Handlers
  // =====================================================

  // Fetch USDC balance
  const fetchUsdcBalance = async () => {
    if (!blockchainService) return;

    try {
      setLoadingBalance(true);
      await initializeService();
      const balance = await blockchainService.getUSDCBalance();
      setUsdcBalance(parseFloat(balance));
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      setUsdcBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Fetch balance when user selects a service and is authenticated
  useEffect(() => {
    if (selectedService && authenticated && currentUserId) {
      fetchUsdcBalance();
    }
  }, [selectedService, authenticated, currentUserId]);

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setSelectedTimeSlot(null);
    setCustomerNotes("");
    setUsePointsForPayment(false);
  };

  const handleBookingSubmit = async () => {
    if (!selectedService || !selectedTimeSlot || !currentUserId || !profile) {
      toast.error("Please select a time slot");
      return;
    }

    // Calculate required amount (after points if applicable)
    const requiredAmount = usePointsForPayment && pointsCalculation
      ? pointsCalculation.usdcToPay
      : selectedService.price;

    // Check if user has sufficient balance - if not, open funding flow directly
    if (usdcBalance !== null && usdcBalance < requiredAmount) {
      const shortfall = requiredAmount - usdcBalance;
      toast.info(`You need $${shortfall.toFixed(2)} more USDC. Opening funding...`);

      await fundWallet({
        onSuccess: (fundedAmount, pointsAwarded) => {
          // Refresh balance after funding
          fetchUsdcBalance();
          toast.success(`Wallet funded! Click Pay again to complete your booking.`);
        },
        onError: (error) => {
          console.error('Funding error:', error);
        }
      });
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
        is_online: selectedService.is_online,
        use_points: usePointsForPayment && pointsCalculation && pointsCalculation.pointsToUse > 0,
      };

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        throw new Error("Failed to create booking");
      }

      const { authorization, signature } = await response.json();

      await initializeService();
      setShowPaymentModal(true);

      await paymentTransaction.executePayment(async (onStatusChange) => {
        return await blockchainService.payForBooking(authorization, signature, onStatusChange);
      });
    } catch (err) {
      console.error("Booking error:", err);
      BlockchainErrorHandler.logError(err, "Booking Creation");
      toast.error(BlockchainErrorHandler.getErrorMessage(err));
      setIsBooking(false);
      setShowPaymentModal(false);
    }
  };

  // =====================================================
  // Render
  // =====================================================

  // Loading state
  if (loading) {
    return (
      <div className={`${THEME_CLASS_PREFIX}-container`} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loading variant="spinner" size="lg" text="Loading profile..." />
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className={`${THEME_CLASS_PREFIX}-container`} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>😕</div>
          <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px", color: "var(--pp-text-primary)" }}>Profile Not Found</h2>
          <p style={{ color: "var(--pp-text-secondary)" }}>{error || "This profile does not exist or could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const visibleServices = services.filter((s) => s.is_visible !== false);
  const LocationIcon = selectedService ? getLocationIcon(selectedService.is_online, !!selectedService.location) : Video;

  return (
    <div
      className={`${THEME_CLASS_PREFIX}-container`}
      style={themeToCSSVars(currentTheme)}
      data-theme-version={getThemeVersionAttribute(currentTheme)}
    >
      {/* Inject custom CSS if any */}
      {sanitizedCustomCSS && (
        <style dangerouslySetInnerHTML={{ __html: sanitizedCustomCSS }} />
      )}

      {/* Edit Banner - shown when viewing own profile */}
      {isOwnProfile && (
        <div className={`${THEME_CLASS_PREFIX}-edit-banner`}>
          <div className={`${THEME_CLASS_PREFIX}-edit-banner-content`}>
            <span className={`${THEME_CLASS_PREFIX}-edit-banner-text`}>
              You're viewing your public page
            </span>
            <button
              onClick={() => navigate("/host/page")}
              className={`${THEME_CLASS_PREFIX}-edit-banner-button`}
            >
              <Pencil style={{ width: 14, height: 14 }} />
              Edit Page
            </button>
          </div>
        </div>
      )}

      <div className={`${THEME_CLASS_PREFIX}-layout`}>
        {/* Main Content */}
        <div className={`${THEME_CLASS_PREFIX}-main ${selectedService ? "with-sidebar" : ""}`}>
          <div className={`${THEME_CLASS_PREFIX}-content`}>
            {/* Header */}
            <div className={`${THEME_CLASS_PREFIX}-header`}>
              <div className={`${THEME_CLASS_PREFIX}-avatar`}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.display_name || "User"} />
                ) : (
                  <div className={`${THEME_CLASS_PREFIX}-avatar-fallback`}>
                    {profile.display_name?.charAt(0) || profile.email?.charAt(0) || "U"}
                  </div>
                )}
              </div>
              <div className={`${THEME_CLASS_PREFIX}-header-info`}>
                <h1 className={`${THEME_CLASS_PREFIX}-name`}>
                  {profile.display_name || profile.email?.split("@")[0] || "User"}
                </h1>
                <div className={`${THEME_CLASS_PREFIX}-badges`}>
                  {profile.location && (
                    <span className={`${THEME_CLASS_PREFIX}-badge`}>
                      <MapPin className={`${THEME_CLASS_PREFIX}-badge-icon`} />
                      {profile.location}
                    </span>
                  )}
                  <span className={`${THEME_CLASS_PREFIX}-badge`}>
                    <Star className={`${THEME_CLASS_PREFIX}-badge-icon`} style={{ fill: "currentColor" }} />
                    {profile.rating.toFixed(1)} ({profile.review_count} notes)
                  </span>
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className={`${THEME_CLASS_PREFIX}-bio`}>
                <ReactMarkdown>{profile.bio}</ReactMarkdown>
              </div>
            )}

            {/* Profile Link Buttons */}
            {profileButtons.length > 0 && (
              <div className={`${THEME_CLASS_PREFIX}-link-buttons`}>
                {profileButtons.map((button) => {
                  const ButtonIcon = getButtonIcon(button.icon);
                  return (
                    <a
                      key={button.id}
                      href={button.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${THEME_CLASS_PREFIX}-link-button`}
                    >
                      <ButtonIcon className={`${THEME_CLASS_PREFIX}-link-button-icon`} />
                      <span className={`${THEME_CLASS_PREFIX}-link-button-label`}>{button.label}</span>
                    </a>
                  );
                })}
              </div>
            )}

            <div className={`${THEME_CLASS_PREFIX}-divider`} />

            {/* Services */}
            {(profile.is_provider || visibleServices.length > 0) && (
              <>
                <h2 className={`${THEME_CLASS_PREFIX}-section-title`}>Talks</h2>
                {visibleServices.length > 0 ? (
                  <div className={`${THEME_CLASS_PREFIX}-services`}>
                    {visibleServices.map((service) => {
                      const ServiceLocationIcon = getLocationIcon(service.is_online, !!service.location);
                      return (
                        <div
                          key={service.id}
                          className={`${THEME_CLASS_PREFIX}-service-card ${selectedService?.id === service.id ? "selected" : ""}`}
                          onClick={() => handleServiceClick(service)}
                        >
                          <div className={`${THEME_CLASS_PREFIX}-service-header`}>
                            <div>
                              <h3 className={`${THEME_CLASS_PREFIX}-service-title`}>{service.title}</h3>
                              <p className={`${THEME_CLASS_PREFIX}-service-description`}>{service.description}</p>
                            </div>
                          </div>
                          <div className={`${THEME_CLASS_PREFIX}-service-meta`}>
                            <span className={`${THEME_CLASS_PREFIX}-service-price`}>${service.price}</span>
                            <span className={`${THEME_CLASS_PREFIX}-service-duration`}>• {service.duration_minutes} min</span>
                            <span className={`${THEME_CLASS_PREFIX}-service-location-badge`}>
                              <ServiceLocationIcon style={{ width: 14, height: 14 }} />
                              {getLocationText(service.is_online, !!service.location)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ textAlign: "center", padding: "32px", color: "var(--pp-text-secondary)" }}>
                    {isOwnProfile ? "You haven't created any Talks yet." : "No Talks available."}
                  </p>
                )}

                <div className={`${THEME_CLASS_PREFIX}-divider`} />
              </>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <>
                <h2 className={`${THEME_CLASS_PREFIX}-section-title`}>Visitor Notes</h2>
                <div className={`${THEME_CLASS_PREFIX}-reviews`}>
                  {reviews.slice(0, reviewsDisplayCount).map((review) => (
                    <div key={review.id} className={`${THEME_CLASS_PREFIX}-review-item`}>
                      <div className={`${THEME_CLASS_PREFIX}-review-content`}>
                        "{review.comment}"
                        {shouldTruncateComment(review.comment) && (
                          <button
                            onClick={() => setSelectedReview(review)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--pp-accent)",
                              cursor: "pointer",
                              marginLeft: 8,
                              fontSize: 14,
                            }}
                          >
                            Read more
                          </button>
                        )}
                      </div>
                      <div className={`${THEME_CLASS_PREFIX}-review-rating`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`${THEME_CLASS_PREFIX}-star`} />
                        ))}
                        <span className={`${THEME_CLASS_PREFIX}-rating-text`}>{review.rating}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
                {reviews.length > reviewsDisplayCount && (
                  <button
                    className={`${THEME_CLASS_PREFIX}-load-more`}
                    onClick={() => setReviewsDisplayCount((prev) => prev + 5)}
                  >
                    <ChevronDown style={{ width: 16, height: 16, marginRight: 8 }} />
                    Load more notes
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Booking Sidebar */}
        {selectedService && (
          <div className={`${THEME_CLASS_PREFIX}-sidebar`}>
            <div className={`${THEME_CLASS_PREFIX}-booking-panel`}>
              <button
                className={`${THEME_CLASS_PREFIX}-booking-back`}
                onClick={() => setSelectedService(null)}
              >
                <ArrowLeft style={{ width: 20, height: 20 }} />
                Back
              </button>

              <h2 className={`${THEME_CLASS_PREFIX}-booking-service-title`}>{selectedService.title}</h2>
              <p className={`${THEME_CLASS_PREFIX}-booking-service-description`}>{selectedService.description}</p>

              <div className={`${THEME_CLASS_PREFIX}-price-card`}>
                <div>
                  <span className={`${THEME_CLASS_PREFIX}-price-amount`}>${selectedService.price}</span>
                  <span className={`${THEME_CLASS_PREFIX}-price-duration`}> / {selectedService.duration_minutes} min</span>
                </div>
                <span className={`${THEME_CLASS_PREFIX}-service-location-badge`}>
                  <LocationIcon style={{ width: 16, height: 16 }} />
                  {getLocationText(selectedService.is_online, !!selectedService.location)}
                </span>
              </div>

              <div className={`${THEME_CLASS_PREFIX}-divider`} />

              {isOwnProfile ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--pp-text-secondary)" }}>
                  <p style={{ marginBottom: 8 }}>This is your service</p>
                  <p style={{ fontSize: 14 }}>Other users can book this service from your profile page</p>
                </div>
              ) : (
                <>
                  <h3 className={`${THEME_CLASS_PREFIX}-booking-section-title`}>Select Date</h3>
                  <CustomDatePicker
                    onDateTimeSelect={setSelectedTimeSlot}
                    selectedDateTime={selectedTimeSlot}
                    serviceDuration={selectedService.duration_minutes}
                    serviceId={selectedService.id}
                    timezone={getBrowserTimezone()}
                  />

                  <div className={`${THEME_CLASS_PREFIX}-divider`} />

                  {/* Points Usage Option */}
                  {pointsBalance > 0 && pointsCalculation && pointsCalculation.pointsToUse > 0 && (
                    <>
                      <div className={`${THEME_CLASS_PREFIX}-points-section`}>
                        <div className={`${THEME_CLASS_PREFIX}-points-header`}>
                          <h3 className={`${THEME_CLASS_PREFIX}-booking-section-title`} style={{ marginBottom: 0 }}>
                            Use Points
                          </h3>
                          <span className={`${THEME_CLASS_PREFIX}-points-balance`}>
                            Balance: {formatPoints(pointsBalance)} pts ({formatUsdValue(pointsBalance)})
                          </span>
                        </div>
                        <label className={`${THEME_CLASS_PREFIX}-points-toggle`}>
                          <input
                            type="checkbox"
                            checked={usePointsForPayment}
                            onChange={(e) => setUsePointsForPayment(e.target.checked)}
                          />
                          <span className={`${THEME_CLASS_PREFIX}-points-label`}>
                            Use {formatPoints(pointsCalculation.pointsToUse)} points (-${pointsCalculation.pointsValue.toFixed(2)})
                          </span>
                        </label>
                        <p className={`${THEME_CLASS_PREFIX}-points-note`}>
                          Max 5% of service price can be paid with points
                        </p>
                      </div>
                      <div className={`${THEME_CLASS_PREFIX}-divider`} />
                    </>
                  )}

                  <h3 className={`${THEME_CLASS_PREFIX}-booking-section-title`}>Additional Notes (Optional)</h3>
                  <textarea
                    className={`${THEME_CLASS_PREFIX}-booking-notes`}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Tell the host anything specific about your booking..."
                    maxLength={500}
                  />

                  {/* Payment Summary */}
                  {usePointsForPayment && pointsCalculation && pointsCalculation.pointsToUse > 0 && (
                    <div className={`${THEME_CLASS_PREFIX}-payment-summary`}>
                      <div className={`${THEME_CLASS_PREFIX}-payment-row`}>
                        <span>Service Price</span>
                        <span>${selectedService.price.toFixed(2)}</span>
                      </div>
                      <div className={`${THEME_CLASS_PREFIX}-payment-row ${THEME_CLASS_PREFIX}-payment-discount`}>
                        <span>Points Discount</span>
                        <span>-${pointsCalculation.pointsValue.toFixed(2)}</span>
                      </div>
                      <div className={`${THEME_CLASS_PREFIX}-payment-row ${THEME_CLASS_PREFIX}-payment-total`}>
                        <span>Total to Pay</span>
                        <span>${pointsCalculation.usdcToPay.toFixed(2)} USDC</span>
                      </div>
                    </div>
                  )}

                  {/* Wallet Balance Display */}
                  {authenticated && (
                    <div className={`${THEME_CLASS_PREFIX}-wallet-balance`}>
                      <span>Your USDC Balance:</span>
                      <span className={`${THEME_CLASS_PREFIX}-balance-amount`}>
                        {loadingBalance ? "..." : usdcBalance !== null ? `$${usdcBalance.toFixed(2)}` : "—"}
                      </span>
                    </div>
                  )}

                  <button
                    className={`${THEME_CLASS_PREFIX}-submit-button`}
                    disabled={authLoading || !selectedTimeSlot || isBooking}
                    onClick={handleBookingSubmit}
                  >
                    {authLoading
                      ? "Loading..."
                      : isBooking
                      ? "Processing..."
                      : selectedTimeSlot
                      ? `Pay ${usePointsForPayment && pointsCalculation ? pointsCalculation.usdcToPay.toFixed(2) : selectedService.price} USDC`
                      : "Select a time"}
                  </button>
                </>
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
        amount={usePointsForPayment && pointsCalculation ? pointsCalculation.usdcToPay : (selectedService?.price || 0)}
        currency="USDC"
        status={{
          status: paymentTransaction.status,
          txHash: paymentTransaction.txHash,
          error: paymentTransaction.error,
          message: paymentTransaction.error || "",
        }}
        onRetry={() => {
          if (selectedService && selectedTimeSlot) {
            handleBookingSubmit();
          }
        }}
        pointsInfo={usePointsForPayment && pointsCalculation && pointsCalculation.pointsToUse > 0 ? {
          pointsUsed: pointsCalculation.pointsToUse,
          pointsValue: pointsCalculation.pointsValue,
          originalAmount: pointsCalculation.originalPrice,
        } : undefined}
      />
    </div>
  );
};

export default PublicProfile;
