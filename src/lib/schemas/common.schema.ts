/**
 * Common Zod Schemas
 *
 * Shared schema definitions for common data types used across the API.
 */

import { z } from 'zod';

// UUID schema
export const UUIDSchema = z.string().uuid();

// ISO datetime string schema (accepts both with and without milliseconds)
export const DateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid datetime string' }
);

// Nullable string
export const NullableString = z.string().nullable();

// Nullable URL
export const NullableURL = z.string().url().nullable().or(z.literal('').transform(() => null));

// Pagination schema
export const PaginationSchema = z.object({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  has_more: z.boolean(),
});

// Generic paginated response wrapper
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
  message: z.string().optional(),
});

// Type exports
export type UUID = z.infer<typeof UUIDSchema>;
export type DateTime = z.infer<typeof DateTimeSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
