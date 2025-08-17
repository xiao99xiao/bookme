'use client'

import { type Conversation } from '@/lib/messaging'
import { ConversationItem } from './ConversationItem'

interface ConversationListProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  currentUserId?: string
}

export function ConversationList({ 
  conversations, 
  activeConversationId, 
  onSelectConversation,
  currentUserId 
}: ConversationListProps) {
  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeConversationId}
          onClick={() => onSelectConversation(conversation.id)}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}