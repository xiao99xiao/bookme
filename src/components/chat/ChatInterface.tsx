'use client'

import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/chat'
import { type Conversation } from '@/lib/messaging'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { User, MoreVertical, Phone, Video, Info } from 'lucide-react'

interface ChatInterfaceProps {
  conversation: Conversation
  currentUserId?: string
}

export function ChatInterface({ conversation, currentUserId }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const { 
    messages, 
    loadMessages, 
    sendMessage, 
    subscribeToConversation, 
    unsubscribeFromConversation 
  } = useChatStore()

  const conversationMessages = messages[conversation.id] || []

  // Determine the other participant
  const otherParticipant = conversation.provider_id === currentUserId 
    ? conversation.customer 
    : conversation.provider

  const isProvider = conversation.provider_id === currentUserId

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation.id && currentUserId) {
      setIsLoading(true)
      loadMessages(conversation.id, currentUserId).finally(() => {
        setIsLoading(false)
      })
      
      // Subscribe to real-time updates
      subscribeToConversation(conversation.id)
      
      return () => {
        unsubscribeFromConversation(conversation.id)
      }
    }
  }, [conversation.id, currentUserId, loadMessages, subscribeToConversation, unsubscribeFromConversation])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationMessages])

  const handleSendMessage = async (content: string) => {
    if (!currentUserId) return
    
    try {
      await sendMessage(conversation.id, currentUserId, content)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          {/* Other participant's avatar */}
          {otherParticipant?.avatar ? (
            <img
              src={otherParticipant.avatar}
              alt={otherParticipant.display_name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>
          )}
          
          <div>
            <h2 className="font-semibold text-gray-900">
              {otherParticipant?.display_name || 'Unknown User'}
            </h2>
            {conversation.booking?.service && (
              <p className="text-sm text-gray-500">
                {isProvider ? 'Providing' : 'Booking'}: {conversation.booking.service.title}
              </p>
            )}
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
          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Conversation info"
          >
            <Info className="h-5 w-5" />
          </button>
          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : conversationMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start the conversation
              </h3>
              <p className="text-sm">
                Say hello to {otherParticipant?.display_name || 'your booking partner'}
              </p>
              {conversation.booking?.service && (
                <p className="text-sm text-blue-600 mt-2">
                  You're connected through: {conversation.booking.service.title}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-1">
            {conversationMessages.map((message, index) => {
              const isOwn = message.sender_id === currentUserId
              const prevMessage = conversationMessages[index - 1]
              const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id
              const isLast = index === conversationMessages.length - 1

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={isOwn}
                  isLast={isLast}
                  showAvatar={showAvatar}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        placeholder={`Message ${otherParticipant?.display_name || 'user'}...`}
      />
    </div>
  )
}