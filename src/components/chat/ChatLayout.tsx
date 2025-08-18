'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { ConversationList } from './ConversationList'
import { ChatInterface } from './ChatInterface'
import { MessageCircle } from 'lucide-react'

export function ChatLayout() {
  const searchParams = useSearchParams()
  const conversationIdFromUrl = searchParams.get('conversationId')
  
  const { user } = useAuthStore()
  const { 
    conversations, 
    activeConversationId, 
    loadConversations,
    setActiveConversation,
    subscribeToUserConversations,
    cleanup
  } = useChatStore()

  // Load conversations on mount
  useEffect(() => {
    if (user?.id) {
      loadConversations(user.id)
      subscribeToUserConversations(user.id)
    }

    return () => {
      cleanup()
    }
  }, [user?.id, loadConversations, subscribeToUserConversations, cleanup])

  // Auto-select conversation from URL
  useEffect(() => {
    if (conversationIdFromUrl && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === conversationIdFromUrl)
      if (conversation && activeConversationId !== conversationIdFromUrl) {
        setActiveConversation(conversationIdFromUrl)
      }
    }
  }, [conversationIdFromUrl, conversations, activeConversationId, setActiveConversation])

  const activeConversation = conversations.find(c => c.id === activeConversationId)

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>
      {/* Sidebar - Conversation List */}
      <div style={{ width: '33.33%', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <MessageCircle size={24} style={{ color: 'var(--accent-primary)' }} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Messages</h1>
          </div>
        </div>

        {/* Conversation List */}
        <div style={{ flex: '1', overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <MessageCircle size={48} style={{ margin: '0 auto var(--space-md)', color: 'var(--text-light)' }} />
              <p style={{ fontSize: '0.875rem' }}>No conversations yet</p>
              <p style={{ fontSize: '0.75rem', marginTop: 'var(--space-xs)' }}>Messages will appear when you have confirmed bookings</p>
            </div>
          ) : (
            <ConversationList 
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={setActiveConversation}
              currentUserId={user?.id}
            />
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
        {activeConversation ? (
          <ChatInterface 
            conversation={activeConversation} 
            currentUserId={user?.id}
          />
        ) : (
          <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
            <div style={{ textAlign: 'center' }}>
              <MessageCircle size={64} style={{ margin: '0 auto var(--space-lg)', color: 'var(--text-light)' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
                Select a conversation
              </h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}