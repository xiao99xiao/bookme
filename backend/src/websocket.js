/**
 * WebSocket 模块
 *
 * 使用 Socket.io 提供实时通信
 * 使用 PostgreSQL NOTIFY/LISTEN 替代 Supabase Realtime
 */

import { Server } from 'socket.io'
import { PrivyClient } from '@privy-io/server-auth'
import { v5 as uuidv5 } from 'uuid'
import dotenv from 'dotenv'
import { pool } from './db.js'
import db from './supabase-compat.js'

dotenv.config({ path: '.env' })

// Initialize Privy client
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
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

// Store the io instance globally
let ioInstance = null
let listenerClient = null

export function getIO() {
  return ioInstance
}

/**
 * 设置 PostgreSQL NOTIFY 监听器
 */
async function setupPgListener(io) {
  try {
    // 获取专用连接用于 LISTEN
    listenerClient = await pool.connect()

    // 订阅通道
    await listenerClient.query('LISTEN new_message')
    await listenerClient.query('LISTEN booking_change')
    await listenerClient.query('LISTEN conversation_update')

    console.log('✅ PostgreSQL LISTEN 通道已激活')

    // 处理通知
    listenerClient.on('notification', async (msg) => {
      try {
        const payload = JSON.parse(msg.payload)

        switch (msg.channel) {
          case 'new_message':
            await handleNewMessage(io, payload)
            break
          case 'booking_change':
            await handleBookingChange(io, payload)
            break
          case 'conversation_update':
            await handleConversationUpdate(io, payload)
            break
        }
      } catch (error) {
        console.error('通知处理错误:', error)
      }
    })

    // 处理连接错误
    listenerClient.on('error', (err) => {
      console.error('PostgreSQL 监听器错误:', err)
      // 尝试重连
      setTimeout(() => {
        console.log('尝试重新连接 PostgreSQL 监听器...')
        setupPgListener(io)
      }, 5000)
    })

  } catch (error) {
    console.error('设置 PostgreSQL 监听器失败:', error)
    // 尝试重连
    setTimeout(() => setupPgListener(io), 5000)
  }
}

/**
 * 处理新消息通知
 */
async function handleNewMessage(io, payload) {
  try {
    // 获取完整消息信息
    const { data: message } = await db
      .from('messages')
      .select('*, sender:users!sender_id(id, display_name, avatar)')
      .eq('id', payload.id)
      .single()

    if (message) {
      // 广播到对话房间
      io.to(`conversation:${payload.conversation_id}`).emit('new_message', message)
    }
  } catch (error) {
    console.error('处理新消息通知错误:', error)
  }
}

/**
 * 处理预订变更通知
 */
async function handleBookingChange(io, payload) {
  try {
    // 获取完整 booking 信息
    const { data: booking } = await db
      .from('bookings')
      .select('*, service:services(*), customer:users!customer_id(id, display_name, avatar), provider:users!provider_id(id, display_name, avatar)')
      .eq('id', payload.id)
      .single()

    if (booking) {
      const event = payload.event_type === 'INSERT' ? 'new_booking' : 'booking_updated'

      // 通知 customer
      io.to(`user:${payload.customer_id}`).emit(event, booking)
      // 通知 provider
      io.to(`user:${payload.provider_id}`).emit(event, booking)
    }
  } catch (error) {
    console.error('处理预订变更通知错误:', error)
  }
}

/**
 * 处理对话更新通知
 */
async function handleConversationUpdate(io, payload) {
  try {
    io.to(`user:${payload.user1_id}`).emit('conversation_updated', payload)
    io.to(`user:${payload.user2_id}`).emit('conversation_updated', payload)
  } catch (error) {
    console.error('处理对话更新通知错误:', error)
  }
}

/**
 * 设置 WebSocket 服务器
 */
export function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:8080',
        'http://localhost:5173',
        'https://localhost:8443',
        'https://192.168.0.10:8443',
        /^https:\/\/192\.168\.\d+\.\d+:8443$/,
        'https://roulette-phenomenon-airfare-claire.trycloudflare.com',
        /https:\/\/.*\.trycloudflare\.com$/
      ],
      credentials: true
    }
  })

  // Privy 认证中间件
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

    // 加入用户个人房间
    socket.join(`user:${userId}`)

    // 处理对话订阅
    socket.on('subscribe_conversation', ({ conversationId }) => {
      console.log(`User ${userId} subscribing to conversation ${conversationId}`)
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('unsubscribe_conversation', ({ conversationId }) => {
      console.log(`User ${userId} unsubscribing from conversation ${conversationId}`)
      socket.leave(`conversation:${conversationId}`)
    })

    // 发送消息
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content } = data

        // 验证用户是对话的一方
        const { data: conversation, error: convError } = await db
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

        // 创建消息
        const { data: message, error } = await db
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
          socket.emit('error', { message: 'Failed to send message' })
          return
        }

        // 获取发送者信息
        const { data: sender } = await db
          .from('users')
          .select('id, display_name, avatar')
          .eq('id', userId)
          .single()

        const messageWithSender = { ...message, sender }

        // 更新对话最后活动时间
        await db
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId)

        // 发送确认给发送者
        socket.emit('message_sent', messageWithSender)

        // 广播到对话房间
        // 注意：PostgreSQL NOTIFY 触发器也会触发，但这里先手动广播确保即时性
        io.to(`conversation:${conversationId}`).emit('new_message', messageWithSender)

      } catch (error) {
        console.error('Send message error:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // 标记消息已读
    socket.on('mark_read', async (data) => {
      try {
        const { conversationId } = data

        await db
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', userId)

        socket.emit('messages_marked_read', { conversationId })
      } catch (error) {
        console.error('Mark read error:', error)
      }
    })

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`)
    })
  })

  // 启动 PostgreSQL LISTEN
  setupPgListener(io)

  // 存储 io 实例
  ioInstance = io

  return io
}

/**
 * 向特定用户发送通知
 */
export function notifyUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data)
}

/**
 * 向对话中的所有用户发送通知
 */
export function notifyConversation(io, conversationId, event, data) {
  io.to(`conversation:${conversationId}`).emit(event, data)
}
