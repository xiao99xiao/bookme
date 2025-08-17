import { supabase } from './supabase'
import type { Database } from './supabase'

export type Message = Database['public']['Tables']['messages']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row'] & {
  provider?: Database['public']['Tables']['users']['Row']
  customer?: Database['public']['Tables']['users']['Row']
  booking?: Database['public']['Tables']['bookings']['Row'] & {
    service?: Database['public']['Tables']['services']['Row']
  }
}

export class MessagingService {
  // Get user's conversations
  static async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          provider:users!conversations_provider_id_fkey(
            id, display_name, avatar, is_active
          ),
          customer:users!conversations_customer_id_fkey(
            id, display_name, avatar, is_active
          ),
          booking:bookings(
            id,
            service:services(id, title, description)
          )
        `)
        .or(`provider_id.eq.${userId},customer_id.eq.${userId}`)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching conversations:', error)
      throw error
    }
  }

  // Get conversation by ID
  static async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          provider:users!conversations_provider_id_fkey(
            id, display_name, avatar, is_active
          ),
          customer:users!conversations_customer_id_fkey(
            id, display_name, avatar, is_active
          ),
          booking:bookings(
            id,
            service:services(id, title, description)
          )
        `)
        .eq('id', conversationId)
        .or(`provider_id.eq.${userId},customer_id.eq.${userId}`)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching conversation:', error)
      throw error
    }
  }

  // Create conversation for booking
  static async createConversationForBooking(bookingId: string, userId: string) {
    try {
      // First get booking details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          service_id,
          requester_id,
          status,
          service:services(
            id, provider_id
          )
        `)
        .eq('id', bookingId)
        .single()

      if (bookingError) throw bookingError

      // Verify user has access and booking is confirmed
      const hasAccess = booking.requester_id === userId || (booking.service as any)?.provider_id === userId
      if (!hasAccess) {
        throw new Error('Access denied')
      }

      if (booking.status !== 'confirmed') {
        throw new Error('Conversation can only be created for confirmed bookings')
      }

      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('booking_id', bookingId)
        .single()

      if (existing) {
        return existing
      }

      // Create conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          booking_id: bookingId,
          provider_id: (booking.service as any)?.provider_id,
          customer_id: booking.requester_id
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating conversation:', error)
      throw error
    }
  }

  // Get messages for conversation
  static async getMessages(conversationId: string, userId: string, limit = 50): Promise<Message[]> {
    try {
      // First verify user has access to conversation
      const conversation = await this.getConversation(conversationId, userId)
      if (!conversation) {
        throw new Error('Conversation not found or access denied')
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching messages:', error)
      throw error
    }
  }

  // Send message
  static async sendMessage(conversationId: string, senderId: string, content: string) {
    try {
      // Verify user has access to conversation
      const conversation = await this.getConversation(conversationId, senderId)
      if (!conversation) {
        throw new Error('Conversation not found or access denied')
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: content.trim(),
          message_type: 'text'
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  // Subscribe to new messages in a conversation
  static subscribeToMessages(conversationId: string, onMessage: (message: Message) => void) {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          onMessage(payload.new as Message)
        }
      )
      .subscribe()

    return channel
  }

  // Subscribe to conversation updates
  static subscribeToConversations(userId: string, onUpdate: (conversation: Conversation) => void) {
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `or(provider_id.eq.${userId},customer_id.eq.${userId})`
        },
        (payload) => {
          onUpdate(payload.new as Conversation)
        }
      )
      .subscribe()

    return channel
  }

  // Unsubscribe from channel
  static unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    return supabase.removeChannel(channel)
  }
}