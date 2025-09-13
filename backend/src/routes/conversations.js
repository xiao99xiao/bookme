/**
 * Conversation Routes
 * 
 * This module handles conversation and messaging endpoints including real-time chat,
 * conversation management, message sending/receiving, and read status tracking.
 * Integrates with WebSocket for real-time messaging experience.
 * 
 * Usage:
 * ```javascript
 * import conversationRoutes from './routes/conversations.js';
 * conversationRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create conversation routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function conversationRoutes(app) {

  /**
   * GET /api/conversations
   * 
   * Get all conversations for the authenticated user.
   * This endpoint returns conversations with the latest message and unread counts.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Query Parameters:
   * - limit: Number of conversations to return (default: 50)
   * - offset: Pagination offset (default: 0)
   * - unread_only: Filter for unread conversations only
   * 
   * Response:
   * - Array of conversation objects with participants and latest message
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with conversations or error
   */
  app.get('/api/conversations', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { limit = '50', offset = '0', unread_only } = c.req.query();

      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      // Get conversations where user is a participant (matching original schema)
      const { data: conversations, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      if (error) {
        console.error('Conversations fetch error:', error);
        // Return empty conversations array to prevent frontend crashes
        return c.json({
          conversations: [],
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: 0,
            has_more: false
          },
          error: 'Failed to fetch conversations'
        });
      }

      // Enrich conversations with user data and last messages (matching original implementation)
      const enrichedConversations = await Promise.all(
        (conversations || []).map(async (conversation) => {
          // Get both users
          const { data: user1Data } = await supabaseAdmin
            .from('users')
            .select('id, display_name, avatar')
            .eq('id', conversation.user1_id)
            .single();

          const { data: user2Data } = await supabaseAdmin
            .from('users')
            .select('id, display_name, avatar')
            .eq('id', conversation.user2_id)
            .single();

          // Map to customer/provider structure for consistency
          // The current user is "customer", the other user is "provider"
          let customer, provider, otherUser;
          if (conversation.user1_id === userId) {
            customer = user1Data;
            provider = user2Data;
            otherUser = user2Data;
          } else {
            customer = user2Data;
            provider = user1Data;
            otherUser = user1Data;
          }

          // Get last message (return as array to match frontend expectations)
          const { data: lastMessageArray } = await supabaseAdmin
            .from('messages')
            .select('id, content, created_at, sender_id')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1);

          // Get booking information between these two users (most recent booking)
          const { data: booking } = await supabaseAdmin
            .from('bookings')
            .select(`
              id,
              status,
              scheduled_at,
              services!inner(
                id,
                title,
                description
              )
            `)
            .or(`and(customer_id.eq.${conversation.user1_id},provider_id.eq.${conversation.user2_id}),and(customer_id.eq.${conversation.user2_id},provider_id.eq.${conversation.user1_id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...conversation,
            customer,
            provider,
            other_user: otherUser,
            last_message: lastMessageArray || [], // Frontend expects array
            booking: booking || null // Add booking information for frontend
          };
        })
      );

      const formattedConversations = enrichedConversations;

      // Filter for unread only if requested (simplified - matching original)
      const finalConversations = formattedConversations;

      return c.json({
        conversations: finalConversations,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: finalConversations.length,
          has_more: finalConversations.length === limitNum
        }
      });

    } catch (error) {
      console.error('Conversations error:', error);
      // Return empty conversations array to prevent frontend crashes
      return c.json({
        conversations: [],
        pagination: {
          limit: 50,
          offset: 0,
          total: 0,
          has_more: false
        },
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/conversations/:id
   * 
   * Get a specific conversation by ID with participant information.
   * Only accessible by conversation participants.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - id: UUID of the conversation
   * 
   * Response:
   * - Conversation object with full participant details
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with conversation data or error
   */
  app.get('/api/conversations/:id', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');

      // Get conversation (matching original schema)
      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error || !conversation) {
        return c.json({ error: 'Conversation not found' }, 404);
      }

      // Verify user is part of conversation
      if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Get user data
      const { data: user1Data } = await supabaseAdmin
        .from('users')
        .select('id, display_name, avatar')
        .eq('id', conversation.user1_id)
        .single();

      const { data: user2Data } = await supabaseAdmin
        .from('users')
        .select('id, display_name, avatar')
        .eq('id', conversation.user2_id)
        .single();

      let customer, provider, otherParticipant;
      if (conversation.user1_id === userId) {
        customer = user1Data;
        provider = user2Data;
        otherParticipant = user2Data;
      } else {
        customer = user2Data;
        provider = user1Data;
        otherParticipant = user1Data;
      }

      return c.json({
        ...conversation,
        customer,
        provider,
        other_participant: otherParticipant
      });

    } catch (error) {
      console.error('Conversation fetch error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/conversations
   * 
   * Create a new conversation between two users.
   * This endpoint handles conversation creation with duplicate prevention.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - participant_id: UUID of the other participant
   * - booking_id: Optional booking ID that initiated the conversation
   * - initial_message: Optional initial message content
   * 
   * Response:
   * - Created conversation object or existing conversation if already exists
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with conversation data or error
   */
  app.post('/api/conversations', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { participant_id, booking_id, initial_message } = body;

      if (!participant_id) {
        return c.json({ error: 'Participant ID is required' }, 400);
      }

      if (participant_id === userId) {
        return c.json({ error: 'Cannot create conversation with yourself' }, 400);
      }

      // Check if conversation already exists (matching original implementation)
      const { data: existing1 } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('user1_id', userId)
        .eq('user2_id', participant_id)
        .single();

      if (existing1) {
        return c.json(existing1);
      }

      const { data: existing2 } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('user1_id', participant_id)
        .eq('user2_id', userId)
        .single();

      if (existing2) {
        return c.json(existing2);
      }

      // Verify the other participant exists
      const { data: otherUser, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, display_name, avatar')
        .eq('id', participant_id)
        .single();

      if (userError || !otherUser) {
        console.error('Participant verification error:', userError);
        return c.json({ error: 'Participant not found' }, 404);
      }

      // Create new conversation (matching original implementation)
      const { data: newConversation, error: createError } = await supabaseAdmin
        .from('conversations')
        .insert({
          user1_id: userId,
          user2_id: participant_id,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Create conversation error:', createError);
        return c.json({ error: 'Failed to create conversation' }, 500);
      }

      return c.json(newConversation);

    } catch (error) {
      console.error('Conversation creation error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * PUT /api/conversations/:conversationId/read
   * 
   * Mark all messages in a conversation as read.
   * This endpoint updates the read status for all unread messages from other participants.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - conversationId: UUID of the conversation
   * 
   * Response:
   * - Success confirmation with count of messages marked as read
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with success status or error
   */
  app.put('/api/conversations/:conversationId/read', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('conversationId');

      // Verify user has access to this conversation
      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', conversationId)
        .single();

      if (conversationError || !conversation) {
        console.error('Conversation verification error:', conversationError);
        return c.json({ error: 'Conversation not found' }, 404);
      }

      if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Mark all unread messages from other participants as read
      const { data: updatedMessages, error: updateError } = await supabaseAdmin
        .from('messages')
        .update({ 
          is_read: true
        })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false)
        .select('id');

      if (updateError) {
        console.error('Messages read update error:', updateError);
        return c.json({ error: 'Failed to mark messages as read' }, 500);
      }

      const markedCount = updatedMessages?.length || 0;

      // Emit WebSocket event for real-time updates
      try {
        const { getIO } = await import('../websocket.js');
        const io = getIO();
        if (io) {
          const otherParticipantId = conversation.user1_id === userId 
            ? conversation.user2_id 
            : conversation.user1_id;
          
          io.to(otherParticipantId).emit('messagesRead', {
            conversationId,
            readByUserId: userId,
            messageCount: markedCount
          });
        }
      } catch (socketError) {
        console.error('WebSocket notification error:', socketError);
      }

      return c.json({
        success: true,
        messages_marked_read: markedCount
      });

    } catch (error) {
      console.error('Mark conversation read error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/messages
   * 
   * Send a new message in a conversation.
   * This endpoint handles message creation with real-time delivery via WebSocket.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - conversation_id: UUID of the conversation
   * - content: Message content
   * - message_type: Type of message ('text', 'image', 'file', 'booking_update')
   * - metadata: Optional metadata for structured messages
   * 
   * Response:
   * - Created message object with sender information
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with message data or error
   */
  app.post('/api/messages', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { conversation_id, content, message_type = 'text', metadata } = body;

      if (!conversation_id || !content) {
        return c.json({ error: 'Conversation ID and content are required' }, 400);
      }

      // Verify user has access to this conversation
      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', conversation_id)
        .single();

      if (conversationError || !conversation) {
        console.error('Conversation verification error:', conversationError);
        return c.json({ error: 'Conversation not found' }, 404);
      }

      if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Create message
      const messageData = {
        conversation_id,
        sender_id: userId,
        content,
        message_type,
        metadata: metadata || null,
        is_read: false,
        created_at: new Date().toISOString()
      };

      const { data: message, error: messageError } = await supabaseAdmin
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, display_name, avatar)
        `)
        .single();

      if (messageError) {
        console.error('Message creation error:', messageError);
        return c.json({ error: 'Failed to send message' }, 500);
      }

      // Update conversation with latest message
      const { error: updateConversationError } = await supabaseAdmin
        .from('conversations')
        .update({
          latest_message_id: message.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation_id);

      if (updateConversationError) {
        console.error('Conversation update error:', updateConversationError);
      }

      // Send real-time message via WebSocket
      try {
        const { getIO } = await import('../websocket.js');
        const io = getIO();
        if (io) {
          const otherParticipantId = conversation.user1_id === userId 
            ? conversation.user2_id 
            : conversation.user1_id;

          io.to(otherParticipantId).emit('newMessage', {
            ...message,
            conversation_id
          });

          // Also emit to sender for confirmation
          io.to(userId).emit('messageSent', {
            ...message,
            conversation_id
          });
        }
      } catch (socketError) {
        console.error('WebSocket message delivery error:', socketError);
      }

      return c.json(message);

    } catch (error) {
      console.error('Message send error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/messages/:conversationId
   * 
   * Get all messages for a specific conversation.
   * This endpoint returns paginated messages with sender information.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - conversationId: UUID of the conversation
   * 
   * Query Parameters:
   * - limit: Number of messages to return (default: 50, max: 100)
   * - offset: Pagination offset (default: 0)
   * - before: Get messages before this message ID (for infinite scroll)
   * - after: Get messages after this message ID
   * 
   * Response:
   * - Array of message objects with sender information
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with messages or error
   */
  app.get('/api/messages/:conversationId', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('conversationId');
      const { 
        limit = '50', 
        offset = '0', 
        before, 
        after 
      } = c.req.query();

      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      // Verify user has access to this conversation
      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', conversationId)
        .single();

      if (conversationError || !conversation) {
        console.error('Conversation verification error:', conversationError);
        return c.json({ error: 'Conversation not found' }, 404);
      }

      if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Build messages query
      let query = supabaseAdmin
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, display_name, avatar)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      // Apply cursor-based pagination if specified
      if (before) {
        const { data: beforeMessage } = await supabaseAdmin
          .from('messages')
          .select('created_at')
          .eq('id', before)
          .single();
        
        if (beforeMessage) {
          query = query.lt('created_at', beforeMessage.created_at);
        }
      }

      if (after) {
        const { data: afterMessage } = await supabaseAdmin
          .from('messages')
          .select('created_at')
          .eq('id', after)
          .single();
        
        if (afterMessage) {
          query = query.gt('created_at', afterMessage.created_at);
        }
      }

      // Apply pagination
      if (!before && !after) {
        query = query.range(offsetNum, offsetNum + limitNum - 1);
      } else {
        query = query.limit(limitNum);
      }

      const { data: messages, error: messagesError } = await query;

      if (messagesError) {
        console.error('Messages fetch error:', messagesError);
        return c.json({ error: 'Failed to fetch messages' }, 500);
      }

      // Reverse messages to show chronological order (oldest first)
      const chronologicalMessages = messages?.reverse() || [];

      // Mark messages as read asynchronously (only messages from other participants)
      setImmediate(async () => {
        try {
          const unreadMessageIds = chronologicalMessages
            .filter(msg => msg.sender_id !== userId && !msg.is_read)
            .map(msg => msg.id);

          if (unreadMessageIds.length > 0) {
            await supabaseAdmin
              .from('messages')
              .update({ 
                is_read: true
              })
              .in('id', unreadMessageIds);

            // Notify other participant via WebSocket
            try {
              const { getIO } = await import('../websocket.js');
              const io = getIO();
              if (io) {
                const otherParticipantId = conversation.user1_id === userId 
                  ? conversation.user2_id 
                  : conversation.user1_id;
                
                io.to(otherParticipantId).emit('messagesRead', {
                  conversationId,
                  readByUserId: userId,
                  messageCount: unreadMessageIds.length
                });
              }
            } catch (socketError) {
              console.error('WebSocket read notification error:', socketError);
            }
          }
        } catch (readUpdateError) {
          console.error('Auto-read update error:', readUpdateError);
        }
      });

      return c.json({
        messages: chronologicalMessages,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          has_more: chronologicalMessages.length === limitNum,
          before: before || null,
          after: after || null
        }
      });

    } catch (error) {
      console.error('Messages fetch error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
}