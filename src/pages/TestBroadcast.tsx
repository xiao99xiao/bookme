import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { toast } from 'sonner';
import { Wifi, WifiOff, Send, Loader2 } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function TestBroadcast() {
  const { userId, authenticated } = useAuth();
  const [channelName, setChannelName] = useState('test-channel');
  const [message, setMessage] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[TestBroadcast] ${message}`);
  };

  const connectToChannel = () => {
    if (!channelName) {
      toast.error('Please enter a channel name');
      return;
    }

    // Clean up existing channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    setConnectionStatus('connecting');
    addLog(`Connecting to channel: ${channelName}`);

    // Create channel
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { 
          self: true, // Include own messages for testing
          ack: true   // Acknowledge receipt
        }
      }
    });

    // Set up event listeners
    channel
      .on('broadcast', { event: 'test-message' }, (payload) => {
        addLog(`Broadcast received: ${JSON.stringify(payload.payload)}`);
        setReceivedMessages(prev => [...prev, {
          ...payload.payload,
          receivedAt: new Date().toISOString()
        }]);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        addLog(`Presence sync: ${JSON.stringify(state)}`);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        addLog(`User joined: ${key}`);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        addLog(`User left: ${key}`);
      })
      .subscribe(async (status) => {
        addLog(`Channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          toast.success(`Connected to channel: ${channelName}`);
          
          // Track presence
          if (userId) {
            await channel.track({
              user_id: userId,
              online_at: new Date().toISOString()
            });
          }
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('error');
          toast.error('Failed to connect to channel');
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        } else {
          setConnectionStatus('connecting');
        }
      });

    channelRef.current = channel;
  };

  const disconnectFromChannel = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
      setConnectionStatus('disconnected');
      addLog('Disconnected from channel');
      toast.info('Disconnected');
    }
  };

  const sendBroadcast = async () => {
    if (!channelRef.current || connectionStatus !== 'connected') {
      toast.error('Not connected to channel');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      addLog(`Sending broadcast: ${message}`);
      
      const payload = {
        message: message.trim(),
        userId: userId || 'anonymous',
        timestamp: Date.now()
      };

      const result = await channelRef.current.send({
        type: 'broadcast',
        event: 'test-message',
        payload
      });

      if (result === 'ok') {
        addLog('Broadcast sent successfully');
        toast.success('Message sent');
        setMessage('');
      } else {
        addLog(`Broadcast failed: ${result}`);
        toast.error('Failed to send message');
      }
    } catch (error) {
      addLog(`Error sending broadcast: ${error}`);
      toast.error('Error sending message');
    }
  };

  const testDatabaseBroadcast = async () => {
    // This would trigger a database-based broadcast if configured
    addLog('Database broadcast not yet implemented');
    toast.info('Database broadcast requires additional setup');
  };

  const clearLogs = () => {
    setLogs([]);
    setReceivedMessages([]);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Supabase Broadcast Test</CardTitle>
          <CardDescription>
            Test real-time broadcast functionality with Supabase channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input
                placeholder="Channel name (e.g., test-channel)"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="flex-1"
              />
              <Badge variant={
                connectionStatus === 'connected' ? 'default' :
                connectionStatus === 'connecting' ? 'secondary' :
                connectionStatus === 'error' ? 'destructive' : 'outline'
              }>
                {connectionStatus === 'connected' && <Wifi className="h-3 w-3 mr-1" />}
                {connectionStatus === 'disconnected' && <WifiOff className="h-3 w-3 mr-1" />}
                {connectionStatus === 'connecting' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {connectionStatus}
              </Badge>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                onClick={connectToChannel} 
                disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
              >
                Connect to Channel
              </Button>
              <Button 
                onClick={disconnectFromChannel} 
                disabled={connectionStatus === 'disconnected'}
                variant="outline"
              >
                Disconnect
              </Button>
              <Button
                onClick={clearLogs}
                variant="outline"
              >
                Clear Logs
              </Button>
            </div>
          </div>

          {/* Send Message Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Send Broadcast Message</h3>
            <div className="flex space-x-2">
              <Input
                placeholder="Enter message to broadcast..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendBroadcast()}
                disabled={connectionStatus !== 'connected'}
                className="flex-1"
              />
              <Button 
                onClick={sendBroadcast}
                disabled={connectionStatus !== 'connected' || !message.trim()}
              >
                <Send className="h-4 w-4 mr-1" />
                Send
              </Button>
            </div>
            <Button
              onClick={testDatabaseBroadcast}
              variant="outline"
              className="w-full"
            >
              Test Database Broadcast (Advanced)
            </Button>
          </div>

          {/* User Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">User Info</h4>
            <div className="text-sm space-y-1">
              <p>Authenticated: {authenticated ? 'Yes' : 'No'}</p>
              <p>User ID: {userId || 'Not logged in'}</p>
            </div>
          </div>

          {/* Received Messages */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Received Messages</h3>
            <div className="max-h-48 overflow-y-auto space-y-2 p-4 bg-gray-50 rounded-lg">
              {receivedMessages.length === 0 ? (
                <p className="text-gray-500 text-sm">No messages received yet</p>
              ) : (
                receivedMessages.map((msg, index) => (
                  <div key={index} className="p-2 bg-white rounded border text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{msg.message}</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(msg.receivedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      From: {msg.userId}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Debug Logs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Debug Logs</h3>
            <div className="max-h-64 overflow-y-auto space-y-1 p-4 bg-gray-900 text-gray-100 rounded-lg font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How to Test</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Open this page in two different browser windows/tabs</li>
              <li>2. Use the same channel name in both windows</li>
              <li>3. Click "Connect to Channel" in both windows</li>
              <li>4. Send a message from one window</li>
              <li>5. The message should appear instantly in both windows</li>
              <li>6. Check the debug logs to see the broadcast events</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}