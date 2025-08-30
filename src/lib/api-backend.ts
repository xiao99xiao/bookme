import { usePrivy } from '@privy-io/react-auth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * API client that communicates with our secure backend
 * The backend handles all Supabase operations with proper validation
 */
export class SecureApiClient {
  private static async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    // Get Privy token - this would need to be passed in or use a hook
    const token = await this.getPrivyToken();
    
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
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    
    return response.json();
  }
  
  // This would need to be set from a component that has access to usePrivy
  private static getPrivyToken: () => Promise<string | null> = async () => null;
  
  static setTokenGetter(getter: () => Promise<string | null>) {
    this.getPrivyToken = getter;
  }
  
  // Profile endpoints
  static async getProfile() {
    return this.fetchWithAuth('/api/profile');
  }
  
  static async updateProfile(updates: any) {
    return this.fetchWithAuth('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }
  
  // Services endpoints
  static async getServices(filters?: {
    provider_id?: string;
    category?: string;
    is_active?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters?.provider_id) params.append('provider_id', filters.provider_id);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithAuth(`/api/services${query}`);
  }
  
  // Booking endpoints
  static async createBooking(bookingData: {
    serviceId: string;
    scheduledAt: string;
    customerNotes?: string;
    location?: string;
    isOnline?: boolean;
  }) {
    return this.fetchWithAuth('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }
}

// Hook to use the secure API client
export function useSecureApi() {
  const { getAccessToken } = usePrivy();
  
  // Set the token getter for the API client
  SecureApiClient.setTokenGetter(getAccessToken);
  
  return SecureApiClient;
}