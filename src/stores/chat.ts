import { create } from 'zustand'
import { MessagingService, type Message, type Conversation } from '@/lib/messaging'
import { supabase } from '@/lib/supabase'

interface ChatMessage extends Message {
  // Add computed fields for UI
  senderName?: string
  senderAvatar?: string | null
}

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, ChatMessage[]>
  isConnected: boolean
  isLoading: boolean
  subscriptions: Record<string, ReturnType<typeof supabase.channel>>
  
  // Actions
  setActiveConversation: (id: string | null) => void
  addMessage: (conversationId: string, message: ChatMessage) => void
  updateLastMessage: (conversationId: string, message: ChatMessage) => void
  loadConversations: (userId: string) => Promise<void>
  loadMessages: (conversationId: string, userId: string) => Promise<void>
  sendMessage: (conversationId: string, senderId: string, content: string) => Promise<void>
  subscribeToConversation: (conversationId: string) => void
  unsubscribeFromConversation: (conversationId: string) => void
  subscribeToUserConversations: (userId: string) => void
  cleanup: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isConnected: false,
  isLoading: false,
  subscriptions: {},

  setActiveConversation: (id: string | null) => {
    set({ activeConversationId: id })
  },

  addMessage: (conversationId: string, message: ChatMessage) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [
          ...(state.messages[conversationId] || []),
          message
        ]
      }
    }))
  },

  updateLastMessage: (conversationId: string, message: ChatMessage) => {
    set((state) => ({
      conversations: state.conversations.map(conv =>
        conv.id === conversationId
          ? {
              ...conv,
              last_message_at: message.created_at,
              last_message_text: message.content,
              last_message_sender: message.sender_id
            }
          : conv
      )
    }))
  },

  loadConversations: async (userId: string) => {
    try {
      set({ isLoading: true })
      const conversations = await MessagingService.getUserConversations(userId)
      set({ conversations, isLoading: false })
    } catch (error) {
      console.error('Error loading conversations:', error)
      set({ isLoading: false })
    }
  },

  loadMessages: async (conversationId: string, userId: string) => {
    try {
      const messages = await MessagingService.getMessages(conversationId, userId)
      
      // Add sender info to messages
      const conversation = get().conversations.find(c => c.id === conversationId)
      const enrichedMessages = messages.map(msg => ({
        ...msg,
        senderName: msg.sender_id === conversation?.provider_id 
          ? conversation?.provider?.display_name 
          : conversation?.customer?.display_name,
        senderAvatar: msg.sender_id === conversation?.provider_id 
          ? conversation?.provider?.avatar 
          : conversation?.customer?.avatar
      }))

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: enrichedMessages
        }
      }))
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  },

  sendMessage: async (conversationId: string, senderId: string, content: string) => {
    try {
      const message = await MessagingService.sendMessage(conversationId, senderId, content)
      
      // Add sender info
      const conversation = get().conversations.find(c => c.id === conversationId)
      const enrichedMessage = {
        ...message,
        senderName: senderId === conversation?.provider_id 
          ? conversation?.provider?.display_name 
          : conversation?.customer?.display_name,
        senderAvatar: senderId === conversation?.provider_id 
          ? conversation?.provider?.avatar 
          : conversation?.customer?.avatar
      }

      // Add to local state immediately
      get().addMessage(conversationId, enrichedMessage)
      get().updateLastMessage(conversationId, enrichedMessage)
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  },

  subscribeToConversation: (conversationId: string) => {
    const { subscriptions } = get()
    
    // Don't subscribe if already subscribed
    if (subscriptions[`messages:${conversationId}`]) return

    const channel = MessagingService.subscribeToMessages(conversationId, (message) => {
      // Add sender info from conversation
      const conversation = get().conversations.find(c => c.id === conversationId)
      const enrichedMessage = {
        ...message,
        senderName: message.sender_id === conversation?.provider_id 
          ? conversation?.provider?.display_name 
          : conversation?.customer?.display_name,
        senderAvatar: message.sender_id === conversation?.provider_id 
          ? conversation?.provider?.avatar 
          : conversation?.customer?.avatar
      }

      get().addMessage(conversationId, enrichedMessage)
      get().updateLastMessage(conversationId, enrichedMessage)
    })

    set((state) => ({
      subscriptions: {
        ...state.subscriptions,
        [`messages:${conversationId}`]: channel
      },
      isConnected: true
    }))
  },

  unsubscribeFromConversation: (conversationId: string) => {
    const { subscriptions } = get()
    const channel = subscriptions[`messages:${conversationId}`]
    
    if (channel) {
      MessagingService.unsubscribe(channel)
      
      const newSubscriptions = { ...subscriptions }
      delete newSubscriptions[`messages:${conversationId}`]
      
      set({ subscriptions: newSubscriptions })
    }
  },

  subscribeToUserConversations: (userId: string) => {
    const { subscriptions } = get()
    
    // Don't subscribe if already subscribed
    if (subscriptions[`conversations:${userId}`]) return

    const channel = MessagingService.subscribeToConversations(userId, (conversation) => {
      set((state) => ({
        conversations: state.conversations.map(conv =>
          conv.id === conversation.id ? { ...conv, ...conversation } : conv
        )
      }))
    })

    set((state) => ({
      subscriptions: {
        ...state.subscriptions,
        [`conversations:${userId}`]: channel
      }
    }))
  },

  cleanup: () => {
    const { subscriptions } = get()
    
    // Unsubscribe from all channels
    Object.values(subscriptions).forEach(channel => {
      MessagingService.unsubscribe(channel)
    })
    
    set({
      subscriptions: {},
      isConnected: false,
      activeConversationId: null,
      messages: {}
    })
  }
}))