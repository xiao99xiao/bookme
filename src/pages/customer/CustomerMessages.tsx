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

export default function CustomerMessages() {
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
    <div className="h-[calc(100vh-4rem)] flex bg-neutral-50 overflow-hidden">
      {/* Left Panel - Sidebar */}
      <div className="bg-neutral-50 flex flex-col gap-6 h-full px-8 py-10 w-64 flex-shrink-0">
        {/* Title Section */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <h1 className="font-['Spectral'] font-bold text-[20px] text-black leading-[1.4]">
            Messages
          </h1>
          <p className="font-['Baloo_2'] font-normal text-[12px] text-[#aaaaaa] leading-[1.5]">
            Chat with customers and service providers
          </p>
        </div>

        {/* Search Box */}
        <div className="relative flex-shrink-0">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <Search className="h-6 w-6 text-[#666666]" />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#eeeeee] rounded-[8px] px-3 py-2 pl-12 font-['Baloo_2'] font-normal text-[16px] text-[#666666] leading-[1.5] focus-visible:outline-none focus-visible:border-primary transition-colors"
          />
        </div>

        {/* Conversation List */}
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
      <div className="flex-1 bg-neutral-50 p-10 min-h-0 min-w-0">
        {selectedConversation ? (
          <div className="h-full bg-white rounded-[24px] shadow-[0px_12px_16px_-4px_rgba(0,0,0,0.08),0px_4px_6px_-2px_rgba(0,0,0,0.03)] min-h-0">
            <MessageThread 
              conversation={selectedConversation}
              onConversationUpdate={handleConversationUpdate}
            />
          </div>
        ) : (
          <div className="h-full bg-white rounded-[24px] shadow-[0px_12px_16px_-4px_rgba(0,0,0,0.08),0px_4px_6px_-2px_rgba(0,0,0,0.03)] flex items-center justify-center">
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
  );
}