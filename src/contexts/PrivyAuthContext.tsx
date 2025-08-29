import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabaseAdmin } from '@/lib/supabase';
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
  const { user: privyUser, ready, authenticated, login, logout: privyLogout } = usePrivy();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
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
      console.log('Converting Privy DID to UUID...');
      
      const uuid = ensureUuid(privyId);
      console.log('Mapped UUID:', uuid);
      console.log('Admin client config:', !!supabaseAdmin);
      
      // First try to fetch existing profile (using admin client to bypass RLS)
      console.log('Attempting to fetch profile with admin client...');
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', uuid)
        .single();

      if (data) {
        console.log('Profile found:', data);
        setProfile(data);
        return;
      }

      // If profile doesn't exist (PGRST116), create it
      if (error?.code === 'PGRST116') {
        console.log('Profile not found, creating new profile...');
        await createProfile(uuid);
        return;
      }

      if (error) {
        console.error('Profile fetch error:', error);
        setProfile(null);
        return;
      }
    } catch (error) {
      console.error('fetchOrCreateProfile failed:', error);
      setProfile(null);
    }
  };

  const createProfile = async (uuid: string) => {
    try {
      if (!privyUser) {
        throw new Error('No Privy user found');
      }

      const email = getUserEmail(privyUser);
      const displayName = getUserDisplayName(privyUser);

      if (!email) {
        throw new Error('No email found for user');
      }

      // Detect user's timezone automatically
      const userTimezone = getBrowserTimezone();
      
      console.log('Creating profile for:', { uuid, email, displayName, timezone: userTimezone });

      // Use admin client to bypass RLS for user creation
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          id: uuid,
          email: email,
          display_name: displayName,
          bio: null,
          location: null,
          avatar: null,
          phone: null,
          timezone: userTimezone, // Automatically set timezone from browser
          is_verified: false,
          rating: 0,
          review_count: 0,
          total_earnings: 0,
          total_spent: 0,
          is_provider: false,
          provider_verified_at: null
        })
        .select()
        .single();

      if (error) {
        console.error('Profile creation error:', error);
        
        // If it's a duplicate key error, try to fetch the existing profile
        if (error.code === '23505') {
          console.log('Profile already exists, fetching existing profile...');
          const { data: existingData, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', uuid)
            .single();
            
          if (!fetchError && existingData) {
            console.log('Found existing profile:', existingData);
            setProfile(existingData);
            return;
          }
        }
        
        setProfile(null);
        return;
      }

      console.log('Profile created successfully:', data);
      setProfile(data);
    } catch (error) {
      console.error('Error creating profile:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (privyUser?.id) {
      await fetchOrCreateProfile(privyUser.id);
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