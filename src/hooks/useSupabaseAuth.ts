import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function useSupabaseAuth() {
  const { authenticated, getAccessToken } = usePrivy();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    async function setupSupabase() {
      if (!authenticated) {
        setClient(null);
        setUserId(null);
        setLoading(false);
        return;
      }
      
      try {
        // Get Privy token
        const privyToken = await getAccessToken();
        if (!privyToken) {
          throw new Error('No Privy token available');
        }
        
        // Exchange for Supabase JWT using Edge Function
        // Use custom header to bypass Supabase's JWT validation
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-exchange`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'x-privy-token': privyToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'exchange-token' })
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to exchange token');
        }
        
        const { token, userId: userUuid } = await response.json();
        
        // Create Supabase client with custom JWT
        supabaseClient = createClient(
          import.meta.env.VITE_SUPABASE_URL!,
          import.meta.env.VITE_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`
              }
            },
            auth: {
              persistSession: false,
              autoRefreshToken: false
            }
          }
        );
        
        setClient(supabaseClient);
        setUserId(userUuid);
      } catch (error) {
        console.error('Failed to setup Supabase client:', error);
        setClient(null);
        setUserId(null);
      } finally {
        setLoading(false);
      }
    }
    
    setupSupabase();
  }, [authenticated, getAccessToken]);
  
  return { supabase: client, loading, userId };
}