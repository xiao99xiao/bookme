/**
 * Compatibility layer for migrating from old ApiClient to new BackendAPI
 * This provides the same interface as the old ApiClient but uses the backend
 */

import { BackendAPI } from './backend-api'

// Types from the old API
export interface User {
  id: string
  email: string
  display_name: string
  username?: string
  bio?: string
  avatar_url?: string
  phone?: string
  timezone: string
  is_verified: boolean
  is_provider: boolean
  rating: number
  review_count: number
  total_earnings: number
  total_spent: number
  created_at: string
  updated_at?: string
}

export interface Service {
  id?: string
  provider_id: string
  category_id: string
  title: string
  description: string
  price: number
  duration_minutes: number
  is_online: boolean
  location?: string
  max_bookings_per_day: number
  availability_schedule?: any
  is_visible?: boolean
  rating?: number
  review_count?: number
  meeting_platform?: string
  images?: string[]
  created_at?: string
  updated_at?: string
}

export interface Booking {
  id: string
  service_id: string
  customer_id: string
  provider_id: string
  scheduled_at: string
  duration_minutes: number
  total_price: number
  service_fee: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  customer_notes?: string
  provider_notes?: string
  location?: string
  is_online: boolean
  meeting_link?: string
  meeting_id?: string
  meeting_platform?: string
  cancelled_at?: string
  cancelled_by?: string
  cancellation_reason?: string
  completed_at?: string
  created_at: string
  updated_at?: string
  // Relations
  service?: Service
  customer?: User
  provider?: User
}

/**
 * Migration wrapper that mimics old ApiClient interface
 * Uses the new BackendAPI under the hood
 */
export class ApiClient {
  private static backendApi: BackendAPI | null = null
  private static initializationPromise: Promise<void> | null = null
  private static resolveInitialization: (() => void) | null = null

  static initialize(getAccessToken: () => Promise<string | null>) {
    // Always update the backend API with the latest token function
    this.backendApi = new BackendAPI(getAccessToken)
    
    // If this is the first initialization, resolve the promise
    if (this.resolveInitialization) {
      this.resolveInitialization()
      this.resolveInitialization = null
    }
  }

  /**
   * Wait for ApiClient to be properly initialized with auth
   * This prevents race conditions where components try to use ApiClient
   * before PrivyAuthContext has initialized it
   */
  private static async waitForInitialization(): Promise<void> {
    // If already initialized with a proper backend API, we're good
    if (this.backendApi) {
      return
    }

    // If no initialization promise exists, create one
    if (!this.initializationPromise) {
      this.initializationPromise = new Promise<void>((resolve) => {
        this.resolveInitialization = resolve
      })
    }

    // Wait for initialization to complete
    await this.initializationPromise
  }

  /**
   * For public endpoints that don't require auth
   */
  private static ensureInitialized() {
    if (!this.backendApi) {
      // For public endpoints that don't require auth, initialize with no token
      this.backendApi = new BackendAPI(async () => null)
    }
  }

  // User/Profile methods
  static async ensureUserProfile(userId: string): Promise<User> {
    await this.waitForInitialization()
    return this.backendApi!.getUserProfile()
  }

