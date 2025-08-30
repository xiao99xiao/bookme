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
  is_active: boolean
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
  private static backendApi: BackendAPI
  private static initialized = false

  static initialize(getAccessToken: () => Promise<string | null>) {
    if (!this.initialized) {
      this.backendApi = new BackendAPI(getAccessToken)
      this.initialized = true
    }
  }

  private static ensureInitialized() {
    if (!this.backendApi) {
      throw new Error('ApiClient not initialized. Call ApiClient.initialize() first.')
    }
  }

  // User/Profile methods
  static async ensureUserProfile(userId: string): Promise<User> {
    this.ensureInitialized()
    return this.backendApi.getUserProfile()
  }

  static async getUserProfileById(userId: string): Promise<User | null> {
    this.ensureInitialized()
    return this.backendApi.getUserProfileById(userId)
  }

  static async getUserProfile(userId: string): Promise<User | null> {
    this.ensureInitialized()
    return this.backendApi.getUserProfile()
  }

  static async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    this.ensureInitialized()
    return this.backendApi.updateUserProfile(updates)
  }

  // Service methods
  static async getUserServices(userId: string): Promise<Service[]> {
    this.ensureInitialized()
    return this.backendApi.getUserServices(userId)
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

  static async createService(userId: string, service: Omit<Service, 'id' | 'provider_id'>): Promise<Service> {
    this.ensureInitialized()
    return this.backendApi.createService(service)
  }

  static async updateService(serviceId: string, userId: string, updates: Partial<Service>): Promise<Service> {
    this.ensureInitialized()
    return this.backendApi.updateService(serviceId, updates)
  }

  static async deleteService(serviceId: string, userId: string): Promise<void> {
    this.ensureInitialized()
    return this.backendApi.deleteService(serviceId)
  }

  // Booking methods
  static async createBooking(booking: {
    serviceId: string
    customerId: string
    scheduledAt: string
    customerNotes?: string
    location?: string
    isOnline?: boolean
  }): Promise<Booking> {
    this.ensureInitialized()
    const { customerId, ...bookingData } = booking
    return this.backendApi.createBooking(bookingData)
  }

  static async getUserBookings(userId: string, role?: 'customer' | 'provider'): Promise<Booking[]> {
    this.ensureInitialized()
    return this.backendApi.getUserBookings(userId, role)
  }

  static async getBookingById(bookingId: string): Promise<Booking | null> {
    this.ensureInitialized()
    // This might need to be implemented in backend if not already
    const bookings = await this.backendApi.getUserBookings('')
    return bookings.find(b => b.id === bookingId) || null
  }

  static async updateBookingStatus(
    bookingId: string,
    userId: string,
    status: string,
    additionalData?: any
  ): Promise<Booking> {
    this.ensureInitialized()
    return this.backendApi.updateBooking(bookingId, { status, ...additionalData })
  }

  static async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<Booking> {
    this.ensureInitialized()
    return this.backendApi.cancelBooking(bookingId, reason)
  }

  static async completeBooking(bookingId: string, userId: string): Promise<Booking> {
    this.ensureInitialized()
    return this.backendApi.completeBooking(bookingId)
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
    this.ensureInitialized()
    return this.backendApi.getConversations()
  }

  static async getConversationById(conversationId: string, userId: string): Promise<any> {
    this.ensureInitialized()
    return this.backendApi.getConversation(conversationId)
  }

  static async getConversationMessages(conversationId: string, limit?: number, before?: string): Promise<any[]> {
    this.ensureInitialized()
    return this.backendApi.getMessages(conversationId, { limit, before })
  }

  static async sendMessage(conversationId: string, senderId: string, content: string): Promise<any> {
    this.ensureInitialized()
    return this.backendApi.sendMessage(conversationId, content)
  }

  static async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    this.ensureInitialized()
    // This is handled via WebSocket now
    return Promise.resolve()
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
    this.ensureInitialized()
    return this.backendApi.createReview(bookingId, rating, comment)
  }

  static async getReviewByBooking(bookingId: string): Promise<any | null> {
    this.ensureInitialized()
    return this.backendApi.getReviewByBooking(bookingId)
  }

  static async getProviderReviews(providerId: string): Promise<any[]> {
    this.ensureInitialized()
    // This needs to be implemented in backend
    return []
  }

  // Meeting integration methods
  static async getUserMeetingIntegrations(userId: string): Promise<any[]> {
    this.ensureInitialized()
    return this.backendApi.getIntegrations()
  }

  static async disconnectMeetingIntegration(integrationId: string, userId: string): Promise<void> {
    this.ensureInitialized()
    return this.backendApi.disconnectIntegration(integrationId)
  }

  static async generateMeetingLink(bookingId: string): Promise<string | null> {
    this.ensureInitialized()
    const result = await this.backendApi.generateMeetingLink(bookingId)
    return result.meetingLink
  }

  static async deleteMeeting(bookingId: string): Promise<void> {
    this.ensureInitialized()
    return this.backendApi.deleteMeeting(bookingId)
  }

  // File upload
  static async uploadFile(file: File, bucket: string = 'avatars'): Promise<{ url: string; path: string }> {
    this.ensureInitialized()
    return this.backendApi.uploadFile(file, bucket)
  }
}

// Export for backwards compatibility
export default ApiClient