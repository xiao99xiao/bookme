import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'
import jwt from 'npm:jsonwebtoken@9.0.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify JWT token
    const authorization = req.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const token = authorization.substring(7)
    const supabaseJwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')!
    
    let decoded: any
    try {
      decoded = jwt.verify(token, supabaseJwtSecret)
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const userId = decoded.user_id
    
    // Get request body
    const { serviceId, scheduledAt, customerNotes, location, isOnline } = await req.json()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Validate service exists and get price
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single()
    
    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if slot is available
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('service_id', serviceId)
      .gte('scheduled_at', new Date(scheduledAt).toISOString())
      .lt('scheduled_at', new Date(new Date(scheduledAt).getTime() + service.duration_minutes * 60000).toISOString())
      .in('status', ['pending', 'confirmed'])
    
    if (existingBookings && existingBookings.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Time slot not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Calculate service fee
    const serviceFee = service.price * 0.1 // 10% platform fee
    
    // Create booking with validated price
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        service_id: serviceId,
        customer_id: userId,
        provider_id: service.provider_id,
        scheduled_at: scheduledAt,
        duration_minutes: service.duration_minutes,
        total_price: service.price, // Use server-side price, not client-provided
        service_fee: serviceFee,
        status: 'pending',
        customer_notes: customerNotes || null,
        location: location || service.location,
        is_online: isOnline ?? service.is_online
      })
      .select()
      .single()
    
    if (bookingError) {
      console.error('Booking creation error:', bookingError)
      return new Response(
        JSON.stringify({ error: 'Failed to create booking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create conversation for this booking
    await supabase.from('conversations').insert({
      booking_id: booking.id,
      provider_id: service.provider_id,
      customer_id: userId,
      is_active: true
    })
    
    return new Response(
      JSON.stringify({ booking }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})