import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Search } from 'lucide-react';
import { Input } from '@/design-system/components/Input';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import ConversationList, { ConversationItem } from '@/components/ConversationList';
import MessageThread from '@/components/MessageThread';
import { toast } from 'sonner';
import { H1, H3, Text, Description, Loading } from '@/design-system';
import { t } from '@/lib/i18n';
import { useSetPageTitle } from '@/contexts/PageTitleContext';
import './styles/host-dashboard.css';

export default function ProviderMessages() {
  // Set page title for AppHeader (desktop only)
  useSetPageTitle(t.pages.messages.title, t.pages.messages.chatWithVisitors);
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
          unreadCount: conv.unread_count || 0,
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
      navigate(`/host/messages/${conversation.id}`);
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
      {/* Desktop Layout */}
      <div className="hidden lg:flex messages-container">
        {/* Left Panel - Sidebar */}
        <div className="messages-sidebar">
          {/* Title Section */}
          <div className="messages-sidebar__header">
            <h1 className="messages-sidebar__title">
              {t.pages.messages.title}
            </h1>
            <p className="messages-sidebar__subtitle">
              {t.pages.messages.chatWithAll}
            </p>
          </div>

          {/* Search Box */}
          <div className="messages-search">
            <Search className="messages-search__icon" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="messages-search__input"
            />
          </div>

          {/* Conversation List */}
          <div className="messages-list">
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
        <div className="messages-thread">
          {selectedConversation ? (
            <div className="messages-thread__container">
              <MessageThread
                conversation={selectedConversation}
                onConversationUpdate={handleConversationUpdate}
              />
            </div>
          ) : (
            <div className="messages-empty">
              <MessageSquare className="messages-empty__icon" />
              <h3 className="messages-empty__title">Select a conversation</h3>
              <p className="messages-empty__description">
                Choose a conversation from the left to start messaging
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout - List only */}
      <div className="lg:hidden messages-mobile">
        {/* Search */}
        <div className="messages-mobile__search">
          <div className="messages-search">
            <Search className="messages-search__icon" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="messages-search__input"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="messages-mobile__list">
          {loading ? (
            <Loading variant="spinner" size="md" text="Loading conversations..." />
          ) : conversations.length === 0 ? (
            <div className="messages-empty" style={{ height: 'auto', marginTop: '48px' }}>
              <MessageSquare className="messages-empty__icon" />
              <h3 className="messages-empty__title">No conversations yet</h3>
              <p className="messages-empty__description">Your messages will appear here</p>
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
                  className="conversation-item-mobile"
                >
                  {/* Avatar */}
                  <div className="conversation-item__avatar">
                    <div className="conversation-item__avatar-img">
                      {conversation.otherUser.avatar ? (
                        <img
                          src={conversation.otherUser.avatar}
                          alt={conversation.otherUser.display_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="conversation-item__avatar-initial">
                          {conversation.otherUser.display_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="conversation-item__unread-badge">
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="conversation-item__content">
                    <div className="conversation-item__header">
                      <span className="conversation-item__name">
                        {conversation.otherUser.display_name}
                      </span>
                      {conversation.lastMessage && (
                        <span className="conversation-item__time">
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
                      <div className="conversation-item__service">
                        {conversation.booking.service.title}
                      </div>
                    )}
                    {conversation.lastMessage && (
                      <div className="conversation-item__message">
                        {conversation.lastMessage.content}
                      </div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </>
  );
}