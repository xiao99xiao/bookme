// Simple backend API client that gets tokens from Privy hook
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://skating-destroyed-understanding-sas.trycloudflare.com';

export class BackendAPI {
  constructor(private getAccessToken: () => Promise<string | null>) {}

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAccessToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
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

  // Services APIs
  async getServices(filters?: any): Promise<any[]> {
    const params = new URLSearchParams(filters);
    return this.request(`/api/services?${params}`);
  }

  async getUserServices(userId: string): Promise<any[]> {
    return this.request(`/api/services/user/${userId}`);
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

  // Categories
  async getCategories(): Promise<any[]> {
    return this.request('/api/categories');
  }
}