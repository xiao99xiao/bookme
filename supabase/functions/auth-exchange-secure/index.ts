import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PrivyClient } from 'npm:@privy-io/server-auth@1.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'
import { v5 as uuidv5 } from 'npm:uuid@9.0.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Use the same namespace as the frontend to ensure consistent UUIDs
const PRIVY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function privyDidToUuid(privyDid: string): string {
  if (!privyDid) {
    throw new Error('Privy DID is required')
  }
  
  // Use UUID v5 to create a deterministic UUID from the DID
  // This MUST match the frontend implementation exactly
  return uuidv5(privyDid, PRIVY_NAMESPACE)
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // SECURE APPROACH: Use apikey header for Privy token
    // This avoids Supabase's JWT validation but requires the anon key
    // However, we ALSO verify the Privy token, so it's still secure
    
    const privyToken = req.headers.get('apikey')
    if (!privyToken) {
      return new Response(
        JSON.stringify({ error: 'Missing apikey (Privy token)' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Privy client
    const privyAppId = Deno.env.get('PRIVY_APP_ID')
    const privyAppSecret = Deno.env.get('PRIVY_APP_SECRET')
    
    if (!privyAppId || !privyAppSecret) {
      console.error('Missing Privy environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const privyClient = new PrivyClient(privyAppId, privyAppSecret)
    
    // Verify Privy token - THIS is what makes it secure
    let privyUser
    try {
      privyUser = await privyClient.verifyAuthToken(privyToken)
      console.log('Token verified for user:', privyUser.userId)
    } catch (error) {
      console.error('Privy token verification failed:', error.message)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Privy token',
          details: error.message
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!privyUser || !privyUser.userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid user data from Privy' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Convert DID to UUID using the same algorithm as frontend
    const userId = privyDidToUuid(privyUser.userId)
    
    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check if user exists in database, create if not
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (!existingUser) {
      // Create user profile if it doesn't exist
      // Extract email from linked accounts, matching frontend logic
      const emailAccount = privyUser.linkedAccounts?.find((acc: any) => acc.type === 'email')
      const email = emailAccount?.address || `${privyUser.userId}@privy.user`
      const displayName = email.split('@')[0]
      
      await supabase.from('users').insert({
        id: userId,
        email: email,
        display_name: displayName,
        bio: null,
        location: null,
        avatar: null,
        phone: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        is_verified: false,
        rating: 0,
        review_count: 0,
        total_earnings: 0,
        total_spent: 0,
        is_provider: false,
        provider_verified_at: null
      })
    }
    
    // Return success with user data
    // The frontend will continue using supabaseAdmin for now
    return new Response(
      JSON.stringify({ 
        success: true,
        userId: userId,
        privyId: privyUser.userId,
        email: privyUser.linkedAccounts?.find((acc: any) => acc.type === 'email')?.address || null,
        message: 'User verified and mapped to UUID'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})