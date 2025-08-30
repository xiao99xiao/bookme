import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { BackendAPI } from '@/lib/backend-api';
import { ApiClient } from '@/lib/api-migration';
import { ensureUuid, privyDidToUuid, isPrivyDid } from '@/lib/id-mapping';
import { getBrowserTimezone } from '@/lib/timezone';

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  phone: string | null;
  timezone: string | null;
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

interface PrivyAuthContextType {
  user: any; // Privy user object
  profile: UserProfile | null;
  loading: boolean;
  authenticated: boolean;
  ready: boolean;
  userId: string | null; // UUID for database operations
  privyUserId: string | null; // Original Privy DID
  needsOnboarding: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const PrivyAuthContext = createContext<PrivyAuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authenticated: false,
  ready: false,
  userId: null,
  privyUserId: null,
  needsOnboarding: false,
  login: () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(PrivyAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a PrivyAuthProvider');
  }
  return context;
};

interface PrivyAuthProviderProps {
  children: ReactNode;
}

export const PrivyAuthProvider = ({ children }: PrivyAuthProviderProps) => {
  const { user: privyUser, ready, authenticated, login, logout: privyLogout, getAccessToken } = usePrivy();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Create backend API instance with getAccessToken
  const backendApi = useMemo(() => new BackendAPI(getAccessToken), [getAccessToken]);
  
  // Initialize ApiClient compatibility layer
  useEffect(() => {
    ApiClient.initialize(getAccessToken);
  }, [getAccessToken]);
  
  // Generate UUID from Privy DID for database operations
  const privyUserId = privyUser?.id || null;
  const userId = privyUserId ? ensureUuid(privyUserId) : null;

  // Get user email from Privy user object
  const getUserEmail = (user: any): string | null => {
    if (!user) return null;
    
    // Try to get email from linked accounts
    const emailAccount = user.linkedAccounts?.find((account: any) => account.type === 'email');
    if (emailAccount && 'address' in emailAccount) {
      return emailAccount.address;
    }
    
    return null;
  };

  // Get user display name from Privy user object  
  const getUserDisplayName = (user: any): string => {
    if (!user) return 'User';
    
    const email = getUserEmail(user);
    if (email) {
      return email.split('@')[0];
    }
    
    return user.id?.substring(0, 8) || 'User';
  };

  // Check if user needs onboarding (missing display_name or just has default name based on email)
  const needsOnboarding = authenticated && profile && !loading && (
    !profile.display_name || 
    profile.display_name.trim() === '' ||
    profile.display_name === getUserDisplayName(privyUser)
  );

  const fetchOrCreateProfile = async (privyId: string) => {
    try {
      console.log('=== FETCH/CREATE PROFILE START ===');
      console.log('Privy ID:', privyId);
      
      // Don't store token - let Privy handle it internally
      // Just fetch or create profile through backend
      console.log('Fetching profile from backend...');
      const profileData = await backendApi.getUserProfile();
      
      if (profileData) {
        console.log('Profile found:', profileData);
        setProfile(profileData);
        return;
      }
    } catch (error) {
      console.error('fetchOrCreateProfile failed:', error);
      // Profile will be created by backend on first request
      setProfile(null);
    }
  };

  // Profile refresh function
  const refreshProfile = async () => {
    if (!privyUserId) return;
    
    try {
      // Don't store token - let Privy handle it
      const profileData = await backendApi.getUserProfile();
      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      setProfile(null);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await privyLogout();
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) {
      return;
    }

    setLoading(true);

    if (authenticated && privyUser?.id) {
      console.log('User authenticated, fetching/creating profile:', privyUser.id);
      fetchOrCreateProfile(privyUser.id).finally(() => {
        setLoading(false);
      });
    } else {
      console.log('User not authenticated');
      setProfile(null);
      setLoading(false);
    }
  }, [ready, authenticated, privyUser?.id]);


  const value = {
    user: privyUser,
    profile,
    loading,
    authenticated,
    ready,
    userId,
    privyUserId,
    needsOnboarding,
    login,
    logout,
    refreshProfile,
    getUserDisplayName: () => getUserDisplayName(privyUser),
    getUserEmail: () => getUserEmail(privyUser),
  };

  return (
    <PrivyAuthContext.Provider value={value}>
      {children}
    </PrivyAuthContext.Provider>
  );
};