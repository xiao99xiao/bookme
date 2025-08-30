import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { X, Send, MessageSquare, Loader2, Wifi, WifiOff, RefreshCw, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { useWebSocket, type Message as WSMessage } from '@/lib/websocket';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  sender: {
    display_name: string;
    avatar?: string;
  };
}

interface Conversation {
  id: string;
  customer_id: string;
  provider_id: string;
  other_user?: {
    display_name: string;
    avatar?: string;
  };
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  isReadOnly?: boolean;
}

export default function ChatModal({ 
  isOpen, 
  onClose, 
  otherUserId, 
  otherUserName, 
  otherUserAvatar,
  isReadOnly = false
}: ChatModalProps) {
  const { userId } = useAuth();
  const { connected, sendMessage: wsSendMessage, markAsRead, subscribe } = useWebSocket();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Auto-scroll to bottom when appropriate
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (shouldScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  }, [shouldScrollToBottom]);

  // Check if user is near bottom of chat
  const isNearBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const threshold = 150; // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // Check if user scrolled to top (for loading older messages)
    if (scrollTop < 100 && !loadingOlderMessages && hasMoreMessages) {
      loadOlderMessages();
    }
    
    // Update shouldScrollToBottom based on user's scroll position
    setShouldScrollToBottom(isNearBottom());
  }, [loadingOlderMessages, hasMoreMessages, isNearBottom]);

  // Load older messages when scrolling to top
  const loadOlderMessages = async () => {
    if (!conversation || messages.length === 0 || loadingOlderMessages) return;
    
    setLoadingOlderMessages(true);
    
    try {
      const oldestMessage = messages[0];
      const olderMessages = await ApiClient.getConversationMessages(
        conversation.id, 
        30, 
        oldestMessage.created_at
      );
      
      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        // Store current scroll position
        const container = messagesContainerRef.current;
        const currentScrollHeight = container?.scrollHeight || 0;
        
        // Add older messages to the beginning
        setMessages(prev => [...olderMessages, ...prev]);
        
        // Update message IDs for deduplication
        olderMessages.forEach(msg => messageIdsRef.current.add(msg.id));
        
        // Restore scroll position (maintain current view)
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - currentScrollHeight;
            container.scrollTop = scrollDiff;
          }
        }, 0);
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
      toast.error('Failed to load older messages');
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!conversation || !isOpen) return;

    // Subscribe to new messages
    const unsubscribeNewMessage = subscribe('new_message', (message: WSMessage) => {
      if (message.conversation_id === conversation.id && !messageIdsRef.current.has(message.id)) {
        const wasNearBottom = isNearBottom();
        
        setMessages(prev => {
          const updated = [...prev, message as any];
          messageIdsRef.current.add(message.id);
          
          // Keep last 100 messages in memory
          if (updated.length > 100) {
            const removed = updated.slice(0, updated.length - 100);
            removed.forEach(msg => messageIdsRef.current.delete(msg.id));
            return updated.slice(updated.length - 100);
          }
          
          return updated;
        });
        
        // Only auto-scroll if user was already near bottom
        if (wasNearBottom) {
          setShouldScrollToBottom(true);
        }
        
        // Mark as read if from other user
        if (message.sender_id !== userId) {
          markAsRead(conversation.id);
        }
      }
    });

    // Subscribe to message sent confirmation
    const unsubscribeMessageSent = subscribe('message_sent', (message: WSMessage) => {
      if (message.conversation_id === conversation.id && !messageIdsRef.current.has(message.id)) {
        setMessages(prev => {
          const updated = [...prev, message as any];
          messageIdsRef.current.add(message.id);
          return updated;
        });
        setShouldScrollToBottom(true);
      }
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageSent();
    };
  }, [conversation, isOpen, subscribe, isNearBottom, userId, markAsRead]);

  // Load conversation and initial messages
  useEffect(() => {
    if (!isOpen || !userId || !otherUserId) return;

    const loadConversation = async () => {
      setLoading(true);
      try {
        // Get or create conversation
        const conv = await ApiClient.createConversation(userId, otherUserId);
        setConversation({
          ...conv,
          other_user: {
            display_name: otherUserName,
            avatar: otherUserAvatar
          }
        });

        // Load initial messages
        const initialMessages = await ApiClient.getConversationMessages(conv.id, 50);
        setMessages(initialMessages);
        
        // Track message IDs for deduplication
        messageIdsRef.current.clear();
        initialMessages.forEach(msg => messageIdsRef.current.add(msg.id));
        
        // Mark messages as read
        if (!isReadOnly) {
          await markAsRead(conv.id);
        }
        
        // Scroll to bottom on initial load
        setShouldScrollToBottom(true);
        setTimeout(() => scrollToBottom('instant'), 100);
      } catch (error) {
        console.error('Failed to load conversation:', error);
        toast.error('Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [isOpen, userId, otherUserId, otherUserName, otherUserAvatar, isReadOnly, markAsRead, scrollToBottom]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Setup scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversation || sending || isReadOnly) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await wsSendMessage(conversation.id, messageText);
      setShouldScrollToBottom(true);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    const now = new Date();
    
    if (messageDate.toDateString() === now.toDateString()) {
      return format(messageDate, 'HH:mm');
    } else if (messageDate.getFullYear() === now.getFullYear()) {
      return format(messageDate, 'MMM d, HH:mm');
    } else {
      return format(messageDate, 'MMM d yyyy, HH:mm');
    }
  };

  const getConnectionIcon = () => {
    if (connected) {
      return <Wifi className="h-3 w-3 text-green-500" />;
    } else {
      return <WifiOff className="h-3 w-3 text-red-500 animate-pulse" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex h-[600px] w-full max-w-md flex-col rounded-lg border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherUserAvatar} />
              <AvatarFallback>{otherUserName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{otherUserName}</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getConnectionIcon()}
                <span>{connected ? 'Connected' : 'Connecting...'}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {loadingOlderMessages && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
              {!isReadOnly && (
                <p className="text-xs text-muted-foreground mt-1">Start a conversation!</p>
              )}
            </div>
          )}

          {messages.map((message) => {
            const isOwnMessage = message.sender_id === userId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!isReadOnly && (
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={sending || !connected}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
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
          </div>
        )}
      </div>
    </div>
  );
}