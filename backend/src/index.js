import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { ethers } from 'ethers'
import { createServer } from 'http'
import { setupWebSocket, getIO } from './websocket.js'
import { 
  getApplicableCancellationPolicies, 
  calculateRefundBreakdown, 
  processCancellation,
  validatePolicySelection 
} from './cancellation-policies.js'
import BlockchainService from './blockchain-service.js'
import EIP712Signer from './eip712-signer.js'
import BlockchainEventMonitor from './event-monitor.js'

// Load environment variables
dotenv.config({ path: '.env' })

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
console.log('Privy App ID:', process.env.PRIVY_APP_ID ? 'Set' : 'Not set');
console.log('Privy App Secret:', process.env.PRIVY_APP_SECRET ? 'Set' : 'Not set');

// Initialize blockchain services
const blockchainService = new BlockchainService();
const eip712Signer = new EIP712Signer();

// Initialize event monitor after supabaseAdmin is created
let eventMonitor;

// Test blockchain connection on startup
blockchainService.testConnection().then(result => {
  if (result.success) {
    console.log('✅ Blockchain connection successful');
  } else {
    console.error('❌ Blockchain connection failed:', result.error);
  }
});

// Initialize clients
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
)

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Initialize blockchain event monitor
eventMonitor = new BlockchainEventMonitor(supabaseAdmin);

