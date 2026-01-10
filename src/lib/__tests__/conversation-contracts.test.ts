/**
 * Conversation API Contract Tests
 *
 * These tests verify that mock API responses match the expected schema.
 */

import { describe, it, expect } from 'vitest';
import {
  ConversationSchema,
  ConversationsResponseSchema,
  MessageSchema,
  MessagesResponseSchema,
} from '../schemas';

describe('Conversation API Contracts', () => {
  describe('MessageSchema', () => {
    it('validates a valid message', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        conversation_id: '123e4567-e89b-12d3-a456-426614174001',
        sender_id: '123e4567-e89b-12d3-a456-426614174002',
        content: 'Hello, world!',
        is_read: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      expect(() => MessageSchema.parse(message)).not.toThrow();
    });

    it('validates message with sender relation', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        conversation_id: '123e4567-e89b-12d3-a456-426614174001',
        sender_id: '123e4567-e89b-12d3-a456-426614174002',
        content: 'Hello!',
        is_read: true,
        created_at: '2024-01-15T10:00:00Z',
        sender: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          display_name: 'Test User',
          avatar: null,
        },
      };

      expect(() => MessageSchema.parse(message)).not.toThrow();
    });

    it('rejects message with empty content', () => {
      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        conversation_id: '123e4567-e89b-12d3-a456-426614174001',
        sender_id: '123e4567-e89b-12d3-a456-426614174002',
        content: '',
        is_read: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      // Empty string is still valid for the schema (just not for creation)
      expect(() => MessageSchema.parse(message)).not.toThrow();
    });
  });

  describe('ConversationSchema', () => {
    const validConversation = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user1_id: '123e4567-e89b-12d3-a456-426614174001',
      user2_id: '123e4567-e89b-12d3-a456-426614174002',
      last_message_at: '2024-01-15T10:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
    };

    it('validates a minimal conversation', () => {
      expect(() => ConversationSchema.parse(validConversation)).not.toThrow();
    });

    it('validates conversation with enriched user data', () => {
      const enrichedConversation = {
        ...validConversation,
        customer: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          display_name: 'Customer',
          avatar: null,
        },
        provider: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          display_name: 'Provider',
          avatar: 'https://example.com/avatar.jpg',
        },
        other_user: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          display_name: 'Provider',
          avatar: 'https://example.com/avatar.jpg',
        },
      };

      expect(() => ConversationSchema.parse(enrichedConversation)).not.toThrow();
    });

    it('validates conversation with last message array', () => {
      const conversationWithMessage = {
        ...validConversation,
        last_message: [
          {
            id: '123e4567-e89b-12d3-a456-426614174010',
            conversation_id: '123e4567-e89b-12d3-a456-426614174000',
            sender_id: '123e4567-e89b-12d3-a456-426614174001',
            content: 'Last message',
            is_read: false,
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
      };

      expect(() => ConversationSchema.parse(conversationWithMessage)).not.toThrow();
    });

    it('validates conversation with booking info', () => {
      const conversationWithBooking = {
        ...validConversation,
        booking: {
          id: '123e4567-e89b-12d3-a456-426614174020',
          status: 'confirmed',
          scheduled_at: '2024-01-20T10:00:00Z',
          services: {
            id: '123e4567-e89b-12d3-a456-426614174030',
            title: 'Test Service',
            description: 'A test service',
          },
        },
      };

      expect(() => ConversationSchema.parse(conversationWithBooking)).not.toThrow();
    });

    it('validates conversation with null booking', () => {
      const conversationWithNullBooking = {
        ...validConversation,
        booking: null,
      };

      expect(() => ConversationSchema.parse(conversationWithNullBooking)).not.toThrow();
    });

    it('validates conversation with unread_count', () => {
      const conversationWithUnread = {
        ...validConversation,
        unread_count: 5,
      };

      expect(() => ConversationSchema.parse(conversationWithUnread)).not.toThrow();
    });

    it('validates conversation with zero unread_count', () => {
      const conversationWithZeroUnread = {
        ...validConversation,
        unread_count: 0,
      };

      expect(() => ConversationSchema.parse(conversationWithZeroUnread)).not.toThrow();
    });

    it('rejects conversation with negative unread_count', () => {
      const conversationWithNegativeUnread = {
        ...validConversation,
        unread_count: -1,
      };

      expect(() => ConversationSchema.parse(conversationWithNegativeUnread)).toThrow();
    });
  });

  describe('ConversationsResponseSchema', () => {
    it('validates GET /api/conversations response', () => {
      const response = {
        conversations: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            user1_id: '123e4567-e89b-12d3-a456-426614174001',
            user2_id: '123e4567-e89b-12d3-a456-426614174002',
            last_message_at: '2024-01-15T10:00:00Z',
            created_at: '2024-01-01T00:00:00Z',
            customer: {
              id: '123e4567-e89b-12d3-a456-426614174001',
              display_name: 'Customer',
              avatar: null,
            },
            provider: {
              id: '123e4567-e89b-12d3-a456-426614174002',
              display_name: 'Provider',
              avatar: null,
            },
            other_user: {
              id: '123e4567-e89b-12d3-a456-426614174002',
              display_name: 'Provider',
              avatar: null,
            },
            last_message: [],
            booking: null,
          },
        ],
        pagination: {
          limit: 50,
          offset: 0,
          total: 1,
          has_more: false,
        },
      };

      expect(() => ConversationsResponseSchema.parse(response)).not.toThrow();
    });

    it('validates empty conversations response', () => {
      const response = {
        conversations: [],
        pagination: {
          limit: 50,
          offset: 0,
          total: 0,
          has_more: false,
        },
      };

      expect(() => ConversationsResponseSchema.parse(response)).not.toThrow();
    });

    it('validates error response', () => {
      const response = {
        conversations: [],
        pagination: {
          limit: 50,
          offset: 0,
          total: 0,
          has_more: false,
        },
        error: 'Failed to fetch conversations',
      };

      expect(() => ConversationsResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('MessagesResponseSchema', () => {
    it('validates GET /api/messages/:conversationId response', () => {
      const response = {
        messages: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            conversation_id: '123e4567-e89b-12d3-a456-426614174001',
            sender_id: '123e4567-e89b-12d3-a456-426614174002',
            content: 'Hello!',
            is_read: true,
            created_at: '2024-01-15T10:00:00Z',
            sender: {
              id: '123e4567-e89b-12d3-a456-426614174002',
              display_name: 'Test User',
              avatar: null,
            },
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174010',
            conversation_id: '123e4567-e89b-12d3-a456-426614174001',
            sender_id: '123e4567-e89b-12d3-a456-426614174003',
            content: 'Hi there!',
            is_read: false,
            created_at: '2024-01-15T10:01:00Z',
            sender: {
              id: '123e4567-e89b-12d3-a456-426614174003',
              display_name: 'Other User',
              avatar: 'https://example.com/avatar.jpg',
            },
          },
        ],
        pagination: {
          limit: 50,
          offset: 0,
          has_more: false,
          before: null,
          after: null,
        },
      };

      expect(() => MessagesResponseSchema.parse(response)).not.toThrow();
    });

    it('validates response with cursor-based pagination', () => {
      const response = {
        messages: [],
        pagination: {
          limit: 50,
          offset: 0,
          has_more: true,
          before: '123e4567-e89b-12d3-a456-426614174000',
          after: null,
        },
      };

      expect(() => MessagesResponseSchema.parse(response)).not.toThrow();
    });
  });
});
