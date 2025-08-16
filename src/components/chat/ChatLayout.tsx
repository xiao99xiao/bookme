'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChatStore } from '@/stores/chat'
import { ConversationList } from './ConversationList'
import { ChatInterface } from './ChatInterface'
import { MessageCircle } from 'lucide-react'

export function ChatLayout() {
  const searchParams = useSearchParams()
  const conversationIdFromUrl = searchParams.get('conversationId')
  
  const { 
    conversations, 
    activeConversationId, 
    loadConversations,
    setActiveConversation 
  } = useChatStore()

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

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
    <div className="h-screen flex bg-white">
      {/* Sidebar - Conversation List */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Messages will appear when you have confirmed bookings</p>
            </div>
          ) : (
            <ConversationList 
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={setActiveConversation}
            />
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <ChatInterface conversation={activeConversation} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-500">
                Choose a conversation from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}