import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { setupWebSocket, getIO } from './websocket.js'

// Load environment variables
dotenv.config({ path: '../.env.local' })

// Initialize Hono app
const app = new Hono()

// Enable CORS for your frontend
app.use('*', cors({
  origin: [
    'http://localhost:8080', 
    'http://localhost:5173',
    'https://localhost:8443',
    'https://192.168.0.10:8443',
    /^https:\/\/192\.168\.\d+\.\d+:8443$/, // Allow any local IP on port 8443
    'https://roulette-phenomenon-airfare-claire.trycloudflare.com',
    /https:\/\/.*\.trycloudflare\.com$/, // Allow any Cloudflare tunnel
    /https:\/\/.*\.up\.railway\.app$/, // Allow all Railway domains
    'https://staging.timee.app', // Staging frontend domain
    /https:\/\/.*\.timee\.app$/ // Allow all timee.app subdomains
  ],
  credentials: true,
  // Safari-specific headers
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie']
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
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
    const { provider_id, category, is_visible } = c.req.query()
    
    let query = supabaseAdmin.from('services').select('*')
    
    if (provider_id) query = query.eq('provider_id', provider_id)
    if (category) query = query.eq('category_id', category)
    if (is_visible !== undefined) query = query.eq('is_visible', is_visible === 'true')
    
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

// Create booking (optimized with combined operations)
app.post('/api/bookings', verifyPrivyAuth, async (c) => {
  try {
    const startTime = Date.now()
    const userId = c.get('userId')
    const body = await c.req.json()
    const { service_id: serviceId, scheduled_at: scheduledAt, customer_notes: customerNotes, location, is_online: isOnline } = body
    
    // First, get the service
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single()
    
    if (serviceError || !service) {
      return c.json({ error: 'Service not found' }, 404)
    }
    
    // Then check for conflicting bookings separately
    const bookingStart = new Date(scheduledAt)
    const bookingEnd = new Date(bookingStart.getTime() + service.duration_minutes * 60000)
    
    const { data: conflictingBookings, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, scheduled_at, duration_minutes')
      .eq('service_id', serviceId)
      .in('status', ['pending', 'confirmed'])
    
    if (bookingError) {
      // Continue anyway - don't fail the booking for this
    }
    
    // Check for time conflicts
    const hasConflict = conflictingBookings?.some(booking => {
      const existingStart = new Date(booking.scheduled_at)
      const existingEnd = new Date(existingStart.getTime() + booking.duration_minutes * 60000)
      
      // Check if times overlap
      return (bookingStart < existingEnd && bookingEnd > existingStart)
    })
    
    if (hasConflict) {
      return c.json({ error: 'Time slot not available' }, 400)
    }
    
    // Calculate service fee (10% platform fee)
    const serviceFee = service.price * 0.1
    
    // Atomic operation: Create booking and conversation together
    const bookingData = {
      service_id: serviceId,
      customer_id: userId,
      provider_id: service.provider_id,
      scheduled_at: scheduledAt,
      duration_minutes: service.duration_minutes,
      total_price: service.price,
      service_fee: serviceFee,
      status: 'pending',
      customer_notes: customerNotes || null,
      location: location || service.location,
      is_online: isOnline ?? service.is_online
    }
    
    // Use Promise.all for parallel execution of booking and conversation creation
    const [bookingResult, conversationResult] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .insert(bookingData)
        .select()
        .single(),
      // Pre-generate conversation data to create immediately after booking
      Promise.resolve({
        provider_id: service.provider_id,
        customer_id: userId,
        is_active: true
      })
    ])
    
    if (bookingResult.error) {
      console.error('Booking creation error:', bookingResult.error)
      return c.json({ error: 'Failed to create booking' }, 500)
    }
    
    const booking = bookingResult.data
    
    // Create conversation with booking ID
    const { error: conversationError } = await supabaseAdmin
      .from('conversations')
      .insert({
        booking_id: booking.id,
        ...conversationResult
      })
    
    if (conversationError) {
      // Log error but don't fail the booking - conversation can be created later
      console.error('Conversation creation warning:', conversationError)
    }
    
    const endTime = Date.now()
    console.log(`✅ Optimized booking creation: ${endTime - startTime}ms | Booking ID: ${booking.id}`)
    
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
    delete body.timeSlots // Remove if accidentally sent (camelCase version)
    
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

// Toggle service visibility
app.patch('/api/services/:serviceId/visibility', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const serviceId = c.req.param('serviceId')
    const body = await c.req.json()
    const { is_visible } = body
    
    if (typeof is_visible !== 'boolean') {
      return c.json({ error: 'is_visible must be a boolean' }, 400)
    }
    
    const { data, error } = await supabaseAdmin
      .from('services')
      .update({ is_visible })
      .eq('id', serviceId)
      .eq('provider_id', userId) // Ensure user owns the service
      .select()
      .single()
    
    if (error) {
      console.error('Service visibility toggle error:', error)
      return c.json({ error: 'Failed to update service visibility' }, 500)
    }
    
    if (!data) {
      return c.json({ error: 'Service not found' }, 404)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Service visibility toggle error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get user's bookings
app.get('/api/bookings/user/:userId', verifyPrivyAuth, async (c) => {
  try {
    const startTime = Date.now()
    const userId = c.get('userId')
    const targetUserId = c.req.param('userId')
    const { role } = c.req.query()
    
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        service:services(*),
        customer:users!customer_id(*),
        provider:users!provider_id(*),
        reviews!booking_id(
          id,
          rating,
          comment,
          created_at,
          updated_at,
          reviewer:users!reviewer_id(display_name, avatar),
          reviewee:users!reviewee_id(display_name, avatar)
        )
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
    
    const endTime = Date.now()
    const reviewCount = data ? data.reduce((acc, booking) => {
      const reviews = Array.isArray(booking.reviews) ? booking.reviews.length : 0
      return acc + reviews
    }, 0) : 0
    console.log(`✅ Optimized bookings query: ${endTime - startTime}ms | ${data?.length || 0} bookings | ${reviewCount} reviews | Role: ${role || 'all'}`)
    
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

// Get categories (public)
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

// Get public user profile (no auth required)
app.get('/api/profile/public/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Public profile fetch error:', error)
      return c.json({ error: 'Profile not found' }, 404)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Public profile error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get public user services (no auth required)
app.get('/api/services/public/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    
    const { data, error } = await supabaseAdmin
      .from('services')
      .select(`
        *,
        categories(name, icon, color)
      `)
      .eq('provider_id', userId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Public services fetch error:', error)
      return c.json({ error: 'Failed to fetch services' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Public services error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get public provider reviews (no auth required)
app.get('/api/reviews/public/provider/:providerId', async (c) => {
  try {
    const providerId = c.req.param('providerId')
    
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        services(title),
        reviewer:users!reviewer_id(display_name, avatar)
      `)
      .eq('reviewee_id', providerId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Public reviews fetch error:', error)
      return c.json({ error: 'Failed to fetch reviews' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Public reviews error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get public services for discovery (no auth required)
app.get('/api/services/public', async (c) => {
  try {
    const { search, category, minPrice, maxPrice, location } = c.req.query()
    
    let query = supabaseAdmin
      .from('services')
      .select(`
        *,
        provider:users!provider_id(display_name, avatar, rating, review_count)
      `)
      .eq('is_visible', true)
    
    // Only apply filters if they have valid values
    if (search && search !== 'undefined' && search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }
    if (category && category !== 'undefined' && category !== 'all') {
      query = query.eq('category_id', category)
    }
    if (minPrice && minPrice !== 'undefined') {
      query = query.gte('price', parseFloat(minPrice))
    }
    if (maxPrice && maxPrice !== 'undefined') {
      query = query.lte('price', parseFloat(maxPrice))
    }
    if (location && location !== 'undefined' && location.trim()) {
      query = query.ilike('location', `%${location}%`)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('Public services fetch error:', error)
      return c.json({ error: 'Failed to fetch services' }, 500)
    }
    
    return c.json({ services: data || [] })
  } catch (error) {
    console.error('Public services error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Check username availability
app.get('/api/username/check/:username', async (c) => {
  try {
    const username = c.req.param('username').toLowerCase()
    
    // Server-side validation
    const blacklist = [
      'admin', 'administrator', 'api', 'app', 'auth', 'balance', 'balances', 
      'book', 'booking', 'bookings', 'chat', 'customer', 'dashboard', 
      'discover', 'help', 'home', 'index', 'login', 'logout', 'message', 
      'messages', 'order', 'orders', 'profile', 'provider', 'resume', 
      'root', 'service', 'services', 'setting', 'settings', 'support', 
      'user', 'wallet', 'wallets', 'www', 'mail', 'email', 'ftp', 
      'blog', 'news', 'shop', 'store', 'test', 'demo', 'example',
      'null', 'undefined', 'true', 'false', 'system', 'config', 'onboarding'
    ]
    
    // Check format
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return c.json({ 
        available: false, 
        error: 'Username must be 3-30 characters and contain only letters, numbers, underscores, and dashes' 
      })
    }
    
    // Check blacklist
    if (blacklist.includes(username)) {
      return c.json({ available: false, error: 'This username is reserved' })
    }
    
    // Check if username exists
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('username', username)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Username check error:', error)
      return c.json({ error: 'Failed to check username' }, 500)
    }
    
    return c.json({ available: !data })
  } catch (error) {
    console.error('Username check error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Update user username
app.patch('/api/username', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const { username } = await c.req.json()
    
    if (!username) {
      return c.json({ error: 'Username is required' }, 400)
    }
    
    const normalizedUsername = username.toLowerCase()
    
    // Server-side validation (same as check endpoint)
    const blacklist = [
      'admin', 'administrator', 'api', 'app', 'auth', 'balance', 'balances', 
      'book', 'booking', 'bookings', 'chat', 'customer', 'dashboard', 
      'discover', 'help', 'home', 'index', 'login', 'logout', 'message', 
      'messages', 'order', 'orders', 'profile', 'provider', 'resume', 
      'root', 'service', 'services', 'setting', 'settings', 'support', 
      'user', 'wallet', 'wallets', 'www', 'mail', 'email', 'ftp', 
      'blog', 'news', 'shop', 'store', 'test', 'demo', 'example',
      'null', 'undefined', 'true', 'false', 'system', 'config', 'onboarding'
    ]
    
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(normalizedUsername) || blacklist.includes(normalizedUsername)) {
      return c.json({ error: 'Invalid username' }, 400)
    }
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ username: normalizedUsername })
      .eq('id', userId)
      .select()
      .single()
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        return c.json({ error: 'Username already taken' }, 409)
      }
      console.error('Username update error:', error)
      return c.json({ error: 'Failed to update username' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Username update error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get user by username (for public user pages)
app.get('/api/user/username/:username', async (c) => {
  try {
    const username = c.req.param('username').toLowerCase()
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'User not found' }, 404)
      }
      console.error('User lookup error:', error)
      return c.json({ error: 'Failed to find user' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('User lookup error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get user by ID (public endpoint for profile pages)
app.get('/api/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'User not found' }, 404)
      }
      console.error('User lookup error:', error)
      return c.json({ error: 'Failed to find user' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('User lookup error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get public services by provider (no auth required)
app.get('/api/services/public/:providerId', async (c) => {
  try {
    const providerId = c.req.param('providerId')
    const { timezone } = c.req.query()
    
    console.log('Getting public services for provider:', providerId)
    
    let query = supabaseAdmin
      .from('services')
      .select(`
        *,
        categories(name, icon, color),
        provider:users!provider_id(display_name, avatar, rating)
      `)
      .eq('provider_id', providerId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
    
    const { data, error } = await query
    
    if (error) {
      console.error('Services fetch error:', error)
      return c.json({ error: 'Failed to fetch services' }, 500)
    }
    
    // Transform the data to match expected format
    const transformedServices = (data || []).map(service => ({
      ...service,
      categories: service.categories ? {
        name: service.categories.name,
        icon: service.categories.icon,
        color: service.categories.color
      } : null
    }))
    
    return c.json(transformedServices)
  } catch (error) {
    console.error('Services error:', error)
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
        provider:users!provider_id(display_name, avatar, rating, review_count)
      `)
      .eq('is_visible', true)
    
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
    
    // First, try to get conversations with the current structure
    // Note: We need to fetch conversations without the foreign key relationships first
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Conversations fetch error:', error)
      return c.json({ error: 'Failed to fetch conversations' }, 500)
    }

    // Now enrich each conversation with user and message data
    const enrichedConversations = await Promise.all(
      (conversations || []).map(async (conv) => {
        // For user1/user2 structure, get both users
        let customer = null, provider = null;
        
        const { data: user1Data } = await supabaseAdmin
          .from('users')
          .select('id, display_name, avatar')
          .eq('id', conv.user1_id)
          .single()
          
        const { data: user2Data } = await supabaseAdmin
          .from('users')
          .select('id, display_name, avatar')
          .eq('id', conv.user2_id)
          .single()
          
        // Map to customer/provider structure for consistency
        // The current user is "customer", the other user is "provider"
        if (conv.user1_id === userId) {
          customer = user1Data;
          provider = user2Data;
        } else {
          customer = user2Data;
          provider = user1Data;
        }
        
        // Get booking data if exists (skip for now)
        let booking = null;
        
        // Get last message
        const { data: lastMessage } = await supabaseAdmin
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        return {
          ...conv,
          customer,
          provider,
          booking,
          last_message: lastMessage ? [lastMessage] : []
        }
      })
    )
    
    return c.json(enrichedConversations)
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

// Chat/Conversation endpoints
app.post('/api/conversations', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const { otherUserId } = await c.req.json()
    
    if (!otherUserId) {
      return c.json({ error: 'Other user ID required' }, 400)
    }
    
    // Check if conversation already exists
    // Try both possible combinations
    const { data: existing1 } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user1_id', userId)
      .eq('user2_id', otherUserId)
      .single()
    
    if (existing1) {
      return c.json(existing1)
    }
    
    const { data: existing2 } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user1_id', otherUserId)
      .eq('user2_id', userId)
      .single()
    
    if (existing2) {
      return c.json(existing2)
    }
    
    // Create new conversation
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        user1_id: userId,
        user2_id: otherUserId,
        last_message_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Conversation creation error:', error)
      return c.json({ error: 'Failed to create conversation' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Conversation error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark messages as read
app.put('/api/conversations/:conversationId/read', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const conversationId = c.req.param('conversationId')
    
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false)
    
    if (error) {
      console.error('Mark as read error:', error)
      return c.json({ error: 'Failed to mark messages as read' }, 500)
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Mark as read error:', error)
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
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single()
    
    if (convError || !conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    
    if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
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
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)
    
    // Fetch sender details to return with message
    const { data: sender } = await supabaseAdmin
      .from('users')
      .select('id, display_name, avatar')
      .eq('id', userId)
      .single()
    
    const messageWithSender = { ...data, sender }
    
    // Broadcast message via WebSocket to conversation room
    const io = getIO()
    if (io) {
      // Emit ONLY to conversation room (all users subscribed to this conversation)
      // Don't emit to user rooms as they're already in the conversation room
      io.to(`conversation:${conversationId}`).emit('new_message', messageWithSender)
    }
    
    return c.json(messageWithSender)
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
    const { limit = '50', before } = c.req.query()
    
    // Verify user is part of conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single()
    
    if (convError || !conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    
    if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Fetch messages - simplified without join
    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (before) {
      query = query.lt('created_at', before)
    }
    
    const { data: messages, error } = await query
    
    if (error) {
      console.error('Messages fetch error:', error)
      return c.json({ error: 'Failed to fetch messages' }, 500)
    }
    
    // Fetch sender details for each message
    if (messages && messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))]
      const { data: senders } = await supabaseAdmin
        .from('users')
        .select('id, display_name, avatar')
        .in('id', senderIds)
      
      // Map sender details to messages
      const messagesWithSenders = messages.map(msg => ({
        ...msg,
        sender: senders?.find(s => s.id === msg.sender_id) || null
      }))
      
      return c.json(messagesWithSenders)
    }
    
    return c.json([])
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
    
    // First get the review
    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .select('*')
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
    
    // If review exists, fetch user details separately
    if (review) {
      // Fetch reviewer details
      const { data: reviewer } = await supabaseAdmin
        .from('users')
        .select('display_name, avatar')
        .eq('id', review.reviewer_id)
        .single()
      
      // Fetch reviewee details
      const { data: reviewee } = await supabaseAdmin
        .from('users')
        .select('display_name, avatar')
        .eq('id', review.reviewee_id)
        .single()
      
      // Combine the data
      const reviewWithUsers = {
        ...review,
        reviewer: reviewer || null,
        reviewee: reviewee || null
      }
      
      return c.json(reviewWithUsers)
    }
    
    return c.json(null)
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

// Meeting integrations endpoints
app.get('/api/integrations', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    
    const { data, error } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Failed to fetch integrations:', error)
      return c.json({ error: 'Failed to fetch integrations' }, 500)
    }
    
    return c.json(data || [])
  } catch (error) {
    console.error('Integrations fetch error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Save or update integration
app.post('/api/integrations', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    
    // Validate required fields
    if (!body.platform || !body.access_token) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    
    // Prepare integration data
    const integrationData = {
      user_id: userId,
      platform: body.platform,
      access_token: body.access_token,
      refresh_token: body.refresh_token || null,
      expires_at: body.expires_at || null,
      scope: body.scope || [],
      platform_user_id: body.platform_user_id || null,
      platform_user_email: body.platform_user_email || null,
      is_active: true,
      updated_at: new Date().toISOString()
    }
    
    // Upsert integration (update if exists, insert if not)
    const { data, error } = await supabaseAdmin
      .from('user_meeting_integrations')
      .upsert(integrationData, {
        onConflict: 'user_id,platform',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to save integration:', error)
      return c.json({ error: 'Failed to save integration' }, 500)
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Integration save error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Disconnect integration
app.delete('/api/integrations/:id', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const integrationId = c.req.param('id')
    
    // Delete the integration (only if it belongs to the user)
    const { error } = await supabaseAdmin
      .from('user_meeting_integrations')
      .delete()
      .eq('id', integrationId)
      .eq('user_id', userId)
    
    if (error) {
      console.error('Failed to delete integration:', error)
      return c.json({ error: 'Failed to delete integration' }, 500)
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Integration deletion error:', error)
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

// Export app for use in HTTPS server
export default app

// Only start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Start server with WebSocket support
  const port = process.env.PORT || 4000
  console.log(`🚀 Server starting on port ${port}...`)

  // Create HTTP server
  const server = serve({
    fetch: app.fetch,
    port: port,
    createServer: createServer,
  }, (info) => {
    console.log(`✅ Server running at http://localhost:${info.port}`)
    console.log(`📝 Health check: http://localhost:${info.port}/health`)
    console.log(`🔌 WebSocket server ready`)
  })

  // Setup WebSocket server
  const io = setupWebSocket(server)
}