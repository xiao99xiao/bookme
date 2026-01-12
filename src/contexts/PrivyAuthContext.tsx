import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
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
  onboarding_completed: boolean;
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
  getUserDisplayName: () => string;
  getUserEmail: () => string | null;
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
  
  // Wrapper for getAccessToken to ensure proper state checking
  const wrappedGetAccessToken = useCallback(async () => {
    // Check if Privy is ready and user is authenticated
    if (!ready || !authenticated) {
      return null;
    }
    
    try {
      const token = await getAccessToken();
      return token;
    } catch (error) {
      return null;
    }
  }, [getAccessToken, authenticated, ready]);

  // Create backend API instance with wrapper
  const backendApi = useMemo(() => new BackendAPI(wrappedGetAccessToken), [wrappedGetAccessToken]);
  
  // Initialize ApiClient compatibility layer
  useEffect(() => {
    ApiClient.initialize(wrappedGetAccessToken);
  }, [wrappedGetAccessToken]);
  
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

  // Check if user needs onboarding based on onboarding_completed flag
  const needsOnboarding = authenticated && profile && !loading && !profile.onboarding_completed;

  // Debug logging for onboarding logic
  useEffect(() => {
    if (profile && privyUser) {
      console.log('=== ONBOARDING DEBUG ===');
      console.log('authenticated:', authenticated);
      console.log('profile:', profile);
      console.log('loading:', loading);
      console.log('profile.onboarding_completed:', profile.onboarding_completed);
      console.log('needsOnboarding calculated:', needsOnboarding);
      console.log('========================');
    }
  }, [authenticated, profile, loading, needsOnboarding, privyUser]);

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

        // Check for pending referral code after profile is loaded
        await checkAndApplyPendingReferralCode();
        return;
      }
    } catch (error) {
      console.error('fetchOrCreateProfile failed:', error);
      // Profile will be created by backend on first request
      setProfile(null);
    }
  };

  // Check for and apply any pending referral code from sessionStorage
  const checkAndApplyPendingReferralCode = async () => {
    try {
      const storedCode = sessionStorage.getItem('referralCode');
      const timestamp = sessionStorage.getItem('referralCodeTimestamp');

      if (!storedCode || !timestamp) {
        return; // No referral code to apply
      }

      // Check if code is still valid (less than 24 hours old)
      const age = Date.now() - parseInt(timestamp);
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (age >= twentyFourHours) {
        // Clear expired code
        sessionStorage.removeItem('referralCode');
        sessionStorage.removeItem('referralCodeTimestamp');
        sessionStorage.removeItem('referrerName');
        return;
      }

      // Apply the referral code
      console.log('Applying pending referral code:', storedCode);
      const { ApiClient } = await import('@/lib/api-migration');
      const result = await ApiClient.applyReferralCode(storedCode);

      if (result.success) {
        console.log('Referral code applied successfully');
        // Clear from storage after successful application
        sessionStorage.removeItem('referralCode');
        sessionStorage.removeItem('referralCodeTimestamp');
        sessionStorage.removeItem('referrerName');
      }
    } catch (error) {
      console.error('Failed to apply pending referral code:', error);
      // Don't clear on error - user might retry later
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


  const value = useMemo(() => ({
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
  }), [
    privyUser,
    profile,
    loading,
    authenticated,
    ready,
    userId,
    privyUserId,
    needsOnboarding,
    login,
    logout,
    refreshProfile
  ]);

  return (
    <PrivyAuthContext.Provider value={value}>
      {children}
    </PrivyAuthContext.Provider>
  );
};