'use client'

import { useEffect, useRef } from 'react'
import { Conversation } from '@/types'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { User, Phone, Video } from 'lucide-react'

interface ChatInterfaceProps {
  conversation: Conversation
}

export function ChatInterface({ conversation }: ChatInterfaceProps) {
  const { user: currentUser } = useAuthStore()
  const { messages, loadMessages } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get messages for this conversation
  const conversationMessages = messages[conversation.id] || []

  // Determine the other user
  const otherUser = currentUser?.id === conversation.providerId 
    ? conversation.customer 
    : conversation.provider

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation.id) {
      loadMessages(conversation.id)
    }
  }, [conversation.id, loadMessages])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationMessages])

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Other user avatar */}
            {otherUser?.avatar ? (
              <img
                src={otherUser.avatar}
                alt={otherUser.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-400" />
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {otherUser?.displayName || 'Unknown User'}
              </h2>
              <p className="text-sm text-gray-500">
                {conversation.booking?.service?.title || 'Service'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Voice call"
            >
              <Phone className="h-5 w-5" />
            </button>
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Video call"
            >
              <Video className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {conversationMessages.length === 0 ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <User className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start your conversation
            </h3>
            <p className="text-gray-500 mb-4">
              Say hello to {otherUser?.displayName} about your{' '}
              {conversation.booking?.service?.title} booking.
            </p>
            <p className="text-sm text-gray-400">
              This conversation is private and only visible to you and {otherUser?.displayName}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversationMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isCurrentUser={message.senderId === currentUser?.id}
                otherUser={otherUser}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput conversationId={conversation.id} />
    </div>
  )
}