  static async getUserProfileById(userId: string): Promise<User | null> {
    this.ensureInitialized()
    // Use public endpoint for viewing user profiles (no auth required)
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://192.168.0.10:4443'}/api/profile/public/${userId}`)
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to fetch profile')
    }
    return response.json()
  }

  static async getUserProfile(userId: string): Promise<User | null> {
    await this.waitForInitialization()
    return this.backendApi!.getUserProfile()
  }

  static async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    await this.waitForInitialization()
    return this.backendApi!.updateUserProfile(updates)
  }

  static async updateProfile(updates: Partial<User>, userId?: string): Promise<User> {
    await this.waitForInitialization()
    return this.backendApi!.updateUserProfile(updates)
  }

  // Service methods
  static async getUserServices(userId?: string): Promise<Service[]> {
    await this.waitForInitialization()
    // If no userId provided, get current user's services
    if (!userId) {
      return this.backendApi!.getServices({ provider_id: 'current' })
    }
    return this.backendApi!.getUserServices(userId)
  }

  static async getUserServicesById(userId: string, timezone?: string): Promise<Service[]> {
    this.ensureInitialized()
    // Use public endpoint for viewing user services (no auth required)
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://192.168.0.10:4443'}/api/services/public/user/${userId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch services')
    }
    return response.json()
  }

  static async getServices(filters?: any): Promise<any> {
    this.ensureInitialized()
    // Use public endpoint for discovery
    const params = new URLSearchParams(filters || {});
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://192.168.0.10:4443'}/api/services/public?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch services');
    }
    return response.json();
  }

  static async getServiceById(serviceId: string): Promise<Service | null> {
    this.ensureInitialized()
    return this.backendApi.getServiceById(serviceId)
  }

  static async searchServices(params: {
    query?: string
    category?: string
    minPrice?: number
    maxPrice?: number
    location?: string
  }): Promise<Service[]> {
    this.ensureInitialized()
    return this.backendApi.searchServices(params)
  }

  static async getActiveServices(): Promise<Service[]> {
    this.ensureInitialized()
    return this.backendApi.getServices({ is_active: true })
  }

  static async createService(userIdOrService: string | any, service?: Omit<Service, 'id' | 'provider_id'>): Promise<Service> {
    await this.waitForInitialization()
    // Handle both signatures: createService(userId, service) and createService(service)
    if (typeof userIdOrService === 'string') {
      // Old signature with userId
      return this.backendApi!.createService(service!)
    }
    // New signature without userId
    return this.backendApi!.createService(userIdOrService)
  }

  static async updateService(serviceId: string, userIdOrUpdates: string | Partial<Service>, updates?: Partial<Service>): Promise<Service> {
    await this.waitForInitialization()
    // Handle both signatures: updateService(id, userId, updates) and updateService(id, updates)
    if (typeof userIdOrUpdates === 'string' && updates) {
      // Old signature with userId
      return this.backendApi!.updateService(serviceId, updates)
    }
    // New signature without userId
    return this.backendApi!.updateService(serviceId, userIdOrUpdates as Partial<Service>)
  }

  static async deleteService(serviceId: string, userId?: string): Promise<void> {
    await this.waitForInitialization()
    return this.backendApi!.deleteService(serviceId)
  }

  static async toggleServiceVisibility(serviceId: string, isVisible: boolean, userId?: string): Promise<Service> {
    await this.waitForInitialization()
    return this.backendApi!.toggleServiceVisibility(serviceId, isVisible)
  }

  // Username methods
  static async checkUsernameAvailability(username: string): Promise<{ available: boolean; error?: string }> {
    await this.waitForInitialization()
    return this.backendApi!.checkUsernameAvailability(username)
  }

  static async updateUsername(username: string, userId?: string): Promise<User> {
    await this.waitForInitialization()
    return this.backendApi!.updateUsername(username)
  }

  static async getUserByUsername(username: string): Promise<User> {
    await this.waitForInitialization()
    return this.backendApi!.getUserByUsername(username)
  }

  // Booking methods
  static async createBooking(booking: {
    serviceId: string
    customerId?: string
    scheduledAt: string
    customerNotes?: string
    location?: string
    isOnline?: boolean
  } | any, userId?: string): Promise<Booking> {
    await this.waitForInitialization()
    // Handle both old signatures
    if (typeof userId === 'string') {
      // Old signature: createBooking(bookingData, userId)
      const { customerId, ...bookingData } = booking
      return this.backendApi!.createBooking(bookingData)
    }
    // New signature
    const { customerId, ...bookingData } = booking
    return this.backendApi!.createBooking(bookingData)
  }

  static async getUserBookings(userIdOrRole?: string, role?: 'customer' | 'provider'): Promise<Booking[]> {
    await this.waitForInitialization()
    // Handle different call signatures
    if (!userIdOrRole) {
      // No params - get current user's bookings
      return this.backendApi!.getUserBookings('current')
    }
    if (userIdOrRole === 'customer' || userIdOrRole === 'provider') {
      // Role only - get current user's bookings with role
      return this.backendApi!.getUserBookings('current', userIdOrRole as 'customer' | 'provider')
    }
    // UserId and optional role
    return this.backendApi!.getUserBookings(userIdOrRole, role)
  }

  static async getProviderBookings(userId: string): Promise<Booking[]> {
    await this.waitForInitialization()
    return this.backendApi!.getUserBookings(userId, 'provider')
  }

  static async getMyBookings(userId: string): Promise<Booking[]> {
    await this.waitForInitialization()
    return this.backendApi!.getUserBookings(userId, 'customer')
  }

  static async getBookingById(bookingId: string): Promise<Booking | null> {
    this.ensureInitialized()
    // This might need to be implemented in backend if not already
    const bookings = await this.backendApi.getUserBookings('')
    return bookings.find(b => b.id === bookingId) || null
  }

  static async updateBookingStatus(
    bookingId: string,
    statusOrUserId: string,
    statusOrAdditionalData?: string | any,
    additionalData?: any
  ): Promise<Booking> {
    await this.waitForInitialization()
    // Handle both signatures: (id, userId, status, data) and (id, status, data)
    if (statusOrAdditionalData && typeof statusOrAdditionalData === 'string') {
      // Old signature with userId
      return this.backendApi!.updateBooking(bookingId, { status: statusOrAdditionalData, ...additionalData })
    }
    // New signature without userId
    return this.backendApi!.updateBooking(bookingId, { status: statusOrUserId, ...statusOrAdditionalData })
  }

  static async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<Booking> {
    await this.waitForInitialization()
    return this.backendApi!.cancelBooking(bookingId, reason)
  }

  static async completeBooking(bookingId: string, userId: string): Promise<Booking> {
    await this.waitForInitialization()
    return this.backendApi!.completeBooking(bookingId)
  }

  // Category methods
  static async getCategories(): Promise<any[]> {
    this.ensureInitialized()
    return this.backendApi.getCategories()
  }

  // Conversation/Message methods
  static async createConversation(user1Id: string, user2Id: string, bookingId?: string): Promise<any> {
    this.ensureInitialized()
    // This needs to be implemented differently since backend doesn't have this exact endpoint
    // For now, conversations are created automatically with bookings
    return { id: 'temp-conversation', user1_id: user1Id, user2_id: user2Id, booking_id: bookingId }
  }

  static async getUserConversations(userId: string): Promise<any[]> {
    await this.waitForInitialization()
    return this.backendApi!.getConversations()
  }

  static async getConversationById(conversationId: string, userId: string): Promise<any> {
    await this.waitForInitialization()
    return this.backendApi!.getConversation(conversationId)
  }

  static async getConversationMessages(conversationId: string, limit?: number, before?: string): Promise<any[]> {
    await this.waitForInitialization()
    return this.backendApi!.getMessages(conversationId, { limit, before })
  }

  static async getUnreadMessageCount(userId: string): Promise<number> {
    this.ensureInitialized()
    // This needs to be implemented in backend or calculated client-side
    const conversations = await this.backendApi.getConversations()
    let unreadCount = 0
    for (const conv of conversations) {
      const messages = await this.backendApi.getMessages(conv.id, { limit: 50 })
      unreadCount += messages.filter(m => !m.is_read && m.sender_id !== userId).length
    }
    return unreadCount
  }

  // Review methods
  static async submitReview(bookingId: string, rating: number, comment: string): Promise<any> {
    await this.waitForInitialization()
    return this.backendApi!.createReview(bookingId, rating, comment)
  }

  static async getReviewByBooking(bookingId: string): Promise<any | null> {
    await this.waitForInitialization()
    return this.backendApi!.getReviewByBooking(bookingId)
  }

  static async getBookingReview(bookingId: string, userId?: string): Promise<any | null> {
    await this.waitForInitialization()
    // userId parameter was for access control, backend handles this now
    return this.backendApi!.getReviewByBooking(bookingId)
  }

  static async getProviderReviews(providerId: string): Promise<any[]> {
    this.ensureInitialized()
    // Use public endpoint for viewing provider reviews (no auth required)
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://192.168.0.10:4443'}/api/reviews/public/provider/${providerId}`)
    if (!response.ok) {
      console.warn('Failed to fetch reviews, returning empty array')
      return []
    }
    return response.json()
  }

  // Meeting integration methods
  static async getUserMeetingIntegrations(userId: string): Promise<any[]> {
    await this.waitForInitialization()
    return this.backendApi!.getIntegrations()
  }

  static async getMeetingIntegrations(userId?: string): Promise<any[]> {
    await this.waitForInitialization()
    // userId parameter was for filtering, backend handles this based on auth
    return this.backendApi!.getIntegrations()
  }

  static async saveIntegration(integrationData: {
    platform: string
    access_token: string
    refresh_token?: string | null
    expires_at?: string | null
    scope?: string[]
    platform_user_id?: string
    platform_user_email?: string
  }): Promise<any> {
    await this.waitForInitialization()
    return this.backendApi!.saveIntegration(integrationData)
  }

  static async disconnectMeetingIntegration(integrationId: string, userId?: string): Promise<void> {
    await this.waitForInitialization()
    return this.backendApi!.disconnectIntegration(integrationId)
  }

  static async deleteMeetingIntegration(integrationId: string): Promise<void> {
    await this.waitForInitialization()
    return this.backendApi!.disconnectIntegration(integrationId)
  }

  static async getMeetingOAuthUrl(platform: string): Promise<{ url: string }> {
    this.ensureInitialized()
    // Use the GoogleAuth class for Google Meet OAuth
    if (platform === 'google_meet') {
      // Import GoogleAuth dynamically to avoid module-level issues
      const { GoogleAuth } = await import('./google-auth')
      // This will use the getRedirectUri() function which evaluates at runtime
      GoogleAuth.initiateOAuth()
      // Return a dummy URL since initiateOAuth handles the redirect
      return { url: 'initiating' }
    }
    throw new Error(`OAuth URL for ${platform} not implemented`)
  }

  static async generateMeetingLink(bookingId: string): Promise<string | null> {
    await this.waitForInitialization()
    const result = await this.backendApi!.generateMeetingLink(bookingId)
    return result.meetingLink
  }

  static async deleteMeeting(bookingId: string): Promise<void> {
    await this.waitForInitialization()
    return this.backendApi!.deleteMeeting(bookingId)
  }

  // Chat/Messaging methods
  static async getOrCreateConversation(otherUserId: string, currentUserId?: string): Promise<any> {
    await this.waitForInitialization()
    // currentUserId is not needed as backend gets it from auth
    return this.backendApi!.getOrCreateConversation(otherUserId)
  }

  static async getMessages(conversationId: string, limit: number = 30, before?: string): Promise<any[]> {
    await this.waitForInitialization()
    return this.backendApi!.getMessages(conversationId, limit, before)
  }

  static async sendMessage(conversationId: string, content: string, senderId?: string): Promise<any> {
    await this.waitForInitialization()
    // senderId is not needed as backend gets it from auth
    return this.backendApi!.sendMessage(conversationId, content)
  }

  static async markMessagesAsRead(conversationId: string, userId?: string): Promise<void> {
    await this.waitForInitialization()
    // userId is not needed as backend gets it from auth
    return this.backendApi!.markMessagesAsRead(conversationId)
  }

  // File upload
  static async uploadFile(file: File, bucket: string = 'avatars', userId?: string): Promise<{ url: string; path: string }> {
    await this.waitForInitialization()
    // userId parameter was for path generation, backend handles this now
    return this.backendApi!.uploadFile(file, bucket)
  }

  // Public methods (no authentication required)
  
  /**
   * Public method to get user profile by username (no auth required)
   */
  static async getPublicUserByUsername(username: string): Promise<User> {
    this.ensureInitialized()
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://192.168.0.10:4443'}/api/user/username/${encodeURIComponent(username)}`)
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found')
      }
      throw new Error('Failed to fetch user')
    }
    return response.json()
  }

  /**
   * Public method to get user profile by ID (no auth required)
   */
  static async getPublicUserProfile(userId: string): Promise<User> {
    this.ensureInitialized()
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://192.168.0.10:4443'}/api/user/${encodeURIComponent(userId)}`)
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found')
      }
      throw new Error('Failed to fetch user profile')
    }
    return response.json()
  }

  /**
   * Public method to get user services by ID (no auth required)
   */
  static async getPublicUserServices(userId: string, timezone?: string): Promise<Service[]> {
    this.ensureInitialized()
    const url = new URL(`${import.meta.env.VITE_BACKEND_URL || 'https://192.168.0.10:4443'}/api/services/public/${encodeURIComponent(userId)}`)
    if (timezone) {
      url.searchParams.set('timezone', timezone)
    }
    
    const response = await fetch(url.toString())
    if (!response.ok) {
      console.warn('Failed to fetch public services, returning empty array')
      return []
    }
    return response.json()
  }
}

// Export for backwards compatibility
export default ApiClient