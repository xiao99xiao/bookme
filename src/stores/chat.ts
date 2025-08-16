import { create } from 'zustand'
import { ChatState, ChatMessage } from '@/types'

interface ChatStore extends ChatState {
  // All methods are inherited from ChatState
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isConnected: false,

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
              lastMessageAt: message.timestamp,
              lastMessageText: message.content,
              lastMessageSender: message.senderId
            }
          : conv
      )
    }))
  },

  loadConversations: async () => {
    try {
      // Get current user from auth store (you'll need to import this)
      const user = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.user
      if (!user?.id) return

      const response = await fetch(`/api/conversations?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        set({ conversations: data.conversations })
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  },

  loadMessages: async (conversationId: string) => {
    try {
      // For now, messages are handled by Agora SDK
      // This function could load message history if needed
      const conversation = get().conversations.find(c => c.id === conversationId)
      if (!conversation) return

      // Initialize empty message array if not exists
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId] || []
        }
      }))
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  },

  sendMessage: async (conversationId: string, content: string) => {
    try {
      const conversation = get().conversations.find(c => c.id === conversationId)
      if (!conversation) return

      // Get current user
      const user = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.user
      if (!user?.id) return

      // Create message object
      const message: ChatMessage = {
        id: Date.now().toString(),
        conversationId,
        senderId: user.id,
        content,
        timestamp: new Date().toISOString(),
        type: 'text',
        senderName: user.displayName || user.name,
        senderAvatar: user.avatar
      }

      // Add to local state immediately
      get().addMessage(conversationId, message)
      get().updateLastMessage(conversationId, message)

      // Send via Agora (will be implemented with Agora SDK)
      // For now, we'll implement a basic version

      // Update conversation metadata on server
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          lastMessageText: content,
          lastMessageSender: user.id
        })
      })
    } catch (error) {
      console.error('Error sending message:', error)
    }
  },

  connectToAgora: async () => {
    try {
      // This will be implemented with actual Agora connection
      set({ isConnected: true })
    } catch (error) {
      console.error('Error connecting to Agora:', error)
    }
  },

  disconnectFromAgora: () => {
    set({ isConnected: false })
  }
}))