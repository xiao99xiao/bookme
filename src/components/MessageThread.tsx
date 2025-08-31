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
    <div className="h-full flex flex-col max-h-full min-h-0">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-background flex-shrink-0">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversation.otherUser.avatar} alt={conversation.otherUser.display_name} />
            <AvatarFallback>{conversation.otherUser.display_name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{conversation.otherUser.display_name}</h3>
            <div className="flex items-center space-x-2 text-xs">
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">Connected</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />
                  <span className="text-yellow-500">Connecting...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <span className="text-red-500">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
        {conversation.booking?.service?.title && (
          <div className="text-sm text-muted-foreground">
            Re: {conversation.booking.service.title}
          </div>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30 min-h-0"
        onScroll={handleScroll}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
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
                  "flex",
                  message.sender_id === userId ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg p-3",
                    message.sender_id === userId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background border'
                  )}
                >
                  <p className="break-words">{message.content}</p>
                  <p className={cn(
                    "text-xs mt-1",
                    message.sender_id === userId 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  )}>
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-background flex-shrink-0">
        <div className="flex space-x-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending || !connected}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim() || sending || !connected}
            size="icon"
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
  );
}