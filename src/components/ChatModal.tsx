import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { X, Send, MessageSquare, Loader2, Wifi, WifiOff, RefreshCw, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { useWebSocket } from '@/lib/websocket';
import { toast } from 'sonner';

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
      if (conversation) {
        off('new_message', () => {});
        emit('unsubscribe_conversation', { conversationId: conversation.id });
      }
    };
  }, [isOpen, userId, otherUserId]);

  // Set up WebSocket listeners for real-time messages
  useEffect(() => {
    if (!conversation || isReadOnly) return;

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
    if (connected) {
      emit('subscribe_conversation', { conversationId: conversation.id });
      console.log('✅ Subscribed to conversation:', conversation.id);
    }
    
    // Always listen for messages
    const unsubscribe = on('new_message', handleNewMessage);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      if (connected) {
        emit('unsubscribe_conversation', { conversationId: conversation.id });
      }
    };
  }, [conversation, userId, isReadOnly, connected, emit, on]);

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
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={otherUserAvatar} alt={otherUserName} />
              <AvatarFallback>{otherUserName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{otherUserName}</h3>
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
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
                  className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.sender_id === userId
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender_id === userId ? 'text-blue-100' : 'text-gray-500'
                    }`}>
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
        {!isReadOnly && (
          <form onSubmit={handleSendMessage} className="p-4 border-t">
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
        )}
      </div>
    </div>
  );
}