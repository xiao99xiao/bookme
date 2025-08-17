'use client'

import { type Conversation } from '@/lib/messaging'
import { formatDistanceToNow } from 'date-fns'
import { User, Clock } from 'lucide-react'

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  currentUserId?: string
}

export function ConversationItem({ 
  conversation, 
  isActive, 
  onClick, 
  currentUserId 
}: ConversationItemProps) {
  // Determine the other participant
  const otherParticipant = conversation.provider_id === currentUserId 
    ? conversation.customer 
    : conversation.provider

  const isProvider = conversation.provider_id === currentUserId

  return (
    <div
      onClick={onClick}
      className={`
        p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors
        ${isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {otherParticipant?.avatar ? (
            <img
              src={otherParticipant.avatar}
              alt={otherParticipant.display_name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-6 w-6 text-gray-500" />
            </div>
          )}
        </div>

        {/* Conversation Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {otherParticipant?.display_name || 'Unknown User'}
            </h3>
            {conversation.last_message_at && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
              </p>
            )}
          </div>

          {/* Service context */}
          {conversation.booking?.service && (
            <p className="text-xs text-blue-600 mb-1">
              {isProvider ? 'Providing' : 'Booked'}: {conversation.booking.service.title}
            </p>
          )}

          {/* Last message preview */}
          {conversation.last_message_text ? (
            <p className="text-sm text-gray-600 truncate">
              {conversation.last_message_sender === currentUserId ? 'You: ' : ''}
              {conversation.last_message_text}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">
              No messages yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}