'use client'

import { Conversation } from '@/types'
import { ConversationItem } from './ConversationItem'

interface ConversationListProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
}

export function ConversationList({ 
  conversations, 
  activeConversationId, 
  onSelectConversation 
}: ConversationListProps) {
  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeConversationId}
          onClick={() => onSelectConversation(conversation.id)}
        />
      ))}
    </div>
  )
}