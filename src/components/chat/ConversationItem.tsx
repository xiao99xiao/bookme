'use client'

import { Conversation } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { formatDistanceToNow } from 'date-fns'
import { User } from 'lucide-react'

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const { user: currentUser } = useAuthStore()
  
  // Determine the other user in the conversation
  const otherUser = currentUser?.id === conversation.providerId 
    ? conversation.customer 
    : conversation.provider

  // Format last message time
  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return ''
    }
  }

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
        isActive ? 'bg-blue-50 border-r-2 border-blue-500' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {otherUser?.avatar ? (
            <img
              src={otherUser.avatar}
              alt={otherUser.displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-6 w-6 text-gray-400" />
            </div>
          )}
          
          {/* Online indicator */}
          {otherUser?.isActive && (
            <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white -mt-2 ml-9"></div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {otherUser?.displayName || 'Unknown User'}
            </h3>
            {conversation.lastMessageAt && (
              <span className="text-xs text-gray-500">
                {formatMessageTime(conversation.lastMessageAt)}
              </span>
            )}
          </div>

          {/* Service info */}
          <p className="text-xs text-gray-500 mb-1">
            {conversation.booking?.service?.title || 'Service'}
          </p>

          {/* Last message */}
          <p className="text-sm text-gray-600 truncate">
            {conversation.lastMessageText ? (
              <>
                {conversation.lastMessageSender === currentUser?.id && 'You: '}
                {conversation.lastMessageText}
              </>
            ) : (
              <span className="italic">Start the conversation...</span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}