// Simple backend API client that gets tokens from Privy hook
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://skating-destroyed-understanding-sas.trycloudflare.com';

import { getBrowserTimezone } from './timezone';

export class BackendAPI {
  constructor(private getAccessToken: () => Promise<string | null>) {}

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAccessToken();

    // For public endpoints, don't require token
    const isPublicEndpoint = endpoint.includes('/public') || endpoint.includes('/categories');

    if (!token && !isPublicEndpoint) {
      throw new Error('Not authenticated');
    }

    const headers: any = {
      'Content-Type': 'application/json',
      'X-Client-Timezone': getBrowserTimezone(),
      ...options.headers,
    };

    // Only add Authorization header if we have a token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // User Profile APIs
  async getUserProfile(): Promise<any> {
    return this.request('/api/profile');
  }

  async getUserProfileById(userId: string): Promise<any> {
    return this.request(`/api/profile/${userId}`);
  }

  async updateUserProfile(updates: any): Promise<any> {
    return this.request('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async completeOnboarding(): Promise<any> {
    return this.request('/api/profile/complete-onboarding', {
      method: 'POST',
    });
  }

  // Services APIs
  async getServices(filters?: any): Promise<any[]> {
    const params = new URLSearchParams(filters);
    return this.request(`/api/services?${params}`);
  }

  async getUserServices(userId: string): Promise<any[]> {
    return this.request(`/api/services/user/${userId}`);
  }

  async getServiceById(serviceId: string): Promise<any> {
    return this.request(`/api/services/${serviceId}`);
  }

  async searchServices(params: any): Promise<any[]> {
    const queryParams = new URLSearchParams(params).toString();
    return this.request(`/api/services/search?${queryParams}`);
  }

  async createService(serviceData: any): Promise<any> {
    return this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }

  async updateService(serviceId: string, updates: any): Promise<any> {
    return this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify({ id: serviceId, ...updates }),
    });
  }

  async createOrUpdateService(serviceData: any): Promise<any> {
    return this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }

  async deleteService(serviceId: string): Promise<void> {
    await this.request(`/api/services/${serviceId}`, {
      method: 'DELETE',
    });
  }

  async toggleServiceVisibility(serviceId: string, isVisible: boolean): Promise<any> {
    return this.request(`/api/services/${serviceId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ is_visible: isVisible }),
    });
  }

  // Username APIs
  async checkUsernameAvailability(username: string): Promise<{ available: boolean; error?: string }> {
    return this.request(`/api/username/check/${encodeURIComponent(username)}`, {
      method: 'GET',
      requireAuth: false,
    });
  }

  async updateUsername(username: string): Promise<any> {
    return this.request('/api/username', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  }

  async getUserByUsername(username: string): Promise<any> {
    return this.request(`/api/user/username/${encodeURIComponent(username)}`, {
      method: 'GET',
      requireAuth: false,
    });
  }

  // Bookings APIs
  async createBooking(bookingData: any): Promise<any> {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  async getUserBookings(userId: string, role?: 'customer' | 'provider'): Promise<any[]> {
    const params = role ? `?role=${role}` : '';
    return this.request(`/api/bookings/user/${userId}${params}`);
  }

  async updateBooking(bookingId: string, updates: any): Promise<any> {
    return this.request(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<any> {
    return this.request(`/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async completeBooking(bookingId: string): Promise<any> {
    return this.request(`/api/bookings/${bookingId}/complete-service`, {
      method: 'POST',
    });
  }

  // Categories
  async getCategories(): Promise<any[]> {
    return this.request('/api/categories');
  }

  // Conversations & Messages
  async getConversations(): Promise<any[]> {
    const response = await this.request('/api/conversations');
    return response.conversations || [];
  }

  async getConversation(conversationId: string): Promise<any> {
    return this.request(`/api/conversations/${conversationId}`);
  }

  async sendMessage(conversationId: string, content: string): Promise<any> {
    return this.request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, content }),
    });
  }

  async getMessages(conversationId: string, params?: { limit?: number; before?: string }): Promise<any[]> {
    const queryParams = params ? new URLSearchParams(params as any).toString() : '';
    const response = await this.request(`/api/messages/${conversationId}${queryParams ? `?${queryParams}` : ''}`);
    return response.messages || [];
  }

  // Reviews
  async createReview(bookingId: string, rating: number, comment: string): Promise<any> {
    return this.request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId, rating, comment }),
    });
  }

  async getReviewByBooking(bookingId: string): Promise<any> {
    return this.request(`/api/reviews/${bookingId}`);
  }

  // Meeting Integrations
  async getIntegrations(): Promise<any[]> {
    return this.request('/api/integrations');
  }

  async saveIntegration(integrationData: {
    platform: string;
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
    scope?: string[];
    platform_user_id?: string;
    platform_user_email?: string;
  }): Promise<any> {
    return this.request('/api/integrations', {
      method: 'POST',
      body: JSON.stringify(integrationData),
    });
  }

  async disconnectIntegration(integrationId: string): Promise<void> {
    await this.request(`/api/integrations/${integrationId}`, {
      method: 'DELETE',
    });
  }

  async generateMeetingLink(bookingId: string): Promise<any> {
    return this.request('/api/meeting/generate', {
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    });
  }

  async deleteMeeting(bookingId: string): Promise<void> {
    await this.request(`/api/meeting/${bookingId}`, {
      method: 'DELETE',
    });
  }

  // Chat/Messaging
  async getOrCreateConversation(otherUserId: string): Promise<any> {
    return this.request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ participant_id: otherUserId }),
    });
  }

  async markMessagesAsRead(conversationId: string): Promise<void> {
    await this.request(`/api/conversations/${conversationId}/read`, {
      method: 'PUT',
    });
  }

  // File Upload
  async uploadFile(file: File, bucket: string = 'avatars'): Promise<{ url: string; path: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);

    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Enhanced Cancellation
  async getCancellationPolicies(bookingId: string): Promise<any[]> {
    return this.request(`/api/bookings/${bookingId}/cancellation-policies`);
  }

  async calculateRefundBreakdown(bookingId: string, policyId: string): Promise<any> {
    return this.request(`/api/bookings/${bookingId}/refund-breakdown`, {
      method: 'POST',
      body: JSON.stringify({ policyId }),
    });
  }

  async cancelBookingWithPolicy(bookingId: string, policyId: string, explanation: string | null): Promise<any> {
    return this.request(`/api/bookings/${bookingId}/cancel-with-policy`, {
      method: 'POST',
      body: JSON.stringify({ policyId, explanation }),
    });
  }

  async authorizeCancellation(bookingId: string, policyId: string, explanation: string | null): Promise<any> {
    return this.request(`/api/bookings/${bookingId}/authorize-cancellation`, {
      method: 'POST',
      body: JSON.stringify({ policyId, explanation }),
    });
  }

  // Blockchain Service Completion
  async completeService(bookingId: string): Promise<any> {
    return this.request(`/api/bookings/${bookingId}/complete-service`, {
      method: 'POST',
    });
  }

  async getBlockchainStatus(bookingId: string): Promise<any> {
    return this.request(`/api/bookings/${bookingId}/blockchain-status`);
  }

  // Transaction methods
  async getIncomeTransactions(limit: number = 50, offset: number = 0): Promise<{
    transactions: any[]
    totalIncome: number
    pagination: {
      limit: number
      offset: number
      hasMore: boolean
    }
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    return this.request(`/api/transactions/income?${params}`);
  }

  async getIncomeTransactionsSummary(): Promise<{
    totalIncome: number
    transactionCount: number
    averageTransactionValue: number
    thisMonthIncome: number
    lastTransactionDate: string | null
    transactionsByType: Record<string, number>
  }> {
    return this.request(`/api/transactions/income/summary`);
  }

  // Referral APIs
  async getReferralCode(): Promise<{
    code: string
    referralUrl: string
    usageCount: number
    activeReferrals: number
  }> {
    return this.request('/api/referrals/my-code');
  }

  async getReferralStats(): Promise<{
    totalReferrals: number
    totalEarnings: number
    pendingEarnings: number
    recentEarnings: any[]
  }> {
    return this.request('/api/referrals/stats');
  }

  async getReferralEarnings(limit: number = 20, offset: number = 0): Promise<any[]> {
    return this.request(`/api/referrals/earnings?limit=${limit}&offset=${offset}`);
  }

  async applyReferralCode(referralCode: string): Promise<{ success: boolean }> {
    return this.request('/api/referrals/register', {
      method: 'POST',
      body: JSON.stringify({ referralCode })
    });
  }

  async validateReferralCode(code: string): Promise<{
    valid: boolean
    referrerName?: string
    error?: string
  }> {
    return this.request(`/api/referrals/validate/${code}`);
  }

  // Points APIs
  async getPointsBalance(): Promise<{
    balance: number
    totalEarned: number
    totalSpent: number
    usdValue: number
    updatedAt: string | null
  }> {
    return this.request('/api/points/balance');
  }

  async getPointsHistory(limit: number = 50, offset: number = 0): Promise<{
    transactions: Array<{
      id: string
      type: string
      amount: number
      description: string
      referenceId: string | null
      createdAt: string
    }>
  }> {
    return this.request(`/api/points/history?limit=${limit}&offset=${offset}`);
  }

  async calculatePointsForService(servicePrice: number): Promise<{
    pointsToUse: number
    pointsValue: number
    usdcToPay: number
    originalPrice: number
    currentBalance: number
  }> {
    return this.request('/api/points/calculate', {
      method: 'POST',
      body: JSON.stringify({ service_price: servicePrice })
    });
  }

  async recordFunding(params: {
    usdcAmount: number
    feeAmount: number
    transactionHash?: string
    fundingMethod?: string
  }): Promise<{
    success: boolean
    pointsAwarded: number
    newBalance: number
    message: string
  }> {
    return this.request('/api/points/record-funding', {
      method: 'POST',
      body: JSON.stringify({
        usdc_amount: params.usdcAmount,
        fee_amount: params.feeAmount,
        transaction_hash: params.transactionHash,
        funding_method: params.fundingMethod || 'card'
      })
    });
  }
}