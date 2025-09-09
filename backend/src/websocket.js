import { Server } from 'socket.io'
import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

// Initialize clients
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
)

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// UUID namespace - same as main server
const PRIVY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

// Convert Privy DID to UUID
function privyDidToUuid(privyDid) {
  if (!privyDid) {
    throw new Error('Privy DID is required')
  }
  return uuidv5(privyDid, PRIVY_NAMESPACE)
}

// Store active subscriptions
const activeSubscriptions = new Map()

// Store the io instance globally so it can be accessed from HTTP endpoints
let ioInstance = null

export function getIO() {
  return ioInstance
}

export function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:8080',
        'http://localhost:5173',
        'https://localhost:8443',
        'https://192.168.0.10:8443',
        /^https:\/\/192\.168\.\d+\.\d+:8443$/, // Allow any local IP on port 8443
        'https://roulette-phenomenon-airfare-claire.trycloudflare.com',
        /https:\/\/.*\.trycloudflare\.com$/
      ],
      credentials: true
    }
  })

  // Middleware to verify Privy token
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      
      if (!token) {
        return next(new Error('Authentication required'))
      }

      const user = await privyClient.verifyAuthToken(token)
      
      if (!user) {
        return next(new Error('Invalid token'))
      }

      // Store user info in socket
      socket.data.privyUser = user
      socket.data.userId = privyDidToUuid(user.userId)
      
      next()
    } catch (error) {
      console.error('Socket auth error:', error)
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.data.userId
    console.log(`User ${userId} connected via WebSocket`)

    // Join user's personal room
    socket.join(`user:${userId}`)
    
    // Handle conversation subscriptions
    socket.on('subscribe_conversation', ({ conversationId }) => {
      console.log(`User ${userId} subscribing to conversation ${conversationId}`)
      socket.join(`conversation:${conversationId}`)
    })
    
    socket.on('unsubscribe_conversation', ({ conversationId }) => {
      console.log(`User ${userId} unsubscribing from conversation ${conversationId}`)
      socket.leave(`conversation:${conversationId}`)
    })

    // Subscribe to user's conversations
    subscribeToUserConversations(socket, userId)

    // Subscribe to user's bookings
    subscribeToUserBookings(socket, userId)

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content } = data

        // Verify user is part of conversation
        const { data: conversation, error: convError } = await supabaseAdmin
          .from('conversations')
          .select('user1_id, user2_id')
          .eq('id', conversationId)
          .single()

        if (convError || !conversation) {
          socket.emit('error', { message: 'Conversation not found' })
          return
        }

        if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
          socket.emit('error', { message: 'Unauthorized' })
          return
        }

        // Create message
        const { data: message, error } = await supabaseAdmin
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: userId,
            content,
            is_read: false
          })
          .select('*')
          .single()

        if (error) {
          console.error('Message send error:', error)
          socket.emit('error', { message: 'Failed to send message' })
          return
        }
        
        // Fetch sender details
        const { data: sender } = await supabaseAdmin
          .from('users')
          .select('id, display_name, avatar_url')
          .eq('id', userId)
          .single()
        
        // Add sender info to message
        const messageWithSender = { ...message, sender }

        // Update conversation last activity
        await supabaseAdmin
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId)

        // Emit to both users in conversation
        const recipientId = conversation.user1_id === userId 
          ? conversation.user2_id 
          : conversation.user1_id

        // Send confirmation to sender
        socket.emit('message_sent', messageWithSender)
        
        // Broadcast ONLY to conversation room (everyone subscribed gets it)
        // Don't send to individual user rooms to avoid duplicates
        io.to(`conversation:${conversationId}`).emit('new_message', messageWithSender)

      } catch (error) {
        console.error('Send message error:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Handle marking messages as read
    socket.on('mark_read', async (data) => {
      try {
        const { conversationId } = data

        await supabaseAdmin
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', userId)

        socket.emit('messages_marked_read', { conversationId })
      } catch (error) {
        console.error('Mark read error:', error)
      }
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`)
      
      // Clean up subscriptions
      const userSubs = activeSubscriptions.get(userId)
      if (userSubs) {
        userSubs.forEach(sub => sub.unsubscribe())
        activeSubscriptions.delete(userId)
      }
    })
  })

  // Store the io instance globally
  ioInstance = io
  
  return io
}

// Subscribe to user's conversations for real-time updates
function subscribeToUserConversations(socket, userId) {
  // Subscribe to new messages in user's conversations
  const messageChannel = supabaseAdmin
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=in.(
          SELECT id FROM conversations 
          WHERE customer_id=${userId} OR provider_id=${userId}
        )`
      },
      async (payload) => {
        // Get full message with sender info
        const { data: message } = await supabaseAdmin
          .from('messages')
          .select(`
            *,
            sender:users!sender_id(id, display_name, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single()

        if (message && message.sender_id !== userId) {
          socket.emit('new_message', message)
        }
      }
    )
    .subscribe()

  // Store subscription
  if (!activeSubscriptions.has(userId)) {
    activeSubscriptions.set(userId, [])
  }
  activeSubscriptions.get(userId).push(messageChannel)
}

// Subscribe to user's bookings for real-time updates
function subscribeToUserBookings(socket, userId) {
  // Subscribe to booking updates
  const bookingChannel = supabaseAdmin
    .channel(`bookings:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `customer_id=eq.${userId}`
      },
      async (payload) => {
        // Get full booking with relations
        if (payload.eventType === 'UPDATE') {
          const { data: booking } = await supabaseAdmin
            .from('bookings')
            .select(`
              *,
              service:services(*),
              provider:users!provider_id(display_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (booking) {
            socket.emit('booking_updated', booking)
          }
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `provider_id=eq.${userId}`
      },
      async (payload) => {
        // Get full booking with relations
        if (payload.eventType === 'INSERT') {
          const { data: booking } = await supabaseAdmin
            .from('bookings')
            .select(`
              *,
              service:services(*),
              customer:users!customer_id(display_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (booking) {
            socket.emit('new_booking', booking)
          }
        } else if (payload.eventType === 'UPDATE') {
          const { data: booking } = await supabaseAdmin
            .from('bookings')
            .select(`
              *,
              service:services(*),
              customer:users!customer_id(display_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (booking) {
            socket.emit('booking_updated', booking)
          }
        }
      }
    )
    .subscribe()

  // Store subscription
  activeSubscriptions.get(userId).push(bookingChannel)
}

// Broadcast notification to specific user
export function notifyUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data)
}

// Broadcast to all users in a conversation
export function notifyConversation(io, conversationId, event, data) {
  io.to(`conversation:${conversationId}`).emit(event, data)
}