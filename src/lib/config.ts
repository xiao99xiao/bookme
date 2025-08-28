/**
 * Application Configuration
 * Centralized configuration for business rules, fees, and settings
 */

export const CONFIG = {
  // Platform fees
  PLATFORM_FEE_PERCENTAGE: 0.10, // 10% platform fee
  
  // Chat settings
  CHAT: {
    MESSAGES_PER_PAGE: 30,
    MAX_MESSAGES_IN_MEMORY: 100,
    RECONNECT_DELAY_MS: 2000,
    SCROLL_THRESHOLD_PX: 150,
    MESSAGE_MAX_LENGTH: 1000,
  },
  
  // Booking settings
  BOOKING: {
    MIN_BOOKING_ADVANCE_HOURS: 2, // Must book at least 2 hours in advance
    MAX_BOOKING_ADVANCE_DAYS: 90, // Can book up to 90 days in advance
  },
  
  // File upload settings
  UPLOAD: {
    MAX_FILE_SIZE_MB: 10,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    AVATAR_MAX_SIZE_MB: 5,
  },
  
  // Search settings
  SEARCH: {
    MIN_QUERY_LENGTH: 2,
    MAX_RESULTS: 50,
  },
  
  // Profile settings
  PROFILE: {
    MIN_DISPLAY_NAME_LENGTH: 2,
    MAX_BIO_LENGTH: 500,
    MIN_SERVICE_TITLE_LENGTH: 5,
    MAX_SERVICE_TITLE_LENGTH: 100,
    MAX_SERVICE_DESCRIPTION_LENGTH: 1000,
  },
  
  // Pagination settings
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
} as const;

// Helper functions for fee calculations
export const calculatePlatformFee = (amount: number): number => {
  return Math.round(amount * CONFIG.PLATFORM_FEE_PERCENTAGE * 100) / 100;
};

export const calculateProviderEarnings = (totalAmount: number): number => {
  return Math.round((totalAmount - calculatePlatformFee(totalAmount)) * 100) / 100;
};

export const calculateTotalWithFee = (servicePrice: number): number => {
  const fee = calculatePlatformFee(servicePrice);
  return Math.round((servicePrice + fee) * 100) / 100;
};

// Format fee percentage for display
export const formatFeePercentage = (): string => {
  return `${(CONFIG.PLATFORM_FEE_PERCENTAGE * 100).toFixed(0)}%`;
};