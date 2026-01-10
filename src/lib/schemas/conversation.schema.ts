/**
 * Conversation & Message Zod Schemas
 *
 * Schema definitions for messaging-related API responses.
 */

import { z } from 'zod';
import { UUIDSchema, DateTimeSchema, NullableString, PaginationSchema } from './common.schema';
import { UserMinimalSchema } from './user.schema';
import { ServiceSchema } from './service.schema';

// Message schema
export const MessageSchema = z.object({
  id: UUIDSchema,
  conversation_id: UUIDSchema,
  sender_id: UUIDSchema,
  content: z.string(),
  is_read: z.boolean().default(false),
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema.optional(),

  // Relations
  sender: UserMinimalSchema.optional(),
});

// Booking info in conversation (minimal)
export const ConversationBookingSchema = z.object({
  id: UUIDSchema,
  status: z.string(),
  scheduled_at: DateTimeSchema,
  customer_id: UUIDSchema.optional(),
  provider_id: UUIDSchema.optional(),
  services: z.object({
    id: UUIDSchema,
    title: z.string(),
    description: NullableString,
  }).optional(),
}).nullable();

// Conversation schema
export const ConversationSchema = z.object({
  id: UUIDSchema,
  user1_id: UUIDSchema,
  user2_id: UUIDSchema,
  last_message_at: DateTimeSchema.nullable(),
  latest_message_id: UUIDSchema.nullable().optional(),
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema.optional(),

  // Enriched relations
  customer: UserMinimalSchema.nullable().optional(),
  provider: UserMinimalSchema.nullable().optional(),
  other_user: UserMinimalSchema.nullable().optional(),
  last_message: z.array(MessageSchema).optional(),
  booking: ConversationBookingSchema.optional(),

  // Unread message count for current user
  unread_count: z.number().int().nonnegative().optional(),
});

// GET /api/conversations response
export const ConversationsResponseSchema = z.object({
  conversations: z.array(ConversationSchema),
  pagination: PaginationSchema,
  error: z.string().optional(),
});

// GET /api/messages/:conversationId response
export const MessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
  pagination: z.object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    has_more: z.boolean(),
    before: NullableString,
    after: NullableString,
  }),
});

// POST /api/messages request
export const MessageCreateSchema = z.object({
  conversation_id: UUIDSchema,
  content: z.string().min(1),
});

// PUT /api/conversations/:id/read response
export const MarkReadResponseSchema = z.object({
  success: z.boolean(),
  messages_marked_read: z.number().int().nonnegative(),
});

// Type exports
export type Message = z.infer<typeof MessageSchema>;
export type ConversationBooking = z.infer<typeof ConversationBookingSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationsResponse = z.infer<typeof ConversationsResponseSchema>;
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;
export type MessageCreate = z.infer<typeof MessageCreateSchema>;
export type MarkReadResponse = z.infer<typeof MarkReadResponseSchema>;
