import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PrivyClient } from 'npm:@privy-io/server-auth@1.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-privy-token',
}

// Import UUID v5 properly
import { v5 as uuidv5 } from 'npm:uuid@9.0.1'

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
    const { action } = await req.json()
    
    if (action === 'exchange-token') {
      // Get Privy token from custom header to bypass Supabase JWT validation
      const privyToken = req.headers.get('x-privy-token')
      if (!privyToken) {
        return new Response(
          JSON.stringify({ error: 'Missing x-privy-token header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Initialize Privy client
      const privyAppId = Deno.env.get('PRIVY_APP_ID')
      const privyAppSecret = Deno.env.get('PRIVY_APP_SECRET')
      
      if (!privyAppId || !privyAppSecret) {
        console.error('Missing Privy environment variables')
        console.error('PRIVY_APP_ID exists:', !!privyAppId)
        console.error('PRIVY_APP_SECRET exists:', !!privyAppSecret)
        return new Response(
          JSON.stringify({ 
            error: 'Server configuration error',
            hasAppId: !!privyAppId,
            hasAppSecret: !!privyAppSecret
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const privyClient = new PrivyClient(privyAppId, privyAppSecret)
      
      // Verify Privy token
      console.log('Attempting to verify token for app:', privyAppId)
      console.log('Token prefix:', privyToken.substring(0, 50) + '...')
      
      let privyUser
      try {
        privyUser = await privyClient.verifyAuthToken(privyToken)
        console.log('Token verified successfully:', privyUser)
      } catch (error) {
        console.error('Privy token verification failed:', error)
        console.error('Error details:', error.message, error.stack)
        return new Response(
          JSON.stringify({ 
            error: 'Invalid Privy token',
            details: error.message,
            appId: privyAppId
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
      
      // Return user data that frontend can use
      // Note: We can't create Supabase JWTs in Edge Functions
      // The frontend will need to use the service role key for now
      return new Response(
        JSON.stringify({ 
          success: true,
          userId: userId,
          privyId: privyUser.userId,
          email: emailAccount?.address || null,
          message: 'User verified and created/updated in database'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})