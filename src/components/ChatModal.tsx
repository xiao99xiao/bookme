import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { X, Send, MessageSquare, Loader2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
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
  otherUserAvatar 
}: ChatModalProps) {
  const { userId } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastMessageTimestampRef = useRef<number>(0);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize chat when modal opens
  useEffect(() => {
    if (isOpen && otherUserId) {
      console.log('🚀 Initializing chat modal...');
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
    if (!conversation) return;

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

        // Fetch fresh messages to ensure consistency
        await refreshMessages();
        
        // Mark messages as read if from other user
        if (broadcastData.senderId !== userId) {
          await ApiClient.markMessagesAsRead(conversation.id, userId);
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Future feature: show typing indicator
        console.log('⌨️ User is typing...', payload);
      })
      .on('broadcast', { event: 'message-read' }, (payload) => {
        // Future feature: show read receipts
        console.log('👁️ Message read:', payload);
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
      
      // Load messages
      await refreshMessages(conv.id);
      
      // Mark messages as read
      await ApiClient.markMessagesAsRead(conv.id, userId);
      console.log('✅ Messages marked as read');
      
    } catch (error) {
      console.error('❌ Failed to initialize chat:', error);
      toast.error('Failed to load chat');
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const refreshMessages = async (conversationId?: string) => {
    const convId = conversationId || conversation?.id;
    if (!convId) return;

    try {
      console.log('🔄 Refreshing messages...');
      const msgs = await ApiClient.getMessages(convId);
      
      // Update message IDs set for deduplication
      messageIdsRef.current = new Set(msgs.map(m => m.id));
      
      setMessages(msgs);
      console.log(`✅ Loaded ${msgs.length} messages`);
    } catch (error) {
      console.error('❌ Failed to refresh messages:', error);
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
    await refreshMessages();
    toast.success('Messages refreshed');
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
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {/* Message Input */}
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
      </div>
    </div>
  );
}