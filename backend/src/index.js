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

// Get single service by ID
app.get('/api/services/:id', verifyPrivyAuth, async (c) => {
  try {
    const serviceId = c.req.param('id')
    
    const { data, error } = await supabaseAdmin
      .from('services')
      .select(`
        *,
        provider:users!provider_id(*)
      `)
      .eq('id', serviceId)
      .single()
    
    if (error) {
      console.error('Service fetch error:', error)
      return c.json({ error: 'Service not found' }, 404)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Service error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Search services
app.get('/api/services/search', verifyPrivyAuth, async (c) => {
  try {
    const { query, category, minPrice, maxPrice, location } = c.req.query()
    
    let dbQuery = supabaseAdmin
      .from('services')
      .select(`
        *,
        provider:users!provider_id(display_name, avatar_url, rating, review_count)
      `)
      .eq('is_active', true)
    
    if (query) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    }
    if (category) {
      dbQuery = dbQuery.eq('category_id', category)
    }
    if (minPrice) {
      dbQuery = dbQuery.gte('price', parseFloat(minPrice))
    }
    if (maxPrice) {
      dbQuery = dbQuery.lte('price', parseFloat(maxPrice))
    }
    if (location) {
      dbQuery = dbQuery.ilike('location', `%${location}%`)
    }
    
    const { data, error } = await dbQuery.order('created_at', { ascending: false })
    
    if (error) {
      console.error('Search error:', error)
      return c.json({ error: 'Search failed' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Search error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Cancel booking
app.post('/api/bookings/:id/cancel', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    const { reason } = await c.req.json()
    
    // Verify user is part of the booking
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
    
    // Update booking status
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
        cancelled_by: userId
      })
      .eq('id', bookingId)
      .select()
      .single()
    
    if (error) {
      console.error('Booking cancel error:', error)
      return c.json({ error: 'Failed to cancel booking' }, 500)
    }
    
    // TODO: Delete meeting if exists (requires meeting module)
    
    return c.json(data)
  } catch (error) {
    console.error('Booking cancel error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Complete booking
app.post('/api/bookings/:id/complete', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    
    // Verify user is the provider
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()
    
    if (fetchError || !booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    if (booking.provider_id !== userId) {
      return c.json({ error: 'Only provider can complete booking' }, 403)
    }
    
    if (booking.status !== 'confirmed') {
      return c.json({ error: 'Only confirmed bookings can be completed' }, 400)
    }
    
    // Update booking status
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single()
    
    if (error) {
      console.error('Booking complete error:', error)
      return c.json({ error: 'Failed to complete booking' }, 500)
    }
    
    // Update provider earnings
    await supabaseAdmin
      .from('users')
      .update({
        total_earnings: supabaseAdmin.raw('total_earnings + ?', [booking.total_price - booking.service_fee])
      })
      .eq('id', booking.provider_id)
    
    // Update customer spending
    await supabaseAdmin
      .from('users')
      .update({
        total_spent: supabaseAdmin.raw('total_spent + ?', [booking.total_price])
      })
      .eq('id', booking.customer_id)
    
    return c.json(data)
  } catch (error) {
    console.error('Booking complete error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get conversations
app.get('/api/conversations', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        customer:users!customer_id(id, display_name, avatar_url),
        provider:users!provider_id(id, display_name, avatar_url),
        booking:bookings!booking_id(id, service_id, status),
        last_message:messages(content, created_at, sender_id)
      `)
      .or(`customer_id.eq.${userId},provider_id.eq.${userId}`)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
    
    if (error) {
      console.error('Conversations fetch error:', error)
      return c.json({ error: 'Failed to fetch conversations' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Conversations error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get single conversation
app.get('/api/conversations/:id', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const conversationId = c.req.param('id')
    
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        customer:users!customer_id(*),
        provider:users!provider_id(*),
        booking:bookings!booking_id(*)
      `)
      .eq('id', conversationId)
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    
    // Verify user is part of conversation
    if (data.customer_id !== userId && data.provider_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Conversation error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Send message
app.post('/api/messages', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const { conversationId, content } = await c.req.json()
    
    // Verify user is part of conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('customer_id, provider_id')
      .eq('id', conversationId)
      .single()
    
    if (convError || !conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    
    if (conversation.customer_id !== userId && conversation.provider_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Create message
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        is_read: false
      })
      .select()
      .single()
    
    if (error) {
      console.error('Message send error:', error)
      return c.json({ error: 'Failed to send message' }, 500)
    }
    
    // Update conversation last activity
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
    
    return c.json(data)
  } catch (error) {
    console.error('Message error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get messages for conversation
app.get('/api/messages/:conversationId', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const conversationId = c.req.param('conversationId')
    const { limit = 50, before } = c.req.query()
    
    // Verify user is part of conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('customer_id, provider_id')
      .eq('id', conversationId)
      .single()
    
    if (convError || !conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    
    if (conversation.customer_id !== userId && conversation.provider_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Fetch messages
    let query = supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users!sender_id(id, display_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (before) {
      query = query.lt('created_at', before)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Messages fetch error:', error)
      return c.json({ error: 'Failed to fetch messages' }, 500)
    }
    
    // Mark messages as read
    await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
    
    return c.json(data || [])
  } catch (error) {
    console.error('Messages error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Create or update review
app.post('/api/reviews', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const { bookingId, rating, comment } = await c.req.json()
    
    // Validate booking and check if user can review
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()
    
    if (bookingError || !booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    if (booking.customer_id !== userId) {
      return c.json({ error: 'Only customer can review' }, 403)
    }
    
    if (booking.status !== 'completed') {
      return c.json({ error: 'Can only review completed bookings' }, 400)
    }
    
    // Check if within 7-day review window
    const completedDate = new Date(booking.completed_at)
    const daysSinceCompletion = Math.floor((Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceCompletion > 7) {
      return c.json({ error: 'Review window has expired (7 days)' }, 400)
    }
    
    // Check if review exists
    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .single()
    
    let review
    if (existingReview) {
      // Update existing review
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .update({
          rating,
          comment,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingReview.id)
        .select()
        .single()
      
      if (error) {
        console.error('Review update error:', error)
        return c.json({ error: 'Failed to update review' }, 500)
      }
      review = data
    } else {
      // Create new review
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .insert({
          booking_id: bookingId,
          service_id: booking.service_id,
          reviewer_id: userId,
          reviewee_id: booking.provider_id,
          rating,
          comment
        })
        .select()
        .single()
      
      if (error) {
        console.error('Review create error:', error)
        return c.json({ error: 'Failed to create review' }, 500)
      }
      review = data
    }
    
    // Update provider rating
    const { data: providerReviews } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', booking.provider_id)
    
    if (providerReviews && providerReviews.length > 0) {
      const avgRating = providerReviews.reduce((sum, r) => sum + r.rating, 0) / providerReviews.length
      
      await supabaseAdmin
        .from('users')
        .update({
          rating: avgRating,
          review_count: providerReviews.length
        })
        .eq('id', booking.provider_id)
    }
    
    // Update service rating
    const { data: serviceReviews } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('service_id', booking.service_id)
    
    if (serviceReviews && serviceReviews.length > 0) {
      const avgRating = serviceReviews.reduce((sum, r) => sum + r.rating, 0) / serviceReviews.length
      
      await supabaseAdmin
        .from('services')
        .update({
          rating: avgRating,
          review_count: serviceReviews.length
        })
        .eq('id', booking.service_id)
    }
    
    return c.json(review)
  } catch (error) {
    console.error('Review error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get review for booking
app.get('/api/reviews/:bookingId', verifyPrivyAuth, async (c) => {
  try {
    const bookingId = c.req.param('bookingId')
    
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        reviewer:users!reviewer_id(display_name, avatar_url),
        reviewee:users!reviewee_id(display_name, avatar_url)
      `)
      .eq('booking_id', bookingId)
      .single()
    
    if (error) {
      // Review might not exist yet
      if (error.code === 'PGRST116') {
        return c.json(null)
      }
      console.error('Review fetch error:', error)
      return c.json({ error: 'Failed to fetch review' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Review error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Generate meeting link
app.post('/api/meeting/generate', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const { bookingId } = await c.req.json()
    
    // Import meeting generation module
    const { generateMeetingLinkForBooking } = await import('./meeting-generation.js')
    
    // Verify user is the provider
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('provider_id')
      .eq('id', bookingId)
      .single()
    
    if (error || !booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    if (booking.provider_id !== userId) {
      return c.json({ error: 'Only provider can generate meeting link' }, 403)
    }
    
    // Generate meeting link
    const meetingLink = await generateMeetingLinkForBooking(bookingId)
    
    if (!meetingLink) {
      return c.json({ error: 'Failed to generate meeting link' }, 500)
    }
    
    return c.json({ meetingLink })
  } catch (error) {
    console.error('Meeting generation error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Delete meeting
app.delete('/api/meeting/:bookingId', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('bookingId')
    
    // Import meeting generation module
    const { deleteMeetingForBooking } = await import('./meeting-generation.js')
    
    // Verify user is part of booking
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('customer_id, provider_id')
      .eq('id', bookingId)
      .single()
    
    if (error || !booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    if (booking.customer_id !== userId && booking.provider_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Delete meeting
    await deleteMeetingForBooking(bookingId)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Meeting deletion error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// File upload endpoint
app.post('/api/upload', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const formData = await c.req.formData()
    const file = formData.get('file')
    const bucket = formData.get('bucket') || 'avatars'
    
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400)
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Only images are allowed.' }, 400)
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400)
    }
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = `${userId}/${fileName}`
    
    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const { data, error } = await supabaseAdmin
      .storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true
      })
    
    if (error) {
      console.error('Upload error:', error)
      return c.json({ error: 'Failed to upload file' }, 500)
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from(bucket)
      .getPublicUrl(filePath)
    
    return c.json({
      url: publicUrl,
      path: filePath,
      bucket
    })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get user meeting integrations
app.get('/api/integrations', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    
    const { data, error } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Integrations fetch error:', error)
      return c.json({ error: 'Failed to fetch integrations' }, 500)
    }
    
    // Remove sensitive data before sending
    const sanitized = data?.map(integration => ({
      ...integration,
      access_token: undefined,
      refresh_token: undefined
    }))
    
    return c.json(sanitized || [])
  } catch (error) {
    console.error('Integrations error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Disconnect integration
app.delete('/api/integrations/:id', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const integrationId = c.req.param('id')
    
    const { error } = await supabaseAdmin
      .from('user_meeting_integrations')
      .update({ is_active: false })
      .eq('id', integrationId)
      .eq('user_id', userId)
    
    if (error) {
      console.error('Integration disconnect error:', error)
      return c.json({ error: 'Failed to disconnect integration' }, 500)
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Integration error:', error)
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