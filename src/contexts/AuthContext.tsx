import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  phone: string | null;
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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('=== FETCH PROFILE START ===');
      console.log('User ID:', userId);
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Raw response:', { data, error });

      if (error) {
        console.log('Profile fetch error details:');
        console.log('- Code:', error.code);
        console.log('- Message:', error.message);
        console.log('- Details:', error.details);
        console.log('- Hint:', error.hint);
        
        // If profile doesn't exist (PGRST116), create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...');
          try {
            await createProfile(userId);
          } catch (createError) {
            console.error('Profile creation failed:', createError);
            setProfile(null);
          }
          return;
        }
        
        console.error('Profile fetch error:', error);
        setProfile(null);
        return;
      }

      console.log('Profile fetched successfully:', data);
      console.log('=== FETCH PROFILE END ===');
      setProfile(data);
    } catch (error) {
      console.error('=== UNEXPECTED PROFILE FETCH ERROR ===');
      console.error('Error:', error);
      console.error('Error type:', typeof error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      setProfile(null);
    }
  };

  const createProfile = async (userId: string) => {
    try {
      // Get auth user details
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user || authUser.user.id !== userId) {
        throw new Error('Auth user not found or ID mismatch');
      }

      const email = authUser.user.email!;
      const displayName = authUser.user.user_metadata?.display_name || 
                          authUser.user.user_metadata?.full_name || 
                          email.split('@')[0];

      console.log('Attempting to create profile for:', { userId, email, displayName });

      // First, try to insert a new profile
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email,
          display_name: displayName,
          bio: null,
          location: null,
          avatar: null,
          phone: null,
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
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        
        // If it's a duplicate key error, try to fetch the existing profile
        if (error.code === '23505') { // duplicate key error
          console.log('Profile already exists, fetching existing profile...');
          const { data: existingData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
            
          if (!fetchError && existingData) {
            console.log('Found existing profile:', existingData);
            setProfile(existingData);
            return;
          }
        }
        
        // If it's a permission error, show more helpful message
        if (error.code === '42501' || error.message.includes('permission')) {
          console.error('Permission denied: The database may be missing the INSERT policy for users table.');
          console.error('Please run the fix-user-insert-policy.sql script in your Supabase dashboard.');
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
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set a fallback timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('Auth loading timeout - forcing loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      clearTimeout(loadingTimeout); // Clear timeout since we got a response
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await fetchProfile(session.user.id);
        } catch (error) {
          console.error('Initial profile fetch failed:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    }).catch((error) => {
      console.error('Session fetch failed:', error);
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      setLoading(true); // Set loading when auth state changes
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await fetchProfile(session.user.id);
        } catch (error) {
          console.error('Profile fetch failed on auth change:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};