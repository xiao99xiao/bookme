/**
 * Booking Zod Schemas
 *
 * Schema definitions for booking-related API responses.
 * Includes blockchain authorization payloads.
 */

import { z } from 'zod';
import { UUIDSchema, DateTimeSchema, NullableString } from './common.schema';
import { UserMinimalSchema } from './user.schema';
import { ServiceSchema } from './service.schema';

// Booking status enum - matches ALL backend statuses
export const BookingStatusSchema = z.enum([
  'pending',
  'pending_payment',
  'paid',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
  'refunded',
  'failed',
]);

// Review schema (nested in booking)
export const ReviewMinimalSchema = z.object({
  id: UUIDSchema,
  rating: z.number().min(1).max(5),
  comment: NullableString,
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema.optional(),
  reviewer: UserMinimalSchema.optional(),
  reviewee: UserMinimalSchema.optional(),
});

// Base booking schema (database row)
export const BookingBaseSchema = z.object({
  id: UUIDSchema,
  service_id: UUIDSchema,
  customer_id: UUIDSchema,
  provider_id: UUIDSchema,

  // Scheduling
  scheduled_at: DateTimeSchema,
  duration_minutes: z.number().int().positive(),

  // Pricing
  total_price: z.number().nonnegative(),
  service_fee: z.number().nonnegative(),

  // Status
  status: BookingStatusSchema,

  // Notes
  customer_notes: NullableString,
  provider_notes: NullableString.optional(),

  // Location
  location: NullableString,
  is_online: z.boolean(),

  // Meeting
  meeting_link: NullableString,
  meeting_id: NullableString.optional(),
  meeting_platform: z.string().nullable().optional(),

  // Blockchain
  blockchain_booking_id: NullableString.optional(),
  blockchain_tx_hash: NullableString.optional(),
  blockchain_confirmed_at: DateTimeSchema.nullable().optional(),

  // Cancellation
  cancellation_reason: NullableString.optional(),
  cancelled_by: UUIDSchema.nullable().optional(),
  cancelled_at: DateTimeSchema.nullable().optional(),
  rejection_reason: NullableString.optional(),
  rejected_at: DateTimeSchema.nullable().optional(),

  // Completion
  completed_at: DateTimeSchema.nullable().optional(),
  completion_notes: NullableString.optional(),
  backend_completed: z.boolean().optional(),
  auto_complete_blocked: z.boolean().optional(),
  auto_complete_blocked_reason: NullableString.optional(),

  // Timestamps
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema.optional(),
});

// Booking with relations (API response)
export const BookingWithRelationsSchema = BookingBaseSchema.extend({
  service: ServiceSchema.optional(),
  customer: UserMinimalSchema.optional(),
  provider: UserMinimalSchema.optional(),
  reviews: z.array(ReviewMinimalSchema).optional(),
});

// EIP-712 Authorization schema
export const EIP712AuthorizationSchema = z.object({
  bookingId: z.string(),
  customer: z.string(),
  provider: z.string(),
  inviter: z.string(),
  amount: z.string(),
  platformFeeRate: z.number(),
  inviterFeeRate: z.number(),
  expiry: z.number(),
  nonce: z.string(),
});

// Fee breakdown schema
export const FeeBreakdownSchema = z.object({
  platformFeeRate: z.number(),
  inviterFeeRate: z.number(),
  platformAmount: z.number(),
  inviterAmount: z.number(),
  providerAmount: z.number(),
});

// POST /api/bookings response
export const CreateBookingResponseSchema = z.object({
  booking: BookingWithRelationsSchema,
  authorization: EIP712AuthorizationSchema.optional(),
  signature: z.string().optional(),
  contractAddress: z.string().optional(),
  usdcAddress: z.string().optional(),
  feeBreakdown: FeeBreakdownSchema.optional(),
  expiresAt: DateTimeSchema.optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// POST /api/bookings/:id/authorize-payment response
export const PaymentAuthorizationResponseSchema = z.object({
  authorization: EIP712AuthorizationSchema,
  signature: z.string(),
  contractAddress: z.string(),
  usdcAddress: z.string(),
  feeBreakdown: FeeBreakdownSchema,
  expiresAt: DateTimeSchema,
});

// Booking creation request
export const BookingCreateSchema = z.object({
  service_id: UUIDSchema,
  scheduled_at: DateTimeSchema,
  customer_notes: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  location: z.string().optional(),
  is_online: z.boolean().optional(),
});

// Type exports
export type BookingStatus = z.infer<typeof BookingStatusSchema>;
export type ReviewMinimal = z.infer<typeof ReviewMinimalSchema>;
export type BookingBase = z.infer<typeof BookingBaseSchema>;
export type BookingWithRelations = z.infer<typeof BookingWithRelationsSchema>;
export type EIP712Authorization = z.infer<typeof EIP712AuthorizationSchema>;
export type FeeBreakdown = z.infer<typeof FeeBreakdownSchema>;
export type CreateBookingResponse = z.infer<typeof CreateBookingResponseSchema>;
export type PaymentAuthorizationResponse = z.infer<typeof PaymentAuthorizationResponseSchema>;
export type BookingCreate = z.infer<typeof BookingCreateSchema>;