// Start event monitoring in production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BLOCKCHAIN_MONITORING === 'true') {
  eventMonitor.startMonitoring().then(() => {
    console.log('🚀 Blockchain event monitoring started');
  }).catch(error => {
    console.error('❌ Failed to start blockchain event monitoring:', error);
  });
} else {
  console.log('⏸️ Blockchain event monitoring disabled (set ENABLE_BLOCKCHAIN_MONITORING=true to enable)');
}

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
    const userId = privyDidToUuid(user.userId)
    c.set('userId', userId)
    
    // Store/update wallet address on each authenticated request
    try {
      console.log('🔍 Fetching wallet address for user:', user.userId)
      const userDetails = await privyClient.getUser(user.userId)
      const smartWallet = userDetails.linkedAccounts?.find(acc => acc.type === 'smart_wallet')
      const embeddedWallet = userDetails.linkedAccounts?.find(acc => acc.type === 'wallet')
      const walletAddress = smartWallet?.address || embeddedWallet?.address

      console.log('💰 Smart wallet:', smartWallet?.address || 'Not found')
      console.log('💰 Embedded wallet:', embeddedWallet?.address || 'Not found')
      console.log('💰 Using wallet address:', walletAddress)

      if (walletAddress) {
        console.log('💾 Updating wallet address in database for user:', userId)
        // Update existing user's wallet address (don't create new users)
        const { data, error } = await supabaseAdmin
          .from('users')
          .update({ 
            wallet_address: walletAddress 
          })
          .eq('id', userId)
        
        if (error) {
          console.error('❌ Database update error:', error)
        } else {
          console.log('✅ Wallet address updated successfully:', walletAddress)
        }
      } else {
        console.warn('⚠️ No wallet address found for user:', user.userId)
      }
    } catch (walletError) {
      // Don't fail auth if wallet update fails, just log warning
      console.warn('⚠️ Failed to update user wallet address:', walletError.message)
      console.error('Full wallet error:', walletError)
    }
    
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
        iss: process.env.SUPABASE_URL + '/auth/v1',
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
    
    // Generate payment authorization for blockchain payment
    console.log('🔐 Generating payment authorization for booking:', booking.id)
    
    try {
    
    // Get customer wallet address from database
    const { data: customerUser } = await supabaseAdmin
      .from('users')
      .select('wallet_address')
      .eq('id', userId)
      .single()
    
    const customerWallet = customerUser?.wallet_address
    console.log('💰 Customer wallet address:', customerWallet)
    
    if (!customerWallet) {
      return c.json({ error: 'No wallet found for customer. Please ensure wallet is connected and try logging in again.' }, 400)
    }

    // Get provider's wallet address from database
    const { data: providerUser } = await supabaseAdmin
      .from('users')
      .select('wallet_address')
      .eq('id', service.provider_id)
      .single()
    
    const providerWallet = providerUser?.wallet_address
    console.log('💰 Provider wallet address:', providerWallet)
    
    if (!providerUser) {
      return c.json({ error: 'Provider not found' }, 400)
    }
    
    if (!providerWallet) {
      return c.json({ error: 'No wallet found for provider. Provider must log in to register their wallet address.' }, 400)
    }
    
    // Calculate fee structure
    const hasInviter = false // TODO: Add inviter logic when implemented
    const feeData = eip712Signer.calculateFees(booking.total_price, hasInviter)
    
    // Generate blockchain booking ID
    const blockchainBookingId = blockchainService.formatBookingId(booking.id)
    
    // Update booking with blockchain booking ID and set status to pending_payment
    await supabaseAdmin
      .from('bookings')
      .update({
        blockchain_booking_id: blockchainBookingId,
        status: 'pending_payment'
      })
      .eq('id', booking.id)
    
    // Generate EIP-712 signature
    const authResult = await eip712Signer.signBookingAuthorization({
      bookingId: booking.id,
      customer: customerWallet,
      provider: providerWallet,
      inviter: ethers.ZeroAddress, // TODO: Add inviter support
      amount: booking.total_price,
      platformFeeRate: feeData.platformFeeRate,
      inviterFeeRate: feeData.inviterFeeRate,
      expiryMinutes: 5 // 5 minute expiry
    })
    
    // Store nonce to prevent replay attacks
    await supabaseAdmin
      .from('signature_nonces')
      .insert({
        nonce: authResult.nonce,
        booking_id: booking.id,
        signature_type: 'booking_authorization'
      })
    
    const endTime = Date.now()
    console.log(`✅ Booking creation with payment authorization: ${endTime - startTime}ms | Booking ID: ${booking.id}`)
    
    // Convert BigInt values to strings for JSON serialization
    const serializableAuthorization = {
      ...authResult.authorization,
      bookingId: authResult.authorization.bookingId.toString(),
      amount: authResult.authorization.amount.toString()
    }

    return c.json({
      booking: { ...booking, status: 'pending_payment', blockchain_booking_id: blockchainBookingId },
      authorization: serializableAuthorization,
      signature: authResult.signature,
      contractAddress: process.env.CONTRACT_ADDRESS,
      usdcAddress: process.env.USDC_ADDRESS,
      feeBreakdown: feeData,
      expiresAt: new Date(authResult.expiry * 1000).toISOString()
    })
    
    } catch (authError) {
      console.error('❌ Payment authorization error:', authError)
      // If payment authorization fails, still return the booking but without payment info
      // This allows the booking to be created and payment can be attempted later
      return c.json({
        booking,
        error: 'Payment authorization failed - booking created but payment required',
        message: 'You can complete payment from your bookings page'
      })
    }
    
  } catch (error) {
    console.error('Booking error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ========== BLOCKCHAIN PAYMENT ENDPOINTS ==========

// Generate payment authorization for booking
app.post('/api/bookings/:id/authorize-payment', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    
    console.log('🔐 Generating payment authorization for booking:', bookingId)
    
    // Get booking details
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customer_id(id, wallet_address),
        provider:provider_id(id, wallet_address),
        service:service_id(*)
      `)
      .eq('id', bookingId)
      .single()
    
    if (bookingError || !booking) {
      console.error('Booking not found:', bookingId, bookingError)
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    // Verify user is the customer
    if (booking.customer_id !== userId) {
      return c.json({ error: 'Unauthorized - not booking customer' }, 403)
    }
    
    // Check booking status
    if (booking.status !== 'pending' && booking.status !== 'pending_payment') {
      return c.json({ error: 'Booking not eligible for payment' }, 400)
    }
    
    // Check if we need customer/provider wallet addresses
    if (!booking.customer?.wallet_address || !booking.provider?.wallet_address) {
      return c.json({ error: 'Wallet addresses not configured for customer or provider' }, 400)
    }
    
    // Calculate fee structure
    const hasInviter = false // TODO: Add inviter logic when implemented
    const feeData = eip712Signer.calculateFees(booking.total_price, hasInviter)
    
    // Generate blockchain booking ID
    const blockchainBookingId = blockchainService.formatBookingId(booking.id)
    
    // Store blockchain booking ID in database
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        blockchain_booking_id: blockchainBookingId,
        status: 'pending_payment'
      })
      .eq('id', booking.id)
    
    if (updateError) {
      console.error('Error updating booking with blockchain ID:', updateError)
      return c.json({ error: 'Failed to prepare booking for payment' }, 500)
    }
    
    // Generate EIP-712 signature
    const authResult = await eip712Signer.signBookingAuthorization({
      bookingId: booking.id,
      customer: booking.customer.wallet_address,
      provider: booking.provider.wallet_address,
      inviter: ethers.ZeroAddress, // TODO: Add inviter support
      amount: booking.total_price,
      platformFeeRate: feeData.platformFeeRate,
      inviterFeeRate: feeData.inviterFeeRate,
      expiryMinutes: 5 // 5 minute expiry
    })
    
    // Store nonce to prevent replay attacks
    const { error: nonceError } = await supabaseAdmin
      .from('signature_nonces')
      .insert({
        nonce: authResult.nonce,
        booking_id: booking.id,
        signature_type: 'booking_authorization'
      })
    
    if (nonceError) {
      console.error('Error storing nonce:', nonceError)
      return c.json({ error: 'Failed to generate secure authorization' }, 500)
    }
    
    console.log('✅ Payment authorization generated for booking:', bookingId)
    
    // Convert BigInt values to strings for JSON serialization
    const serializableAuthorization = {
      ...authResult.authorization,
      bookingId: authResult.authorization.bookingId.toString(),
      amount: authResult.authorization.amount.toString()
    }
    
    return c.json({
      authorization: serializableAuthorization,
      signature: authResult.signature,
      contractAddress: process.env.CONTRACT_ADDRESS,
      usdcAddress: process.env.USDC_ADDRESS,
      feeBreakdown: feeData,
      expiresAt: new Date(authResult.expiry * 1000).toISOString()
    })
    
  } catch (error) {
    console.error('❌ Payment authorization error:', error)
    return c.json({ error: 'Failed to generate payment authorization' }, 500)
  }
})

// Mark booking as complete and trigger smart contract
app.post('/api/bookings/:id/complete-service', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    
    console.log('🎉 Processing service completion for booking:', bookingId)
    
    // Get booking details with blockchain data
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:customer_id(id, wallet_address),
        provider:provider_id(id, wallet_address),
        service:service_id(*)
      `)
      .eq('id', bookingId)
      .single()
    
    if (bookingError || !booking) {
      console.error('Booking not found:', bookingId, bookingError)
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    // Verify user is the customer (only customer can mark as complete)
    if (booking.customer_id !== userId) {
      return c.json({ error: 'Unauthorized - only customer can complete service' }, 403)
    }
    
    // Check booking status - must be in_progress to complete
    if (booking.status !== 'in_progress') {
      return c.json({ error: `Booking not eligible for completion (status: ${booking.status})` }, 400)
    }
    
    // Check if blockchain booking ID exists (payment must be confirmed)
    if (!booking.blockchain_booking_id) {
      return c.json({ error: 'Booking not paid via blockchain - cannot complete' }, 400)
    }
    
    // Check if customer has wallet address for blockchain interaction
    if (!booking.customer?.wallet_address) {
      return c.json({ error: 'Customer wallet address not configured' }, 400)
    }
    
    console.log('✅ Service completion validated for booking:', bookingId)
    
    // Return data needed for frontend to call smart contract
    return c.json({
      bookingId: booking.id,
      blockchain_booking_id: booking.blockchain_booking_id,
      customer_wallet: booking.customer.wallet_address,
      provider_wallet: booking.provider?.wallet_address,
      amount: booking.total_price,
      status: booking.status,
      service_title: booking.service?.title,
      message: 'Ready for blockchain completion. Frontend should call completeService on smart contract.'
    })
    
  } catch (error) {
    console.error('❌ Service completion error:', error)
    return c.json({ error: 'Failed to process service completion' }, 500)
  }
})

