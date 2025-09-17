import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { X, Send, MessageSquare, Wifi, WifiOff, RefreshCw, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { useWebSocket } from '@/lib/websocket';
import { toast } from 'sonner';
import { Loading } from '@/design-system';

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

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
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
  const { connected, error: wsError, emit, on, off } = useWebSocket();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
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

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && !isReadOnly) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isReadOnly]);

  // Initialize chat when modal opens
  useEffect(() => {
    if (isOpen && userId && otherUserId) {
      initializeChat();
    }
    
    return () => {
      // Clean up WebSocket listeners when modal closes
      if (conversation && connected) {
        emit('unsubscribe_conversation', { conversationId: conversation.id });
      }
    };
  }, [isOpen, userId, otherUserId]); // Don't include conversation or connected in deps to avoid loops

  // Set up WebSocket listeners for real-time messages
  useEffect(() => {
    if (!conversation || isReadOnly || !connected) return;

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
  }, [conversation?.id, userId, isReadOnly]); // Only depend on stable values

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

  const initializeChat = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');
      
      console.log('📝 Loading conversation...');
      
      // Create or get existing conversation
      const conv = await ApiClient.getOrCreateConversation(otherUserId, userId);
      console.log('✅ Conversation loaded:', conv);
      setConversation(conv);
      
      // Load initial messages
      const initialMessages = await ApiClient.getMessages(conv.id, 30);
      console.log(`✅ Loaded ${initialMessages.length} initial messages`);
      
      setMessages(initialMessages);
      messageIdsRef.current = new Set(initialMessages.map(m => m.id));
      setHasMoreMessages(initialMessages.length === 30);
      
      // Mark messages as read
      await ApiClient.markMessagesAsRead(conv.id, userId);
      
      // Scroll to bottom after initial load
      setTimeout(() => scrollToBottom(), 100);
      
    } catch (error) {
      console.error('❌ Failed to initialize chat:', error);
      toast.error('Failed to load chat');
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
    
    if (!newMessage.trim() || !conversation || sending || isReadOnly) return;
    
    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    
    try {
      const result = await ApiClient.sendMessage(conversation.id, messageContent, userId);
      
      // Add the sent message to our list
      if (result && !messageIdsRef.current.has(result.id)) {
        setMessages(prev => [...prev, result]);
        messageIdsRef.current.add(result.id);
        scrollToBottom();
      }
      
      // The message will also be broadcast via WebSocket to other participants
      if (connected) {
        emit('message_sent', {
          conversationId: conversation.id,
          messageId: result.id
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header - Match Figma style */}
        <div className="flex-shrink-0 px-10 pt-8 pb-6 relative">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="absolute top-4 right-4"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex flex-col gap-1 mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="font-['Raleway'] font-bold text-[20px] text-black leading-[1.4]">
                Chat
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 rounded-[40px]">
                <AvatarImage src={otherUserAvatar} alt={otherUserName} />
                <AvatarFallback className="text-xs">
                  {otherUserName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-['Raleway'] font-bold text-[14px] text-black leading-[1.2]">
                {otherUserName}
              </span>
            </div>
          </div>
          <div className="w-full h-px bg-[#eeeeee]"></div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-10 py-6 space-y-4"
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loading variant="spinner" size="md" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-12 w-12 mb-2" />
              <p>No messages yet</p>
              {!isReadOnly && <p className="text-sm">Start the conversation!</p>}
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
                      <Loading variant="inline" size="sm">
                        <ChevronUp className="h-3 w-3" />
                      </Loading>
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
                  className={`flex items-end gap-2 group ${
                    message.sender_id === userId ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.sender_id === userId && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-gray-500 mb-1 whitespace-nowrap">
                      {formatMessageTime(message.created_at)}
                    </span>
                  )}
                  <div
                    className={`max-w-[410px] rounded-[12px] p-3 ${
                      message.sender_id === userId
                        ? 'bg-[#f2f2f2] rounded-br-[4px]'
                        : 'bg-[#eff7ff] rounded-bl-[4px]'
                    }`}
                  >
                    <p className="font-['Baloo_2'] text-[16px] leading-[1.5] text-black break-words">
                      {message.content}
                    </p>
                  </div>
                  {message.sender_id !== userId && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-gray-500 mb-1 whitespace-nowrap">
                      {formatMessageTime(message.created_at)}
                    </span>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        {!isReadOnly && (
          <div className="px-10 pb-8">
            <div className="w-full h-px bg-[#eeeeee] mb-6"></div>
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending || !connected}
                className="flex-1 px-4 py-3 border border-[#cccccc] rounded-xl font-['Baloo_2'] text-[16px] leading-[1.5] text-black placeholder:text-[#999999] focus-visible:outline-none focus-visible:border-primary"
              />
              <Button 
                type="submit" 
                disabled={!newMessage.trim() || sending || !connected}
                className="px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
              >
                {sending ? (
                  <Loading variant="inline" size="sm">
                    <Send className="h-4 w-4" />
                  </Loading>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}