import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { X, Send, MessageSquare, Loader2, Wifi, WifiOff, RefreshCw, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  user1_id: string;
  user2_id: string;
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

// Broadcast message payload type
interface BroadcastPayload {
  conversationId: string;
  senderId: string;
  messageId: string;
  timestamp: number;
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
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
      console.log('🔄 Loading older messages before:', oldestMessage.created_at);
      
      const olderMessages = await ApiClient.getMessages(
        conversation.id, 
        30, 
        oldestMessage.created_at
      );
      
      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
        console.log('📝 No more older messages');
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
        
        console.log(`✅ Loaded ${olderMessages.length} older messages`);
      }
    } catch (error) {
      console.error('❌ Failed to load older messages:', error);
      toast.error('Failed to load older messages');
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  useEffect(() => {
    if (!initialLoadRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Initialize chat when modal opens
  useEffect(() => {
    if (isOpen && otherUserId) {
      console.log('🚀 Initializing chat modal...');
      initialLoadRef.current = true;
      setShouldScrollToBottom(true);
      setHasMoreMessages(true);
      setMessages([]);
      messageIdsRef.current.clear();
      initializeChat();
    }
    
    // Cleanup on close
    return () => {
      if (!isOpen) {
        cleanupChannel();
      }
    };
  }, [isOpen, otherUserId]);

  // Set up broadcast channel when conversation is ready
  useEffect(() => {
    if (!conversation || !isOpen) return;

    console.log('📡 Setting up broadcast channel for conversation:', conversation.id);
    setupBroadcastChannel();

    return () => {
      cleanupChannel();
    };
  }, [conversation?.id, isOpen]);

  // Add scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const cleanupChannel = () => {
    if (channelRef.current) {
      console.log('🔌 Cleaning up broadcast channel...');
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  const setupBroadcastChannel = () => {
    if (!conversation || isReadOnly) return;

    // Clean up existing channel if any
    cleanupChannel();

    // Create a unique channel for this conversation
    const channelName = `chat:${conversation.id}`;
    console.log(`🔗 Creating broadcast channel: ${channelName}`);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { 
          self: false, // Don't receive own messages
          ack: true    // Acknowledge message receipt
        }
      }
    });

    // Handle broadcast messages
    channel
      .on('broadcast', { event: 'new-message' }, async (payload) => {
        console.log('📨 Broadcast received:', payload);
        
        const broadcastData = payload.payload as BroadcastPayload;
        
        // Validate payload
        if (!broadcastData?.messageId || !broadcastData?.conversationId) {
          console.error('❌ Invalid broadcast payload:', payload);
          return;
        }

        // Check if it's for our conversation
        if (broadcastData.conversationId !== conversation.id) {
          console.log('🔀 Message for different conversation, ignoring...');
          return;
        }

        // Prevent duplicate messages
        if (messageIdsRef.current.has(broadcastData.messageId)) {
          console.log('🔁 Duplicate message detected, skipping...');
          return;
        }

        // Prevent processing if message is from current user (shouldn't happen with self: false)
        if (broadcastData.senderId === userId) {
          console.log('🔄 Own message received (unexpected), skipping...');
          return;
        }

        // If user is near bottom, we'll scroll to new message
        const wasNearBottom = isNearBottom();
        
        // Fetch the latest messages to get the new message with sender info
        try {
          const latestMessages = await ApiClient.getMessages(conversation.id, 30);
          const newMessage = latestMessages.find(msg => msg.id === broadcastData.messageId);
          
          if (newMessage && !messageIdsRef.current.has(newMessage.id)) {
            setMessages(prev => {
              // Add new message and keep only recent ones to avoid memory issues
              const updated = [...prev, newMessage];
              messageIdsRef.current.add(newMessage.id);
              
              // Keep last 100 messages in memory to prevent performance issues
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
            
            console.log('✅ Added real-time message to UI');
          }
        } catch (error) {
          console.error('❌ Failed to fetch new message:', error);
        }
        
        // Mark messages as read if from other user
        if (broadcastData.senderId !== userId) {
          await ApiClient.markMessagesAsRead(conversation.id, userId);
        }
      })
      .subscribe((status) => {
        console.log('📊 Channel subscription status:', status);
        
        switch (status) {
          case 'SUBSCRIBED':
            console.log('✅ Successfully connected to broadcast channel');
            setConnectionStatus('connected');
            break;
          case 'CHANNEL_ERROR':
            console.error('❌ Channel error, attempting reconnect...');
            setConnectionStatus('error');
            attemptReconnect();
            break;
          case 'TIMED_OUT':
            console.warn('⏱️ Connection timed out, attempting reconnect...');
            setConnectionStatus('disconnected');
            attemptReconnect();
            break;
          case 'CLOSED':
            console.log('🔒 Channel closed');
            setConnectionStatus('disconnected');
            break;
          default:
            console.log('Channel status:', status);
            setConnectionStatus('connecting');
        }
      });

    channelRef.current = channel;
  };

  const attemptReconnect = () => {
    console.log('🔄 Attempting to reconnect...');
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Try to reconnect after 2 seconds
    reconnectTimeoutRef.current = setTimeout(() => {
      if (conversation && isOpen) {
        setupBroadcastChannel();
      }
    }, 2000);
  };

  const initializeChat = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');
      
      console.log('📝 Loading conversation...');
      
      // Create or get existing conversation
      const conv = await ApiClient.getOrCreateConversation(otherUserId, userId);
      console.log('✅ Conversation loaded:', conv);
      setConversation(conv);
      
      // Load initial messages (latest 30)
      const initialMessages = await ApiClient.getMessages(conv.id, 30);
      console.log(`✅ Loaded ${initialMessages.length} initial messages`);
      
      setMessages(initialMessages);
      messageIdsRef.current = new Set(initialMessages.map(m => m.id));
      
      // Set hasMoreMessages based on whether we got a full page
      setHasMoreMessages(initialMessages.length === 30);
      
      // Mark messages as read
      await ApiClient.markMessagesAsRead(conv.id, userId);
      console.log('✅ Messages marked as read');
      
      // Scroll to bottom after initial load
      setTimeout(() => {
        scrollToBottom('auto');
        initialLoadRef.current = false;
      }, 100);
      
    } catch (error) {
      console.error('❌ Failed to initialize chat:', error);
      toast.error('Failed to load chat');
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !conversation || sending) return;
    
    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    try {
      setSending(true);
      
      console.log('📤 Sending message...');
      
      // Always scroll to bottom when sending a message
      setShouldScrollToBottom(true);
      
      // Add optimistic message immediately
      const optimisticMessage: Message = {
        id: tempId,
        content: messageContent,
        sender_id: userId!,
        created_at: new Date().toISOString(),
        is_read: false,
        sender: {
          display_name: 'You',
          avatar: undefined
        }
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
      
      // Send message to database
      const result = await ApiClient.sendMessage(conversation.id, messageContent, userId);
      console.log('✅ Message sent to database:', result);
      
      // Update optimistic message with real data
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...result, sender: optimisticMessage.sender } : msg
      ));
      
      // Add to message IDs set
      messageIdsRef.current.add(result.id);
      
      // Broadcast to other users
      if (channelRef.current && connectionStatus === 'connected') {
        const broadcastPayload: BroadcastPayload = {
          conversationId: conversation.id,
          senderId: userId!,
          messageId: result.id,
          timestamp: Date.now()
        };
        
        await channelRef.current.send({
          type: 'broadcast',
          event: 'new-message',
          payload: broadcastPayload
        });
        
        console.log('📡 Message broadcast sent');
      } else {
        console.warn('⚠️ Broadcast channel not connected, message saved to DB only');
      }
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageContent); // Restore message input
      
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!conversation) return;
    
    try {
      const latestMessages = await ApiClient.getMessages(conversation.id, 30);
      setMessages(latestMessages);
      messageIdsRef.current = new Set(latestMessages.map(m => m.id));
      setShouldScrollToBottom(true);
      scrollToBottom('auto');
      toast.success('Messages refreshed');
    } catch (error) {
      toast.error('Failed to refresh messages');
    }
  };

  // Render connection status icon
  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <span className="text-green-600">Live</span>
          </>
        );
      case 'connecting':
        return (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
            <span className="text-yellow-600">Connecting...</span>
          </>
        );
      case 'error':
      case 'disconnected':
        return (
          <>
            <WifiOff className="h-3 w-3 text-red-500" />
            <span className="text-red-600">Offline</span>
          </>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={otherUserAvatar} />
              <AvatarFallback>
                {otherUserName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{otherUserName}</h3>
              <div className="flex items-center space-x-1 text-xs">
                {renderConnectionStatus()}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleManualRefresh}
              title="Refresh messages"
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 relative"
          style={{ scrollBehavior: shouldScrollToBottom ? 'smooth' : 'auto' }}
        >
          {/* Load older messages indicator */}
          {loadingOlderMessages && (
            <div className="flex justify-center py-2">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading older messages...</span>
              </div>
            </div>
          )}
          
          {/* No more messages indicator */}
          {!hasMoreMessages && messages.length > 0 && (
            <div className="flex justify-center py-2">
              <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                Beginning of conversation
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-12 w-12 mb-4 text-gray-300" />
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_id === userId
                        ? 'bg-blue-600'
                        : 'bg-gray-100'
                    }`}
                  >
                    <p className={message.sender_id === userId ? 'text-white' : 'text-gray-900'}>
                      {message.content}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        message.sender_id === userId ? 'text-blue-200' : 'text-gray-500'
                      }`}
                    >
                      {format(new Date(message.created_at), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Scroll to bottom button */}
        {!shouldScrollToBottom && messages.length > 0 && (
          <div className="absolute bottom-20 right-8">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full shadow-lg bg-white hover:bg-gray-50"
              onClick={() => {
                setShouldScrollToBottom(true);
                scrollToBottom();
              }}
            >
              <ChevronUp className="h-4 w-4 transform rotate-180" />
            </Button>
          </div>
        )}

        {/* Message Input */}
        {isReadOnly ? (
          <div className="p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-500 text-center">
              This chat is read-only. The booking has been cancelled.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={connectionStatus === 'connected' ? "Type your message..." : "Connecting..."}
                className="flex-1"
                disabled={sending || connectionStatus === 'error'}
                maxLength={1000}
              />
              <Button 
                type="submit" 
                disabled={!newMessage.trim() || sending || connectionStatus === 'error'}
                variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {connectionStatus === 'error' && (
              <p className="text-xs text-red-500 mt-1">
                Connection lost. Messages will be saved but may not appear instantly.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}