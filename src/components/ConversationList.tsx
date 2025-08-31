import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { MessageSquare, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ConversationItem {
  id: string;
  otherUser: {
    id: string;
    display_name: string;
    avatar?: string;
  };
  lastMessage?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unreadCount: number;
  lastActivity: string;
  booking?: {
    id: string;
    service?: {
      title: string;
    };
  };
}

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedConversationId?: string;
  onConversationSelect: (conversation: ConversationItem) => void;
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  onConversationSelect,
  loading = false,
  searchQuery,
  onSearchChange
}: ConversationListProps) {
  const [filteredConversations, setFilteredConversations] = useState<ConversationItem[]>([]);

  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv =>
        conv.otherUser.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.booking?.service?.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConversations(filtered);
    }
  }, [conversations, searchQuery]);

  const formatLastMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, 'h:mm a');
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-3 animate-pulse">
            <div className="h-12 w-12 bg-muted rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredConversations.length === 0) {
    return (
      <div className="p-6 text-center">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-medium mb-2">
          {searchQuery ? 'No conversations found' : 'No conversations yet'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {searchQuery 
            ? 'Try adjusting your search terms'
            : 'Your conversations will appear here when you start chatting with customers or service providers.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {filteredConversations.map((conversation) => (
        <Button
          key={conversation.id}
          variant="ghost"
          className={cn(
            "w-full justify-start p-3 h-auto text-left hover:bg-muted/50 transition-colors",
            selectedConversationId === conversation.id && "bg-muted"
          )}
          onClick={() => onConversationSelect(conversation)}
        >
          <div className="flex items-start space-x-3 w-full">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarImage src={conversation.otherUser.avatar} alt={conversation.otherUser.display_name} />
              <AvatarFallback>
                {conversation.otherUser.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm truncate">
                  {conversation.otherUser.display_name}
                </p>
                <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                  {conversation.unreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs min-w-[1.25rem] h-5 flex items-center justify-center">
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </Badge>
                  )}
                  {conversation.lastMessage && (
                    <span className="text-xs text-muted-foreground">
                      {formatLastMessageTime(conversation.lastMessage.created_at)}
                    </span>
                  )}
                </div>
              </div>
              
              {conversation.booking?.service?.title && (
                <p className="text-xs text-muted-foreground truncate">
                  Re: {conversation.booking.service.title}
                </p>
              )}
              
              {conversation.lastMessage && (
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.lastMessage.sender_id === conversation.otherUser.id ? '' : 'You: '}
                  {truncateMessage(conversation.lastMessage.content)}
                </p>
              )}
            </div>
          </div>
        </Button>
      ))}
    </div>
  );
}