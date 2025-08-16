'use client'

import { ChatMessage, User } from '@/types'
import { format } from 'date-fns'
import { User as UserIcon } from 'lucide-react'

interface MessageBubbleProps {
  message: ChatMessage
  isCurrentUser: boolean
  otherUser?: User
}

export function MessageBubble({ message, isCurrentUser, otherUser }: MessageBubbleProps) {
  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm')
    } catch {
      return ''
    }
  }

  const userAvatar = isCurrentUser 
    ? message.senderAvatar 
    : otherUser?.avatar

  const userName = isCurrentUser 
    ? message.senderName 
    : otherUser?.displayName || 'Unknown User'

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {/* Avatar for other user */}
      {!isCurrentUser && (
        <div className="flex-shrink-0">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-gray-400" />
            </div>
          )}
        </div>
      )}

      {/* Message content */}
      <div className={`max-w-xs lg:max-w-md ${isCurrentUser ? 'order-1' : ''}`}>
        <div
          className={`px-4 py-2 rounded-2xl ${
            isCurrentUser
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
        
        {/* Timestamp */}
        <p className={`text-xs text-gray-500 mt-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>

      {/* Avatar for current user */}
      {isCurrentUser && (
        <div className="flex-shrink-0 order-2">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}