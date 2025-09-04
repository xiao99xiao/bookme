import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { ConversationItem } from '@/components/ConversationList';
import MessageThread from '@/components/MessageThread';
import { toast } from 'sonner';
import { H2 } from '@/design-system';

/**
 * Mobile-only chat page for provider conversations
 * This is a separate route that provides a full-screen chat experience on mobile
 * Desktop users will never see this page - they use the two-panel layout in ProviderMessages
 */
export default function ProviderMobileChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  
  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId && userId) {
      loadConversation();
    }
  }, [conversationId, userId]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load the specific conversation
      const conversations = await ApiClient.getUserConversations(userId);
      const foundConversation = conversations.find(conv => conv.id === conversationId);
      
      if (!foundConversation) {
        setError('Conversation not found');
        return;
      }
      
      // Transform to ConversationItem format
      const isProvider = foundConversation.provider_id === userId;
      const otherUser = isProvider ? foundConversation.customer : foundConversation.provider;
      
      const transformedConversation: ConversationItem = {
        id: foundConversation.id,
        otherUser: {
          id: otherUser?.id || 'unknown',
          display_name: otherUser?.display_name || 'Unknown User',
          avatar: otherUser?.avatar || undefined
        },
        lastMessage: foundConversation.last_message?.length > 0 ? {
          content: foundConversation.last_message[0].content,
          created_at: foundConversation.last_message[0].created_at,
          sender_id: foundConversation.last_message[0].sender_id
        } : undefined,
        unreadCount: 0,
        lastActivity: foundConversation.updated_at || foundConversation.created_at,
        booking: foundConversation.booking ? {
          id: foundConversation.booking.id,
          service: foundConversation.booking.service ? {
            title: foundConversation.booking.service.title || 'Service'
          } : undefined
        } : undefined
      };
      
      setConversation(transformedConversation);
      
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError('Failed to load conversation');
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/provider/messages');
  };

  const handleConversationUpdate = (updatedConversation: ConversationItem) => {
    setConversation(updatedConversation);
  };

  // Only render on mobile (lg breakpoint)
  // This entire component should only be used on mobile devices
  
  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="h-[100dvh] flex flex-col bg-white">
        <div className="flex items-center p-4 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <H2 className="ml-4">Messages</H2>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {error === 'Conversation not found' 
                ? 'This conversation could not be found'
                : 'Something went wrong loading this conversation'
              }
            </p>
            <Button onClick={handleBack}>
              Back to Messages
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      {/* Mobile Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <Avatar className="h-8 w-8">
          <AvatarImage src={conversation.otherUser.avatar} />
          <AvatarFallback>
            {conversation.otherUser.display_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <H2 className="truncate">
          {conversation.otherUser.display_name}
        </H2>
      </div>

      {/* Message Thread - Reuse existing component */}
      <div className="flex-1 overflow-hidden">
        <MessageThread 
          conversation={conversation}
          onConversationUpdate={handleConversationUpdate}
        />
      </div>
    </div>
  );
}