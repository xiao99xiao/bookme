import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
        // Simple logic: the opponent is whoever is NOT the current user
        let otherUser = null;
        if (conv.customer?.id === userId) {
          // Current user is customer, so opponent is provider
          otherUser = conv.provider;
        } else if (conv.provider?.id === userId) {
          // Current user is provider, so opponent is customer
          otherUser = conv.customer;
        } else {
          // Fallback: use whichever user exists that's not the current user
          otherUser = conv.customer || conv.provider;
        }
        
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
    // Check if user is on mobile (below lg breakpoint which is 1024px)
    const isMobile = window.innerWidth < 1024;
    
    if (isMobile) {
      // On mobile, navigate to the dedicated mobile chat page
      navigate(`/provider/messages/${conversation.id}`);
    } else {
      // On desktop, use the existing two-panel layout
      setSelectedConversation(conversation);
    }
  };

  const handleConversationUpdate = (updatedConversation: ConversationItem) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
  };

  return (
    <>
      {/* Desktop Layout - unchanged */}
      <div className="hidden lg:block">
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
      </div>

      {/* Mobile Layout - List only */}
      <div className="lg:hidden min-h-screen bg-gray-50 pb-20">
        <div className="px-4 py-6">
          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Messages</h1>
            <p className="text-sm text-gray-500">Chat with customers</p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">No conversations yet</h3>
                <p className="text-sm text-gray-500">Your messages will appear here</p>
              </div>
            ) : (
              conversations
                .filter(conv => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    conv.otherUser.display_name.toLowerCase().includes(query) ||
                    conv.lastMessage?.content.toLowerCase().includes(query) ||
                    conv.booking?.service?.title.toLowerCase().includes(query)
                  );
                })
                .map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation)}
                    className="bg-white rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                        {conversation.otherUser.avatar ? (
                          <img 
                            src={conversation.otherUser.avatar} 
                            alt={conversation.otherUser.display_name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-semibold text-lg">
                            {conversation.otherUser.display_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {conversation.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                          {conversation.unreadCount}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {conversation.otherUser.display_name}
                        </h3>
                        {conversation.lastMessage && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {(() => {
                              const date = new Date(conversation.lastMessage.created_at);
                              const now = new Date();
                              const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
                              
                              if (diffInHours < 24) {
                                return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                              } else if (diffInHours < 48) {
                                return 'Yesterday';
                              } else {
                                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                              }
                            })()}
                          </span>
                        )}
                      </div>
                      {conversation.booking?.service?.title && (
                        <p className="text-xs text-gray-500 mb-1">
                          {conversation.booking.service.title}
                        </p>
                      )}
                      {conversation.lastMessage && (
                        <p className="text-sm text-gray-600 line-clamp-1">
                          {conversation.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}