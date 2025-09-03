import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { Send, Loader2, Wifi, WifiOff, RefreshCw, ChevronUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { useWebSocket } from '@/lib/websocket';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ConversationItem } from './ConversationList';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  is_read: boolean;
  sender?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface MessageThreadProps {
  conversation: ConversationItem;
  onConversationUpdate?: (conversation: ConversationItem) => void;
}

export default function MessageThread({ conversation, onConversationUpdate }: MessageThreadProps) {
  const { userId } = useAuth();
  const { connected, error: wsError, emit, on, off } = useWebSocket();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [conversation.id]);

  // Initialize conversation messages
  useEffect(() => {
    if (conversation?.id && userId) {
      initializeMessages();
    }
    
    return () => {
      // Clean up WebSocket listeners when conversation changes
      if (connected) {
        emit('unsubscribe_conversation', { conversationId: conversation.id });
      }
    };
  }, [conversation.id, userId]);

  // Set up WebSocket listeners for real-time messages
  useEffect(() => {
    if (!conversation?.id || !connected) return;

    const handleNewMessage = (data: Message) => {
      console.log('📨 New message received:', data);
      
      // Check if it's for our conversation
      if (data.conversation_id !== conversation.id) {
        return;
      }

      // Prevent duplicate messages
      if (messageIdsRef.current.has(data.id)) {
        return;
      }

      // Add the message
      setMessages(prev => {
        const updated = [...prev, data];
        messageIdsRef.current.add(data.id);
        
        // Keep last 100 messages in memory
        if (updated.length > 100) {
          const removed = updated.slice(0, updated.length - 100);
          removed.forEach(msg => messageIdsRef.current.delete(msg.id));
          return updated.slice(updated.length - 100);
        }
        
        return updated;
      });

      // Mark as read if from other user
      if (data.sender_id !== userId) {
        ApiClient.markMessagesAsRead(conversation.id, userId).catch(console.error);
        // Update conversation to show read status
        if (onConversationUpdate) {
          onConversationUpdate({
            ...conversation,
            unreadCount: 0,
            lastMessage: {
              content: data.content,
              created_at: data.created_at,
              sender_id: data.sender_id
            }
          });
        }
      }

      // Auto-scroll to bottom for new messages
      scrollToBottom();
    };

    console.log('🔌 Setting up WebSocket listeners for conversation:', conversation.id);
    
    // Subscribe to conversation
    emit('subscribe_conversation', { conversationId: conversation.id });
    console.log('✅ Subscribed to conversation:', conversation.id);
    
    // Listen for messages
    const unsubscribe = on('new_message', handleNewMessage);

    return () => {
      console.log('🔌 Cleaning up WebSocket listeners for conversation:', conversation.id);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      emit('unsubscribe_conversation', { conversationId: conversation.id });
    };
  }, [conversation.id, userId, connected]);

  // Update connection status based on WebSocket state
  useEffect(() => {
    if (connected) {
      setConnectionStatus('connected');
    } else if (wsError) {
      setConnectionStatus('disconnected');
    } else {
      setConnectionStatus('connecting');
    }
  }, [connected, wsError]);

  const initializeMessages = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');
      
      console.log('📝 Loading messages for conversation:', conversation.id);
      
      // Load initial messages
      const initialMessages = await ApiClient.getMessages(conversation.id, 30);
      console.log(`✅ Loaded ${initialMessages.length} initial messages`);
      
      setMessages(initialMessages);
      messageIdsRef.current = new Set(initialMessages.map(m => m.id));
      setHasMoreMessages(initialMessages.length === 30);
      
      // Mark messages as read
      await ApiClient.markMessagesAsRead(conversation.id, userId);
      
      // Update conversation to show read status
      if (onConversationUpdate) {
        onConversationUpdate({
          ...conversation,
          unreadCount: 0
        });
      }
      
      // Scroll to bottom after initial load
      setTimeout(() => scrollToBottom(), 100);
      
    } catch (error) {
      console.error('❌ Failed to initialize messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!conversation || loadingMore || !hasMoreMessages || messages.length === 0) return;
    
    try {
      setLoadingMore(true);
      
      // Get the oldest message timestamp
      const oldestMessage = messages[0];
      const olderMessages = await ApiClient.getMessages(
        conversation.id, 
        30, 
        oldestMessage.created_at
      );
      
      if (olderMessages.length > 0) {
        // Filter out duplicates and add to beginning
        const newMessages = olderMessages.filter(msg => !messageIdsRef.current.has(msg.id));
        newMessages.forEach(msg => messageIdsRef.current.add(msg.id));
        
        setMessages(prev => [...newMessages, ...prev]);
        setHasMoreMessages(olderMessages.length === 30);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
      toast.error('Failed to load older messages');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !conversation || sending) return;
    
    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    
    try {
      const result = await ApiClient.sendMessage(conversation.id, messageContent, userId);
      
      // Don't add the message locally - let WebSocket handle it consistently
      // This prevents duplicate messages since WebSocket will broadcast to all participants
      
      // Update conversation with latest message for the conversation list
      if (onConversationUpdate) {
        onConversationUpdate({
          ...conversation,
          lastMessage: {
            content: messageContent,
            created_at: new Date().toISOString(),
            sender_id: userId
          },
          lastActivity: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // Load more messages when scrolled to top
    if (scrollTop === 0 && hasMoreMessages && !loadingMore) {
      loadMoreMessages();
    }
  };

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return format(messageDate, 'h:mm a');
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${format(messageDate, 'h:mm a')}`;
    } else {
      return format(messageDate, 'MMM d, h:mm a');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 px-10 pt-8 pb-6">
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-['Spectral'] font-bold text-[20px] text-black leading-[1.4]">
              {conversation.booking?.service?.title || 'Online Teaching'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5 rounded-[40px]">
              <AvatarImage src={conversation.otherUser.avatar} alt={conversation.otherUser.display_name} />
              <AvatarFallback className="text-xs">
                {conversation.otherUser.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-['Spectral'] font-bold text-[14px] text-black leading-[1.2]">
              {conversation.otherUser.display_name}
            </span>
          </div>
        </div>
        {/* Divider */}
        <div className="w-full h-px bg-[#eeeeee]"></div>
      </div>

      {/* Messages Area - Scrollable internally */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-10 min-h-0"
        onScroll={handleScroll}
      >
        <div className="space-y-6 py-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <User className="h-12 w-12 mb-2" />
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            <>
              {hasMoreMessages && (
                <div className="flex justify-center pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={loadingMore}
                    className="text-xs"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <ChevronUp className="h-3 w-3 mr-1" />
                    )}
                    Load earlier messages
                  </Button>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-end gap-2 group",
                    message.sender_id === userId ? 'justify-end' : 'justify-start'
                  )}
                >
                  {/* Timestamp for sent messages (left side) */}
                  {message.sender_id === userId && (
                    <span className="text-xs text-[#aaaaaa] opacity-0 group-hover:opacity-100 transition-opacity duration-200 mb-1 whitespace-nowrap">
                      {formatMessageTime(message.created_at)}
                    </span>
                  )}
                  
                  {/* Message bubble */}
                  <div
                    className={cn(
                      "max-w-[410px] rounded-[12px] p-3",
                      message.sender_id === userId
                        ? 'bg-[#f2f2f2] rounded-br-[4px]' // Right message: gray background, different border radius
                        : 'bg-[#eff7ff] rounded-bl-[4px]' // Left message: light blue background, different border radius
                    )}
                  >
                    <p className="font-['Baloo_2'] font-normal text-[16px] text-black leading-[1.5] break-words">
                      {message.content}
                    </p>
                  </div>
                  
                  {/* Timestamp for received messages (right side) */}
                  {message.sender_id !== userId && (
                    <span className="text-xs text-[#aaaaaa] opacity-0 group-hover:opacity-100 transition-opacity duration-200 mb-1 whitespace-nowrap">
                      {formatMessageTime(message.created_at)}
                    </span>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input - Fixed at bottom */}
      <div className="flex-shrink-0 px-10 pb-8">
        <form onSubmit={handleSendMessage}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Perfect, see you !"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending || !connected}
              className="flex-1 bg-white border border-[#eeeeee] rounded-[8px] px-3 py-2 font-['Baloo_2'] font-normal text-[16px] text-[#666666] leading-[1.5] focus-visible:outline-none focus-visible:border-primary transition-colors"
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || sending || !connected}
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}