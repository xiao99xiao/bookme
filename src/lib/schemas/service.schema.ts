/**
 * Service Zod Schemas
 *
 * Schema definitions for service-related API responses.
 */

import { z } from 'zod';
import { UUIDSchema, DateTimeSchema, NullableString } from './common.schema';
import { UserMinimalSchema } from './user.schema';

// Meeting platform enum
export const MeetingPlatformSchema = z.enum(['google_meet', 'zoom', 'teams']).nullable();

// Availability schedule schema (JSONB in database)
export const AvailabilityScheduleSchema = z.record(
  z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  z.array(
    z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
  )
).nullable();

// Base service schema
export const ServiceSchema = z.object({
  id: UUIDSchema,
  provider_id: UUIDSchema,
  category_id: UUIDSchema.nullable(),

  // Basic info
  title: z.string().min(1),
  description: NullableString,
  short_description: NullableString.optional(),
  price: z.number().nonnegative(),
  duration_minutes: z.number().int().positive(),

  // Location
  is_online: z.boolean().default(true),
  location: NullableString,
  meeting_platform: MeetingPlatformSchema.optional(),

  // Availability
  availability_schedule: AvailabilityScheduleSchema.optional(),
  max_bookings_per_day: z.number().int().positive().nullable().optional(),

  // Media
  images: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),

  // Visibility
  is_visible: z.boolean().default(true),
  is_active: z.boolean().default(true).optional(),

  // Metrics
  rating: z.number().min(0).max(5).nullable().optional(),
  review_count: z.number().int().nonnegative().default(0).optional(),
  total_bookings: z.number().int().nonnegative().default(0).optional(),

  // Timestamps
  created_at: DateTimeSchema,
  updated_at: DateTimeSchema.optional(),
});

// Service with provider relation
export const ServiceWithProviderSchema = ServiceSchema.extend({
  provider: UserMinimalSchema.optional(),
});

// Service creation request schema
export const ServiceCreateSchema = ServiceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  rating: true,
  review_count: true,
  total_bookings: true,
});

// Type exports
export type MeetingPlatform = z.infer<typeof MeetingPlatformSchema>;
export type AvailabilitySchedule = z.infer<typeof AvailabilityScheduleSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type ServiceWithProvider = z.infer<typeof ServiceWithProviderSchema>;
export type ServiceCreate = z.infer<typeof ServiceCreateSchema>;
