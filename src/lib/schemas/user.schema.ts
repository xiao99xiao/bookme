/**
 * User Zod Schemas
 *
 * Schema definitions for user-related API responses.
 */

import { z } from 'zod';
import { UUIDSchema, DateTimeSchema, NullableString, NullableURL } from './common.schema';

// Minimal user schema (used in nested relations)
export const UserMinimalSchema = z.object({
  id: UUIDSchema,
  display_name: NullableString,
  avatar: NullableString,
});

// Full user schema (for profile endpoints)
export const UserSchema = z.object({
  id: UUIDSchema,
  email: z.string().email().nullable(),
  display_name: NullableString,
  username: NullableString,
  bio: NullableString,
  avatar: NullableString,
  phone: NullableString.optional(),
  timezone: z.string().default('UTC'),
  wallet_address: NullableString.optional(),

  // Verification flags
  is_verified: z.boolean().default(false),
  is_provider: z.boolean().default(false),
  provider_verified_at: DateTimeSchema.nullable().optional(),
  onboarding_completed: z.boolean().default(false),

  // Metrics
  rating: z.number().min(0).max(5).default(0),
  review_count: z.number().int().nonnegative().default(0),
  total_earnings: z.number().nonnegative().default(0),
  total_spent: z.number().nonnegative().default(0),

  // Referral
  referral_code: NullableString.optional(),
  referred_by: UUIDSchema.nullable().optional(),
  referral_earnings: z.number().nonnegative().default(0).optional(),

  // Timestamps
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema.optional(),
  last_sign_in_at: DateTimeSchema.nullable().optional(),
});

// User profile update request schema
export const UserUpdateSchema = UserSchema.partial().omit({
  id: true,
  created_at: true,
  email: true,
});

// Type exports
export type UserMinimal = z.infer<typeof UserMinimalSchema>;
export type User = z.infer<typeof UserSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
