// New API client that uses backend instead of direct Supabase access

// Use environment variable or fallback to tunnel URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://skating-destroyed-understanding-sas.trycloudflare.com';

class BackendApiClient {
  private async getAuthToken(): Promise<string | null> {
    // Try to get token from Privy directly when needed
    // This requires the Privy context to be initialized
    if (typeof window !== 'undefined' && (window as any).Privy) {
      try {
        const privyClient = (window as any).Privy;
        const token = await privyClient.getAccessToken?.();
        return token;
      } catch (e) {
        console.warn('Could not get token from Privy:', e);
      }
    }
    return null;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAuthToken();
    
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

// Export singleton instance
export const backendApi = new BackendApiClient();

// For now, just export the singleton - we'll handle tokens internally
// The BackendApiClient already gets tokens when needed