// Backend-triggered service completion (for cron/automation)
app.post('/api/bookings/:id/complete-service-backend', async (c) => {
  try {
    const bookingId = c.req.param('id')
    
    console.log('🤖 Backend completing service for booking:', bookingId)
    
    // Get booking details
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()
    
    if (bookingError || !booking) {
      console.error('Booking not found:', bookingId, bookingError)
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    // Check booking status
    if (booking.status !== 'in_progress') {
      return c.json({ error: `Booking not eligible for completion (status: ${booking.status})` }, 400)
    }
    
    // Check if blockchain booking ID exists
    if (!booking.blockchain_booking_id) {
      return c.json({ error: 'Booking not paid via blockchain - cannot complete' }, 400)
    }
    
    // Backend will call smart contract directly using backendSigner
    const blockchainBookingId = blockchainService.formatBookingId(booking.id)
    
    try {
      // Call smart contract completeService as backend signer
      const txHash = await blockchainService.completeServiceAsBackend(blockchainBookingId)
      
      console.log('✅ Backend completed service on blockchain:', txHash)
      
      // Update booking with completion transaction
      await supabaseAdmin
        .from('bookings')
        .update({
          completion_tx_hash: txHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
      
      return c.json({
        success: true,
        txHash,
        message: 'Service completed by backend on blockchain'
      })
      
    } catch (blockchainError) {
      console.error('❌ Backend blockchain completion failed:', blockchainError)
      return c.json({ error: 'Backend blockchain completion failed' }, 500)
    }
    
  } catch (error) {
    console.error('❌ Backend service completion error:', error)
    return c.json({ error: 'Failed to complete service via backend' }, 500)
  }
})

// Get booking blockchain status
app.get('/api/bookings/:id/blockchain-status', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    
    // Get booking with blockchain data
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()
    
    if (error || !booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    // Verify user has access to this booking
    if (booking.customer_id !== userId && booking.provider_id !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    return c.json({
      blockchain_booking_id: booking.blockchain_booking_id,
      blockchain_tx_hash: booking.blockchain_tx_hash,
      blockchain_confirmed_at: booking.blockchain_confirmed_at,
      completion_tx_hash: booking.completion_tx_hash,
      cancellation_tx_hash: booking.cancellation_tx_hash,
      status: booking.status
    })
    
  } catch (error) {
    console.error('❌ Blockchain status error:', error)
    return c.json({ error: 'Failed to get blockchain status' }, 500)
  }
})

// Get event monitoring status
app.get('/api/blockchain/monitor-status', async (c) => {
  try {
    const status = eventMonitor.getStatus();
    return c.json({
      ...status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting monitor status:', error);
    return c.json({ error: 'Failed to get monitoring status' }, 500);
  }
})

// Start event monitoring (admin only)
app.post('/api/blockchain/start-monitoring', async (c) => {
  try {
    // TODO: Add admin authentication check
    await eventMonitor.startMonitoring();
    return c.json({ message: 'Event monitoring started', status: eventMonitor.getStatus() });
  } catch (error) {
    console.error('❌ Error starting monitoring:', error);
    return c.json({ error: 'Failed to start monitoring' }, 500);
  }
})

// Stop event monitoring (admin only)
app.post('/api/blockchain/stop-monitoring', async (c) => {
  try {
    // TODO: Add admin authentication check
    await eventMonitor.stopMonitoring();
    return c.json({ message: 'Event monitoring stopped', status: eventMonitor.getStatus() });
  } catch (error) {
    console.error('❌ Error stopping monitoring:', error);
    return c.json({ error: 'Failed to stop monitoring' }, 500);
  }
})

// Complete service (triggers blockchain payment distribution)

// ========== END BLOCKCHAIN ENDPOINTS ==========

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
    
    // Generate meeting link when booking is confirmed and is online
    if (updates.status === 'confirmed' && data.is_online && !data.meeting_link) {
      console.log('🔗 Booking confirmed, generating meeting link for booking:', bookingId)
      try {
        const { generateMeetingLinkForBooking } = await import('./meeting-generation.js')
        const meetingLink = await generateMeetingLinkForBooking(bookingId)
        if (meetingLink) {
          console.log('✅ Meeting link generated successfully for confirmed booking:', meetingLink)
          // Update the data object to include the meeting link
          data.meeting_link = meetingLink
        } else {
          console.log('⚠️ Meeting link generation failed for confirmed booking - provider may not have integrations set up')
        }
      } catch (error) {
        console.error('❌ Failed to generate meeting link for confirmed booking:', bookingId, error)
        // Don't fail the confirmation, just log the error
      }
    }
    
    // Also generate meeting link when transitioning to in_progress (fallback for edge cases)
    if (updates.status === 'in_progress' && data.is_online && !data.meeting_link) {
      console.log('🔗 Booking starting (in_progress), generating meeting link as fallback for booking:', bookingId)
      try {
        const { generateMeetingLinkForBooking } = await import('./meeting-generation.js')
        const meetingLink = await generateMeetingLinkForBooking(bookingId)
        if (meetingLink) {
          console.log('✅ Meeting link generated successfully for in_progress booking (fallback):', meetingLink)
          // Update the data object to include the meeting link
          data.meeting_link = meetingLink
        } else {
          console.log('⚠️ Meeting link generation failed for in_progress booking - provider may not have integrations set up')
        }
      } catch (error) {
        console.error('❌ Failed to generate meeting link for in_progress booking:', bookingId, error)
        // Don't fail the status update, just log the error
      }
    }
    
    return c.json(data)
  } catch (error) {
    console.error('Booking update error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Reject paid booking (calls smart contract cancellation)
app.post('/api/bookings/:bookingId/reject', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('bookingId')
    const { reason = 'Booking rejected by provider' } = await c.req.json()
    
    // Get booking details
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()
    
    if (fetchError || !booking) {
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    // Only provider can reject bookings
    if (booking.provider_id !== userId) {
      return c.json({ error: 'Only provider can reject bookings' }, 403)
    }
    
    // Can only reject paid bookings
    if (booking.status !== 'paid') {
      return c.json({ error: 'Can only reject paid bookings' }, 400)
    }
    
    // Check if we have blockchain booking ID
    if (!booking.blockchain_booking_id) {
      return c.json({ error: 'No blockchain booking ID found' }, 400)
    }

    console.log(`🚫 Provider ${userId} rejecting paid booking ${bookingId}`)
    console.log(`Blockchain booking ID: ${booking.blockchain_booking_id}`)
    console.log(`Reason: ${reason}`)
    
    // Generate cancellation authorization signature
    // For provider rejection, give full refund to customer (100% refund policy)
    const totalAmount = parseFloat(booking.total_price)
    const cancellationAuth = await eip712Signer.signCancellationAuthorization({
      bookingId: booking.blockchain_booking_id,
      customerAmount: totalAmount, // Full refund to customer
      providerAmount: 0,          // No compensation to provider since they rejected
      platformAmount: 0,          // No platform fee retained
      inviterAmount: 0,           // No inviter fee retained
      reason: reason
    })
    
    console.log(`✅ Generated cancellation authorization for booking ${bookingId}`)
    
    // Update booking status to rejected (will be updated to cancelled by event monitor)
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'rejected',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        blockchain_cancellation_auth: cancellationAuth.authorization,
        blockchain_cancellation_signature: cancellationAuth.signature
      })
      .eq('id', bookingId)
    
    if (updateError) {
      console.error('Error updating booking to rejected:', updateError)
      return c.json({ error: 'Failed to update booking status' }, 500)
    }
    
    return c.json({
      success: true,
      message: 'Booking rejected successfully',
      authorization: {
        ...cancellationAuth.authorization,
        // Convert BigInts to strings for JSON serialization
        bookingId: cancellationAuth.authorization.bookingId,
        customerAmount: cancellationAuth.authorization.customerAmount.toString(),
        providerAmount: cancellationAuth.authorization.providerAmount.toString(),
        platformAmount: cancellationAuth.authorization.platformAmount.toString(),
        inviterAmount: cancellationAuth.authorization.inviterAmount.toString(),
        expiry: cancellationAuth.authorization.expiry.toString(),
        nonce: cancellationAuth.authorization.nonce.toString()
      },
      signature: cancellationAuth.signature
    })
  } catch (error) {
    console.error('❌ Error rejecting booking:', error)
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

// Get applicable cancellation policies for a booking
app.get('/api/bookings/:id/cancellation-policies', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    
    const policies = await getApplicableCancellationPolicies(bookingId, userId)
    
    return c.json(policies)
  } catch (error) {
    console.error('Get cancellation policies error:', error)
    if (error.message === 'Booking not found') {
      return c.json({ error: 'Booking not found' }, 404)
    }
    if (error.message === 'Unauthorized to cancel this booking') {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get refund breakdown for a specific policy
app.post('/api/bookings/:id/refund-breakdown', verifyPrivyAuth, async (c) => {
  try {
    const bookingId = c.req.param('id')
    const { policyId } = await c.req.json()
    
    if (!policyId) {
      return c.json({ error: 'Policy ID is required' }, 400)
    }
    
    const breakdown = await calculateRefundBreakdown(bookingId, policyId)
    
    return c.json(breakdown)
  } catch (error) {
    console.error('Calculate refund breakdown error:', error)
    if (error.message === 'Booking not found') {
      return c.json({ error: 'Booking not found' }, 404)
    }
    if (error.message === 'Cancellation policy not found') {
      return c.json({ error: 'Invalid policy selected' }, 400)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Enhanced cancellation with policy selection
app.post('/api/bookings/:id/cancel-with-policy', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    const { policyId, explanation } = await c.req.json()
    
    if (!policyId) {
      return c.json({ error: 'Policy ID is required' }, 400)
    }
    
    // Validate that the policy is applicable
    const isValid = await validatePolicySelection(bookingId, userId, policyId)
    if (!isValid) {
      return c.json({ error: 'Selected policy is not applicable' }, 400)
    }
    
    const result = await processCancellation(bookingId, userId, policyId, explanation)
    
    return c.json(result)
  } catch (error) {
    console.error('Enhanced cancellation error:', error)
    
    if (error.message === 'Selected cancellation policy is not applicable to this booking') {
      return c.json({ error: 'Policy not applicable' }, 400)
    }
    if (error.message === 'An explanation is required for this type of cancellation') {
      return c.json({ error: 'Explanation required' }, 400)
    }
    if (error.message === 'Booking not found') {
      return c.json({ error: 'Booking not found' }, 404)
    }
    if (error.message === 'Unauthorized to cancel this booking') {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    return c.json({ error: 'Failed to process cancellation' }, 500)
  }
})

// Blockchain authorization for cancellation
app.post('/api/bookings/:id/authorize-cancellation', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const bookingId = c.req.param('id')
    const { policyId, explanation } = await c.req.json()
    
    if (!policyId) {
      return c.json({ error: 'Policy ID is required' }, 400)
    }


    console.log('🔐 Authorizing cancellation for booking:', bookingId)

    // Get booking first to debug
    console.log('🔍 Looking for booking:', bookingId)
    
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()
    
    console.log('🔍 Basic booking result:', booking ? 'FOUND' : 'NOT FOUND', bookingError)
    
    if (bookingError || !booking) {
      console.error('❌ Basic booking query failed:', bookingError)
      return c.json({ error: 'Booking not found' }, 404)
    }
    
    // Get service data
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', booking.service_id)
      .single()
    
    booking.service = service
    
    // Get customer wallet address from database
    const { data: customerUser } = await supabaseAdmin
      .from('users')
      .select('wallet_address')
      .eq('id', booking.customer_id)
      .single()
    
    const customerWallet = customerUser?.wallet_address
    console.log('💰 Customer wallet address:', customerWallet)
    
    // Get provider wallet address from database  
    const { data: providerUser } = await supabaseAdmin
      .from('users')
      .select('wallet_address')
      .eq('id', booking.provider_id)
      .single()
    
    const providerWallet = providerUser?.wallet_address
    console.log('💰 Provider wallet address:', providerWallet)

    // Validate user can cancel this booking
    const isCustomer = booking.customer_id === userId
    const isProvider = booking.provider_id === userId
    
    if (!isCustomer && !isProvider) {
      return c.json({ error: 'Unauthorized to cancel this booking' }, 403)
    }

    // Validate that the policy is applicable
    const isValid = await validatePolicySelection(bookingId, userId, policyId)
    if (!isValid) {
      return c.json({ error: 'Selected policy is not applicable' }, 400)
    }

    // Calculate refund breakdown
    const refundBreakdown = await calculateRefundBreakdown(bookingId, policyId)
    
    // Validate we have wallet addresses
    if (!customerWallet || !providerWallet) {
      console.error('❌ Wallet addresses not found:', { customerWallet, providerWallet })
      return c.json({ error: 'Wallet addresses not configured. Please ensure wallet is connected.' }, 400)
    }

    console.log('✅ Using wallet addresses from Privy API')

    // Generate EIP-712 authorization signature
    const eip712Signer = new EIP712Signer()
    const authorization = await eip712Signer.signCancellationAuthorization({
      bookingId: booking.id,
      customerAmount: refundBreakdown.breakdown.customerRefund,
      providerAmount: refundBreakdown.breakdown.providerEarnings,
      platformAmount: refundBreakdown.breakdown.platformFee,
      inviterAmount: 0, // TODO: Handle inviter fees if applicable
      reason: explanation || refundBreakdown.policyTitle,
      expiryMinutes: 5
    })

    console.log('✅ Generated cancellation authorization')

    // Convert BigInt values to strings for JSON serialization
    const serializableAuthorization = {
      ...authorization.authorization,
      customerAmount: authorization.authorization.customerAmount.toString(),
      providerAmount: authorization.authorization.providerAmount.toString(),
      platformAmount: authorization.authorization.platformAmount.toString(),
      inviterAmount: authorization.authorization.inviterAmount.toString(),
      expiry: authorization.authorization.expiry.toString(),
      nonce: authorization.authorization.nonce.toString()
    }

    // Determine current user's wallet address
    const currentUserWallet = isCustomer ? customerWallet : providerWallet

    return c.json({
      authorization: serializableAuthorization,
      signature: authorization.signature,
      refundBreakdown,
      walletAddress: currentUserWallet,
      expiry: authorization.expiry,
      nonce: authorization.nonce
    })

  } catch (error) {
    console.error('❌ Cancellation authorization error:', error)
    return c.json({ error: 'Failed to generate cancellation authorization' }, 500)
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
      return c.json({ 
        error: 'Failed to generate meeting link. Please check your Google integration settings and try reconnecting your Google account.',
        details: 'Meeting link generation failed - this usually indicates expired or invalid OAuth credentials.'
      }, 500)
    }
    
    return c.json({ meetingLink })
  } catch (error) {
    console.error('Meeting generation error:', error)
    
    // Provide more specific error messages based on the error
    let errorMessage = 'Failed to generate meeting link'
    if (error.message?.includes('401') || error.message?.includes('authError')) {
      errorMessage = 'Google authentication failed. Please reconnect your Google account in integrations.'
    } else if (error.message?.includes('refresh token')) {
      errorMessage = 'Google authorization expired. Please reconnect your Google account in integrations.'
    } else if (error.message?.includes('Calendar API error')) {
      errorMessage = 'Google Calendar API error. Please check your Google account permissions.'
    }
    
    return c.json({ error: errorMessage }, 500)
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

// Secure Google OAuth callback handler
app.post('/api/oauth/google-callback', verifyPrivyAuth, async (c) => {
  try {
    const userId = c.get('userId')
    const { code, redirectUri } = await c.req.json()
    
    if (!code) {
      return c.json({ error: 'Authorization code is required' }, 400)
    }
    
    console.log('🔐 Processing Google OAuth callback for user:', userId)
    
    // Exchange code for tokens securely on backend
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    
    const tokenData = await tokenResponse.json()
    
    if (tokenData.error) {
      console.error('Google token exchange failed:', tokenData.error_description || tokenData.error)
      return c.json({ 
        error: `Token exchange failed: ${tokenData.error_description || tokenData.error}` 
      }, 400)
    }
    
    if (!tokenData.access_token) {
      console.error('No access token received from Google')
      return c.json({ error: 'No access token received' }, 400)
    }
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })
    
    if (!userInfoResponse.ok) {
      console.error('Failed to get Google user info')
      return c.json({ error: 'Failed to get user info from Google' }, 400)
    }
    
    const userInfo = await userInfoResponse.json()
    
    // Save the integration to database
    const integrationData = {
      user_id: userId,
      platform: 'google_meet',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
      scope: tokenData.scope?.split(' ') || [],
      platform_user_id: userInfo.id,
      platform_user_email: userInfo.email,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Check if integration already exists for this user and platform
    const { data: existingIntegration } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'google_meet')
      .single()
    
    if (existingIntegration) {
      // Update existing integration
      const { error } = await supabaseAdmin
        .from('user_meeting_integrations')
        .update(integrationData)
        .eq('id', existingIntegration.id)
      
      if (error) {
        console.error('Failed to update Google integration:', error)
        return c.json({ error: 'Failed to save integration' }, 500)
      }
    } else {
      // Create new integration
      const { error } = await supabaseAdmin
        .from('user_meeting_integrations')
        .insert(integrationData)
      
      if (error) {
        console.error('Failed to save Google integration:', error)
        return c.json({ error: 'Failed to save integration' }, 500)
      }
    }
    
    console.log('✅ Google integration saved successfully for user:', userId)
    return c.json({ 
      success: true,
      userEmail: userInfo.email,
      message: 'Google Meet integration connected successfully!' 
    })
    
  } catch (error) {
    console.error('Google OAuth callback error:', error)
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