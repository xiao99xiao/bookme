import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '../.env.local' })

// Initialize Hono app
const app = new Hono()

// Enable CORS for your frontend
app.use('*', cors({
  origin: ['http://localhost:8080', 'http://localhost:5173'],
  credentials: true,
}))

// Initialize clients
const privyClient = new PrivyClient(
  process.env.VITE_PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET // You'll need to add this to .env.local
)

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

// UUID namespace - same as frontend
const PRIVY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

// Convert Privy DID to UUID (same logic as frontend)
function privyDidToUuid(privyDid) {
  if (!privyDid) {
    throw new Error('Privy DID is required')
  }
  return uuidv5(privyDid, PRIVY_NAMESPACE)
}

// Middleware to verify Privy token
async function verifyPrivyAuth(c, next) {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing authorization header' }, 401)
    }
    
    const token = authHeader.substring(7)
    const user = await privyClient.verifyAuthToken(token)
    
    if (!user) {
      return c.json({ error: 'Invalid token' }, 401)
    }
    
    // Add user to context
    c.set('privyUser', user)
    c.set('userId', privyDidToUuid(user.userId))
    
    await next()
  } catch (error) {
    console.error('Auth error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
}

// Health check endpoint (no auth required)
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

// Get or create user profile
app.get('/api/profile', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const privyUser = c.get('privyUser')
    
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (existingUser) {
      return c.json(existingUser)
    }
    
    // Create new user if doesn't exist
    const emailAccount = privyUser.linkedAccounts?.find(acc => acc.type === 'email')
    const email = emailAccount?.address || `${privyUser.userId}@privy.user`
    
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: email,
        display_name: email.split('@')[0],
        timezone: 'UTC',
        is_verified: false,
        rating: 0,
        review_count: 0,
        total_earnings: 0,
        total_spent: 0,
        is_provider: false
      })
      .select()
      .single()
    
    if (createError) {
      console.error('Create user error:', createError)
      return c.json({ error: 'Failed to create user' }, 500)
    }
    
    return c.json(newUser)
  } catch (error) {
    console.error('Profile error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get services (with optional filters)
app.get('/api/services', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const { provider_id, category, is_active } = c.req.query()
    
    let query = supabaseAdmin.from('services').select('*')
    
    if (provider_id) query = query.eq('provider_id', provider_id)
    if (category) query = query.eq('category_id', category)
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true')
    
    const { data, error } = await query
    
    if (error) {
      console.error('Services fetch error:', error)
      return c.json({ error: 'Failed to fetch services' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Services error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Create booking (with validation)
app.post('/api/bookings', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const { serviceId, scheduledAt, customerNotes, location, isOnline } = body
    
    // Validate service exists and get price
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single()
    
    if (serviceError || !service) {
      return c.json({ error: 'Service not found' }, 404)
    }
    
    // Check availability (basic check)
    const startTime = new Date(scheduledAt)
    const endTime = new Date(startTime.getTime() + service.duration_minutes * 60000)
    
    const { data: existingBookings } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('service_id', serviceId)
      .gte('scheduled_at', startTime.toISOString())
      .lt('scheduled_at', endTime.toISOString())
      .in('status', ['pending', 'confirmed'])
    
    if (existingBookings && existingBookings.length > 0) {
      return c.json({ error: 'Time slot not available' }, 400)
    }
    
    // Calculate service fee (10% platform fee)
    const serviceFee = service.price * 0.1
    
    // Create booking with server-validated price
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        service_id: serviceId,
        customer_id: userId,
        provider_id: service.provider_id,
        scheduled_at: scheduledAt,
        duration_minutes: service.duration_minutes,
        total_price: service.price, // Use server-side price
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
      return c.json({ error: 'Failed to create booking' }, 500)
    }
    
    // Create conversation for this booking
    await supabaseAdmin.from('conversations').insert({
      booking_id: booking.id,
      provider_id: service.provider_id,
      customer_id: userId,
      is_active: true
    })
    
    return c.json(booking)
  } catch (error) {
    console.error('Booking error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Update user profile
app.patch('/api/profile', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const updates = await c.req.json()
    
    // Remove any fields that shouldn't be updated
    delete updates.id
    delete updates.email
    delete updates.created_at
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
    
    if (error) {
      console.error('Profile update error:', error)
      return c.json({ error: 'Failed to update profile' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Profile update error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Start server
const port = process.env.PORT || 4000
console.log(`🚀 Server starting on port ${port}...`)

serve({
  fetch: app.fetch,
  port: port,
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`)
  console.log(`📝 Health check: http://localhost:${info.port}/health`)
})