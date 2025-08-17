'use client'

import { format } from 'date-fns'
import { User, Check, CheckCheck } from 'lucide-react'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  senderName?: string
  senderAvatar?: string | null
}

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  isLast?: boolean
  showAvatar?: boolean
}

export function MessageBubble({ 
  message, 
  isOwn, 
  isLast = false, 
  showAvatar = true 
}: MessageBubbleProps) {
  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isLast ? 'mb-4' : 'mb-2'}`}>
      {/* Avatar */}
      {showAvatar && !isOwn && (
        <div className="flex-shrink-0">
          {message.senderAvatar ? (
            <img
              src={message.senderAvatar}
              alt={message.senderName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-500" />
            </div>
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-xs lg:max-w-md xl:max-w-lg`}>
        {/* Sender name (only for others' messages) */}
        {!isOwn && showAvatar && message.senderName && (
          <p className="text-xs text-gray-500 mb-1 px-2">
            {message.senderName}
          </p>
        )}

        {/* Message bubble */}
        <div
          className={`
            relative px-4 py-2 rounded-2xl max-w-full break-words
            ${isOwn 
              ? 'bg-blue-500 text-white rounded-br-md' 
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
            }
          `}
        >
          <p className="text-sm">{message.content}</p>
        </div>

        {/* Timestamp and status */}
        <div className={`flex items-center gap-1 mt-1 px-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          <p className="text-xs text-gray-500">
            {format(new Date(message.created_at), 'HH:mm')}
          </p>
          
          {/* Read status for own messages */}
          {isOwn && (
            <div className="text-gray-400">
              <CheckCheck className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>

      {/* Spacer for own messages to maintain avatar space */}
      {isOwn && (
        <div className="w-8 flex-shrink-0" />
      )}
    </div>
  )
}