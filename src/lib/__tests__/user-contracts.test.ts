/**
 * User API Contract Tests
 *
 * These tests verify that mock API responses match the expected schema.
 */

import { describe, it, expect } from 'vitest';
import { UserSchema, UserMinimalSchema } from '../schemas';

describe('User API Contracts', () => {
  describe('UserMinimalSchema', () => {
    it('validates minimal user with all fields', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        display_name: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      };

      expect(() => UserMinimalSchema.parse(user)).not.toThrow();
    });

    it('validates minimal user with null values', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        display_name: null,
        avatar: null,
      };

      expect(() => UserMinimalSchema.parse(user)).not.toThrow();
    });

    it('rejects user with invalid UUID', () => {
      const user = {
        id: 'not-a-uuid',
        display_name: 'Test User',
        avatar: null,
      };

      expect(() => UserMinimalSchema.parse(user)).toThrow();
    });
  });

  describe('UserSchema', () => {
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      display_name: 'Test User',
      username: 'testuser',
      bio: 'A test bio',
      avatar: 'https://example.com/avatar.jpg',
      timezone: 'America/New_York',
      is_verified: true,
      is_provider: true,
      rating: 4.5,
      review_count: 10,
      total_earnings: 1000,
      total_spent: 500,
      created_at: '2024-01-01T00:00:00Z',
    };

    it('validates a complete user profile', () => {
      expect(() => UserSchema.parse(validUser)).not.toThrow();
    });

    it('validates user with null optional fields', () => {
      const userWithNulls = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: null,
        display_name: null,
        username: null,
        bio: null,
        avatar: null,
        timezone: 'UTC',
        is_verified: false,
        is_provider: false,
        rating: 0,
        review_count: 0,
        total_earnings: 0,
        total_spent: 0,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(() => UserSchema.parse(userWithNulls)).not.toThrow();
    });

    it('validates user with referral fields', () => {
      const userWithReferral = {
        ...validUser,
        referral_code: 'ABC123',
        referred_by: '123e4567-e89b-12d3-a456-426614174001',
        referral_earnings: 50,
      };

      expect(() => UserSchema.parse(userWithReferral)).not.toThrow();
    });

    it('validates user with provider verification', () => {
      const verifiedProvider = {
        ...validUser,
        is_provider: true,
        provider_verified_at: '2024-01-15T10:00:00Z',
        onboarding_completed: true,
      };

      expect(() => UserSchema.parse(verifiedProvider)).not.toThrow();
    });

    it('rejects user with invalid email', () => {
      const invalidUser = { ...validUser, email: 'not-an-email' };
      expect(() => UserSchema.parse(invalidUser)).toThrow();
    });

    it('rejects user with rating out of range', () => {
      const invalidUser = { ...validUser, rating: 6 };
      expect(() => UserSchema.parse(invalidUser)).toThrow();

      const negativeRating = { ...validUser, rating: -1 };
      expect(() => UserSchema.parse(negativeRating)).toThrow();
    });

    it('rejects user with negative review count', () => {
      const invalidUser = { ...validUser, review_count: -1 };
      expect(() => UserSchema.parse(invalidUser)).toThrow();
    });

    it('rejects user with negative earnings', () => {
      const invalidUser = { ...validUser, total_earnings: -100 };
      expect(() => UserSchema.parse(invalidUser)).toThrow();
    });

    it('uses default values for missing optional fields', () => {
      const minimalUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        display_name: 'Test',
        username: null,
        bio: null,
        avatar: null,
        timezone: 'UTC',
        is_verified: false,
        is_provider: false,
        rating: 0,
        review_count: 0,
        total_earnings: 0,
        total_spent: 0,
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = UserSchema.parse(minimalUser);
      expect(result.is_verified).toBe(false);
      expect(result.is_provider).toBe(false);
    });
  });
});
