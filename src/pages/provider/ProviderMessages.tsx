import { useState, useEffect } from 'react';
import { MessageSquare, Search, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import ConversationList, { ConversationItem } from '@/components/ConversationList';
import MessageThread from '@/components/MessageThread';
import { toast } from 'sonner';
import PageLayout from '@/components/PageLayout';

export default function ProviderMessages() {
  const { userId } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (userId) {
      loadConversations();
    }
  }, [userId]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      console.log('📝 Loading user conversations...');
      
      // Load conversations from backend
      const conversationsData = await ApiClient.getUserConversations(userId);
      console.log(`✅ Loaded ${conversationsData.length} conversations`);
      
      // Transform the data to match our ConversationItem interface
      const transformedConversations: ConversationItem[] = conversationsData.map(conv => {
        // Determine who is the "other user" in the conversation
        const isCustomer = conv.customer_id === userId;
        const otherUser = isCustomer ? conv.provider : conv.customer;
        
        // Calculate unread count (for now, we'll use a placeholder)
        // TODO: Implement proper unread count calculation
        const unreadCount = 0;
        
        return {
          id: conv.id,
          otherUser: {
            id: otherUser?.id || 'unknown',
            display_name: otherUser?.display_name || 'Unknown User',
            avatar: otherUser?.avatar || undefined
          },
          lastMessage: conv.last_message?.length > 0 ? {
            content: conv.last_message[0].content,
            created_at: conv.last_message[0].created_at,
            sender_id: conv.last_message[0].sender_id
          } : undefined,
          unreadCount,
          lastActivity: conv.updated_at || conv.created_at,
          booking: conv.booking ? {
            id: conv.booking.id,
            service: conv.booking.service ? {
              title: conv.booking.service.title || 'Service'
            } : undefined
          } : undefined
        };
      });
      
      // Sort by most recent activity
      transformedConversations.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      
      setConversations(transformedConversations);
    } catch (error) {
      console.error('❌ Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationSelect = (conversation: ConversationItem) => {
    setSelectedConversation(conversation);
  };

  const handleConversationUpdate = (updatedConversation: ConversationItem) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
  };

  return (
    <PageLayout 
      title="Messages" 
      description="Chat with customers and service providers"
      maxWidth="wide"
    >

          {/* Messages Interface */}
          <div className="h-[calc(100vh-200px)] min-h-[600px]">
            <Card className="h-full">
              <CardContent className="p-0 h-full">
                <div className="grid grid-cols-1 lg:grid-cols-[350px,1fr] h-full">
                  {/* Left Panel - Conversation List */}
                  <div className="border-r border-border h-full flex flex-col max-h-full">
                    <CardHeader className="flex-shrink-0 border-b">
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="h-5 w-5" />
                        <span>Conversations</span>
                      </CardTitle>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Search conversations..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </CardHeader>
                    
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <ConversationList
                        conversations={conversations}
                        selectedConversationId={selectedConversation?.id}
                        onConversationSelect={handleConversationSelect}
                        loading={loading}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                      />
                    </div>
                  </div>

                  {/* Right Panel - Message Thread */}
                  <div className="h-full max-h-full flex flex-col min-h-0">
                    {selectedConversation ? (
                      <MessageThread 
                        conversation={selectedConversation}
                        onConversationUpdate={handleConversationUpdate}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                          <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                          <p className="text-muted-foreground">
                            Choose a conversation from the left to start messaging
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
    </PageLayout>
  );
}