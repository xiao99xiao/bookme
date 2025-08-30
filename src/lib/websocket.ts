import { io, Socket } from 'socket.io-client'

class WebSocketManager {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private connectionPromise: Promise<void> | null = null
  
  constructor() {
    // Bind methods to preserve context
    this.connect = this.connect.bind(this)
    this.disconnect = this.disconnect.bind(this)
    this.emit = this.emit.bind(this)
    this.on = this.on.bind(this)
    this.off = this.off.bind(this)
  }

  async connect(token: string): Promise<void> {
    // If already connecting, wait for that connection
    if (this.connectionPromise) {
      return this.connectionPromise
    }

    // If already connected, return immediately
    if (this.socket?.connected) {
      return Promise.resolve()
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Determine backend URL
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4001'
      
      console.log('Connecting to WebSocket at:', backendUrl)

      this.socket = io(backendUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      // Connection event handlers
      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket?.id)
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error.message)
        if (error.message === 'Authentication required' || 
            error.message === 'Invalid token' || 
            error.message === 'Authentication failed') {
          // Authentication error - don't retry
          this.disconnect()
          reject(new Error('WebSocket authentication failed'))
        }
      })

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        if (reason === 'io server disconnect') {
          // Server initiated disconnect (likely auth failure)
          this.connectionPromise = null
        }
      })

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error)
      })

      // Re-emit events to local listeners
      this.setupEventForwarding()

      // Set a timeout for initial connection
      setTimeout(() => {
        if (!this.socket?.connected) {
          reject(new Error('WebSocket connection timeout'))
        }
      }, 10000)
    })

    try {
      await this.connectionPromise
    } finally {
      this.connectionPromise = null
    }
  }

  private setupEventForwarding() {
    if (!this.socket) return

    // Common events to forward
    const events = [
      'new_message',
      'message_sent',
      'messages_marked_read',
      'booking_updated',
      'new_booking',
      'conversation_updated',
      'error'
    ]

    events.forEach(event => {
      this.socket?.on(event, (data) => {
        this.emitToListeners(event, data)
      })
    })
  }

  private emitToListeners(event: string, data: any) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error(`Error in listener for event ${event}:`, error)
        }
      })
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.connectionPromise = null
    this.listeners.clear()
  }

  emit(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, cannot emit:', event)
      return
    }
    this.socket.emit(event, data)
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Also register with socket if connected
    if (this.socket?.connected && !['new_message', 'message_sent', 'messages_marked_read', 'booking_updated', 'new_booking', 'conversation_updated', 'error'].includes(event)) {
      this.socket.on(event, callback)
    }

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
      if (listeners.size === 0) {
        this.listeners.delete(event)
      }
    }

    // Also unregister from socket if connected
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  // Convenience methods for common operations
  async sendMessage(conversationId: string, content: string) {
    this.emit('send_message', { conversationId, content })
  }

  async markMessagesAsRead(conversationId: string) {
    this.emit('mark_read', { conversationId })
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }
}

// Export singleton instance
export const websocketManager = new WebSocketManager()

// React hook for using WebSocket
import { useEffect, useCallback, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

export function useWebSocket() {
  const { getAccessToken, authenticated } = usePrivy()
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const connectWebSocket = async () => {
      if (!authenticated) {
        websocketManager.disconnect()
        setConnected(false)
        return
      }

      try {
        const token = await getAccessToken()
        if (!token) {
          throw new Error('No access token available')
        }

        await websocketManager.connect(token)
        
        if (mounted) {
          setConnected(true)
          setError(null)
        }
      } catch (err) {
        console.error('WebSocket connection error:', err)
        if (mounted) {
          setConnected(false)
          setError(err instanceof Error ? err.message : 'Connection failed')
        }
      }
    }

    connectWebSocket()

    return () => {
      mounted = false
      // Don't disconnect on unmount - keep connection alive across components
    }
  }, [authenticated, getAccessToken])

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    if (!connected) {
      throw new Error('WebSocket not connected')
    }
    websocketManager.sendMessage(conversationId, content)
  }, [connected])

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!connected) {
      throw new Error('WebSocket not connected')
    }
    websocketManager.markMessagesAsRead(conversationId)
  }, [connected])

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    return websocketManager.on(event, callback)
  }, [])

  return {
    connected,
    error,
    sendMessage,
    markAsRead,
    subscribe,
    emit: websocketManager.emit,
    on: websocketManager.on,
    off: websocketManager.off,
  }
}

// Message types for TypeScript
export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender?: {
    id: string
    display_name: string
    avatar_url?: string
  }
}

export interface Conversation {
  id: string
  customer_id: string
  provider_id: string
  booking_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_message?: Message
  customer?: any
  provider?: any
  booking?: any
}

export interface BookingUpdate {
  id: string
  status: string
  meeting_link?: string
  cancelled_at?: string
  completed_at?: string
  // ... other booking fields
}