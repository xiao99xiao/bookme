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

      // Get conversations where user is a participant
      let query = supabaseAdmin
        .from('conversations')
        .select(`
          *,
          participant1:users!participant1_id(id, display_name, avatar),
          participant2:users!participant2_id(id, display_name, avatar),
          latest_message:messages!latest_message_id(id, content, created_at, sender_id, message_type)
        `)
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order('updated_at', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      const { data: conversations, error: conversationsError } = await query;

      if (conversationsError) {
        console.error('Conversations fetch error:', conversationsError);
        return c.json({ error: 'Failed to fetch conversations' }, 500);
      }

      // Get unread message counts for each conversation
      const conversationIds = conversations?.map(conv => conv.id) || [];
      let unreadCounts = {};

      if (conversationIds.length > 0) {
        const { data: unreadData, error: unreadError } = await supabaseAdmin
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', conversationIds)
          .neq('sender_id', userId)
          .eq('is_read', false);

        if (!unreadError) {
          unreadCounts = unreadData?.reduce((acc, msg) => {
            acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
            return acc;
          }, {}) || {};
        }
      }

      // Format conversations with additional metadata
      const formattedConversations = conversations?.map(conv => {
        const otherParticipant = conv.participant1_id === userId ? conv.participant2 : conv.participant1;
        const unreadCount = unreadCounts[conv.id] || 0;

        return {
          ...conv,
          other_participant: otherParticipant,
          unread_count: unreadCount,
          is_read: unreadCount === 0
        };
      }) || [];

      // Filter for unread only if requested
      const finalConversations = unread_only === 'true' 
        ? formattedConversations.filter(conv => conv.unread_count > 0)
        : formattedConversations;

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
      return c.json({ error: 'Internal server error' }, 500);
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

      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .select(`
          *,
          participant1:users!participant1_id(*),
          participant2:users!participant2_id(*),
          booking:bookings(*)
        `)
        .eq('id', conversation_id)
        .single();

      if (conversationError || !conversation) {
        console.error('Conversation fetch error:', conversationError);
        return c.json({ error: 'Conversation not found' }, 404);
      }

      // Check if user is a participant
      if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Add other participant info
      const otherParticipant = conversation.participant1_id === userId 
        ? conversation.participant2 
        : conversation.participant1;

      return c.json({
        ...conversation,
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

      // Check if conversation already exists
      const { data: existingConversation, error: existingError } = await supabaseAdmin
        .from('conversations')
        .select(`
          *,
          participant1:users!participant1_id(*),
          participant2:users!participant2_id(*)
        `)
        .or(`and(participant1_id.eq.${userId},participant2_id.eq.${participant_id}),and(participant1_id.eq.${participant_id},participant2_id.eq.${userId})`)
        .single();

      if (existingConversation) {
        // Return existing conversation
        const otherParticipant = existingConversation.participant1_id === userId 
          ? existingConversation.participant2 
          : existingConversation.participant1;

        return c.json({
          ...existingConversation,
          other_participant: otherParticipant,
          is_existing: true
        });
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

      // Create new conversation
      const conversationData = {
        participant1_id: userId,
        participant2_id: participant_id,
        booking_id: booking_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: conversation, error: createError } = await supabaseAdmin
        .from('conversations')
        .insert(conversationData)
        .select(`
          *,
          participant1:users!participant1_id(*),
          participant2:users!participant2_id(*)
        `)
        .single();

      if (createError) {
        console.error('Conversation creation error:', createError);
        return c.json({ error: 'Failed to create conversation' }, 500);
      }

      // Send initial message if provided
      if (initial_message) {
        const messageData = {
          conversation_id: conversation.id,
          sender_id: userId,
          content: initial_message,
          message_type: 'text',
          created_at: new Date().toISOString()
        };

        const { data: message, error: messageError } = await supabaseAdmin
          .from('messages')
          .insert(messageData)
          .select()
          .single();

        if (!messageError) {
          // Update conversation with latest message
          await supabaseAdmin
            .from('conversations')
            .update({
              latest_message_id: message.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', conversation.id);
        }
      }

      return c.json({
        ...conversation,
        other_participant: otherUser,
        is_existing: false
      });

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
        .select('participant1_id, participant2_id')
        .eq('id', conversation_id)
        .single();

      if (conversationError || !conversation) {
        console.error('Conversation verification error:', conversationError);
        return c.json({ error: 'Conversation not found' }, 404);
      }

      if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Mark all unread messages from other participants as read
      const { data: updatedMessages, error: updateError } = await supabaseAdmin
        .from('messages')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString() 
        })
        .eq('conversation_id', conversation_id)
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
          const otherParticipantId = conversation.participant1_id === userId 
            ? conversation.participant2_id 
            : conversation.participant1_id;
          
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
      const { conversationId: conversation_id, content, message_type = 'text', metadata } = body;

      if (!conversation_id || !content) {
        return c.json({ error: 'Conversation ID and content are required' }, 400);
      }

      // Verify user has access to this conversation
      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .select('participant1_id, participant2_id')
        .eq('id', conversation_id)
        .single();

      if (conversationError || !conversation) {
        console.error('Conversation verification error:', conversationError);
        return c.json({ error: 'Conversation not found' }, 404);
      }

      if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
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
          sender:users!sender_id(id, display_name, avatar)
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
          const otherParticipantId = conversation.participant1_id === userId 
            ? conversation.participant2_id 
            : conversation.participant1_id;

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
        .select('participant1_id, participant2_id')
        .eq('id', conversation_id)
        .single();

      if (conversationError || !conversation) {
        console.error('Conversation verification error:', conversationError);
        return c.json({ error: 'Conversation not found' }, 404);
      }

      if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Build messages query
      let query = supabaseAdmin
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(id, display_name, avatar)
        `)
        .eq('conversation_id', conversation_id)
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
                is_read: true,
                read_at: new Date().toISOString() 
              })
              .in('id', unreadMessageIds);

            // Notify other participant via WebSocket
            try {
              const { getIO } = await import('../websocket.js');
              const io = getIO();
              if (io) {
                const otherParticipantId = conversation.participant1_id === userId 
                  ? conversation.participant2_id 
                  : conversation.participant1_id;
                
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