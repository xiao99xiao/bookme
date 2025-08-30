import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '../.env.local' })

// Initialize Hono app
const app = new Hono()

// Enable CORS for your frontend
app.use('*', cors({
  origin: [
    'http://localhost:8080', 
    'http://localhost:5173',
    'https://roulette-phenomenon-airfare-claire.trycloudflare.com',
    /https:\/\/.*\.trycloudflare\.com$/ // Allow any Cloudflare tunnel
  ],
  credentials: true,
}))

// Debug: Check if env vars are loaded
console.log('Privy App ID:', process.env.VITE_PRIVY_APP_ID ? 'Set' : 'Not set');
console.log('Privy App Secret:', process.env.PRIVY_APP_SECRET ? 'Set' : 'Not set');

// Initialize clients
const privyClient = new PrivyClient(
  process.env.VITE_PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
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

// Generate Supabase-compatible JWT token
app.post('/api/auth/token', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing authorization header' }, 401)
    }
    
    const privyToken = authHeader.substring(7)
    const privyUser = await privyClient.verifyAuthToken(privyToken)
    
    if (!privyUser) {
      return c.json({ error: 'Invalid token' }, 401)
    }
    
    // Convert Privy DID to UUID
    const userId = privyDidToUuid(privyUser.userId)
    
    // Get or create user profile
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (!user) {
      // Create user if doesn't exist
      const emailAccount = privyUser.linkedAccounts?.find(acc => acc.type === 'email')
      const email = emailAccount?.address || `${privyUser.userId}@privy.user`
      
      await supabaseAdmin
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
    }
    
    // Create Supabase-compatible JWT with all required claims
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('SUPABASE_JWT_SECRET not found in environment variables');
      return c.json({ error: 'JWT secret not configured' }, 500)
    }
    
    // Generate a session ID for this JWT
    const sessionId = `${userId}-${Date.now()}`
    
    const supabaseJWT = jwt.sign(
      {
        sub: userId, // This becomes auth.uid() in RLS policies
        aud: 'authenticated',
        role: 'authenticated',
        email: user?.email || `${privyUser.userId}@privy.user`,
        phone: null,
        app_metadata: {
          provider: 'privy',
          providers: ['privy']
        },
        user_metadata: {
          privy_id: privyUser.userId
        },
        aal: 'aal1', // Authentication assurance level
        amr: [{ method: 'privy', timestamp: Math.floor(Date.now() / 1000) }], // Authentication methods reference
        session_id: sessionId,
        iss: process.env.VITE_SUPABASE_URL + '/auth/v1',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
      },
      jwtSecret
    )
    
    return c.json({ 
      token: supabaseJWT,
      user_id: userId,
      expires_in: 86400 // 24 hours in seconds
    })
  } catch (error) {
    console.error('Token generation error:', error)
    return c.json({ error: 'Failed to generate token' }, 500)
  }
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

// Get user's services
app.get('/api/services/user/:userId', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const targetUserId = c.req.param('userId')
    
    const { data, error } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('provider_id', targetUserId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Services fetch error:', error)
      return c.json({ error: 'Failed to fetch services' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Services error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Create or update service
app.post('/api/services', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    
    // Remove any fields that don't exist in the database
    delete body.time_slots // Remove if accidentally sent
    
    // Ensure provider_id matches authenticated user
    const serviceData = {
      ...body,
      provider_id: userId
    }
    
    if (body.id) {
      // Update existing service
      const { data, error } = await supabaseAdmin
        .from('services')
        .update(serviceData)
        .eq('id', body.id)
        .eq('provider_id', userId) // Ensure user owns the service
        .select()
        .single()
      
      if (error) {
        console.error('Service update error:', error)
        return c.json({ error: 'Failed to update service' }, 500)
      }
      
      return c.json(data)
    } else {
      // Create new service
      const { data, error } = await supabaseAdmin
        .from('services')
        .insert(serviceData)
        .select()
        .single()
      
      if (error) {
        console.error('Service creation error:', error)
        return c.json({ error: 'Failed to create service' }, 500)
      }
      
      return c.json(data)
    }
  } catch (error) {
    console.error('Service error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Delete service
app.delete('/api/services/:serviceId', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const serviceId = c.req.param('serviceId')
    
    const { error } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', serviceId)
      .eq('provider_id', userId) // Ensure user owns the service
    
    if (error) {
      console.error('Service deletion error:', error)
      return c.json({ error: 'Failed to delete service' }, 500)
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Service deletion error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get user's bookings
app.get('/api/bookings/user/:userId', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const targetUserId = c.req.param('userId')
    const { role } = c.req.query()
    
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        service:services(*),
        customer:users!customer_id(*),
        provider:users!provider_id(*)
      `)
    
    if (role === 'customer') {
      query = query.eq('customer_id', targetUserId)
    } else if (role === 'provider') {
      query = query.eq('provider_id', targetUserId)
    } else {
      // Get both
      query = query.or(`customer_id.eq.${targetUserId},provider_id.eq.${targetUserId}`)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('Bookings fetch error:', error)
      return c.json({ error: 'Failed to fetch bookings' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Bookings error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Update booking status
app.patch('/api/bookings/:bookingId', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('bookingId')
    const updates = await c.req.json()
    
    // Verify user is either customer or provider
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()
    
    if (fetchError || !booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    if (booking.customer_id !== userId && booking.provider_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select()
      .single()
    
    if (error) {
      console.error('Booking update error:', error)
      return c.json({ error: 'Failed to update booking' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Booking update error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get categories
app.get('/api/categories', async (c) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Categories fetch error:', error)
      return c.json({ error: 'Failed to fetch categories' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Categories error:', error)
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