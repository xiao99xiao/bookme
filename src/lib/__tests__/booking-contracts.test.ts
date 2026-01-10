/**
 * Booking API Contract Tests
 *
 * These tests verify that mock API responses match the expected schema.
 * If the backend changes its response format, these tests will fail,
 * alerting developers before the changes break the frontend.
 */

import { describe, it, expect } from 'vitest';
import {
  BookingStatusSchema,
  BookingBaseSchema,
  BookingWithRelationsSchema,
  CreateBookingResponseSchema,
  PaymentAuthorizationResponseSchema,
  EIP712AuthorizationSchema,
} from '../schemas';

describe('Booking API Contracts', () => {
  describe('BookingStatusSchema', () => {
    it('accepts all valid booking statuses', () => {
      const validStatuses = [
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
      ];

      validStatuses.forEach((status) => {
        expect(() => BookingStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('rejects invalid booking status', () => {
      expect(() => BookingStatusSchema.parse('invalid_status')).toThrow();
      expect(() => BookingStatusSchema.parse('PENDING')).toThrow(); // case sensitive
      expect(() => BookingStatusSchema.parse('')).toThrow();
    });
  });

  describe('BookingBaseSchema', () => {
    const validBooking = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      service_id: '123e4567-e89b-12d3-a456-426614174001',
      customer_id: '123e4567-e89b-12d3-a456-426614174002',
      provider_id: '123e4567-e89b-12d3-a456-426614174003',
      scheduled_at: '2024-01-15T10:00:00Z',
      duration_minutes: 60,
      total_price: 100,
      service_fee: 10,
      status: 'confirmed',
      customer_notes: null,
      location: null,
      is_online: true,
      meeting_link: null,
      created_at: '2024-01-10T10:00:00Z',
    };

    it('validates a minimal valid booking', () => {
      expect(() => BookingBaseSchema.parse(validBooking)).not.toThrow();
    });

    it('validates a booking with all optional fields', () => {
      const fullBooking = {
        ...validBooking,
        provider_notes: 'Some notes',
        meeting_id: 'meet-123',
        meeting_platform: 'google_meet',
        blockchain_booking_id: '0x123abc',
        blockchain_tx_hash: '0x456def',
        blockchain_confirmed_at: '2024-01-10T10:05:00Z',
        cancellation_reason: null,
        cancelled_by: null,
        cancelled_at: null,
        completed_at: null,
        updated_at: '2024-01-10T10:00:00Z',
      };

      expect(() => BookingBaseSchema.parse(fullBooking)).not.toThrow();
    });

    it('rejects booking with missing required fields', () => {
      const { id, ...bookingWithoutId } = validBooking;
      expect(() => BookingBaseSchema.parse(bookingWithoutId)).toThrow();
    });

    it('rejects booking with invalid UUID', () => {
      const invalidBooking = { ...validBooking, id: 'not-a-uuid' };
      expect(() => BookingBaseSchema.parse(invalidBooking)).toThrow();
    });

    it('rejects booking with negative price', () => {
      const invalidBooking = { ...validBooking, total_price: -100 };
      expect(() => BookingBaseSchema.parse(invalidBooking)).toThrow();
    });

    it('rejects booking with invalid duration', () => {
      const invalidBooking = { ...validBooking, duration_minutes: 0 };
      expect(() => BookingBaseSchema.parse(invalidBooking)).toThrow();
    });
  });

  describe('BookingWithRelationsSchema', () => {
    const bookingWithRelations = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      service_id: '123e4567-e89b-12d3-a456-426614174001',
      customer_id: '123e4567-e89b-12d3-a456-426614174002',
      provider_id: '123e4567-e89b-12d3-a456-426614174003',
      scheduled_at: '2024-01-15T10:00:00Z',
      duration_minutes: 60,
      total_price: 100,
      service_fee: 10,
      status: 'confirmed',
      customer_notes: null,
      location: null,
      is_online: true,
      meeting_link: null,
      created_at: '2024-01-10T10:00:00Z',
      service: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        provider_id: '123e4567-e89b-12d3-a456-426614174003',
        category_id: null,
        title: 'Test Service',
        description: 'A test service',
        price: 100,
        duration_minutes: 60,
        is_online: true,
        location: null,
        is_visible: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      customer: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        display_name: 'Test Customer',
        avatar: null,
      },
      provider: {
        id: '123e4567-e89b-12d3-a456-426614174003',
        display_name: 'Test Provider',
        avatar: 'https://example.com/avatar.jpg',
      },
      reviews: [
        {
          id: '123e4567-e89b-12d3-a456-426614174010',
          rating: 5,
          comment: 'Great service!',
          created_at: '2024-01-16T10:00:00Z',
        },
      ],
    };

    it('validates booking with nested relations', () => {
      expect(() => BookingWithRelationsSchema.parse(bookingWithRelations)).not.toThrow();
    });

    it('validates booking without optional relations', () => {
      const { service, customer, provider, reviews, ...bookingOnly } = bookingWithRelations;
      expect(() => BookingWithRelationsSchema.parse(bookingOnly)).not.toThrow();
    });
  });

  describe('CreateBookingResponseSchema', () => {
    it('validates successful booking creation with blockchain authorization', () => {
      const response = {
        booking: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          service_id: '123e4567-e89b-12d3-a456-426614174001',
          customer_id: '123e4567-e89b-12d3-a456-426614174002',
          provider_id: '123e4567-e89b-12d3-a456-426614174003',
          scheduled_at: '2024-01-15T10:00:00Z',
          duration_minutes: 60,
          total_price: 100,
          service_fee: 10,
          status: 'pending_payment',
          customer_notes: null,
          location: null,
          is_online: true,
          meeting_link: null,
          blockchain_booking_id: '0x123abc',
          created_at: '2024-01-10T10:00:00Z',
        },
        authorization: {
          bookingId: '0x123abc',
          customer: '0x1234567890abcdef1234567890abcdef12345678',
          provider: '0xabcdef1234567890abcdef1234567890abcdef12',
          inviter: '0x0000000000000000000000000000000000000000',
          amount: '100000000',
          platformFeeRate: 800,
          inviterFeeRate: 0,
          expiry: 1704970000,
          nonce: '123',
        },
        signature: '0xabcdef...',
        contractAddress: '0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a',
        usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        feeBreakdown: {
          platformFeeRate: 800,
          inviterFeeRate: 0,
          platformAmount: 8,
          inviterAmount: 0,
          providerAmount: 92,
        },
        expiresAt: '2024-01-10T10:05:00Z',
      };

      expect(() => CreateBookingResponseSchema.parse(response)).not.toThrow();
    });

    it('validates booking creation without blockchain (wallet not configured)', () => {
      const response = {
        booking: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          service_id: '123e4567-e89b-12d3-a456-426614174001',
          customer_id: '123e4567-e89b-12d3-a456-426614174002',
          provider_id: '123e4567-e89b-12d3-a456-426614174003',
          scheduled_at: '2024-01-15T10:00:00Z',
          duration_minutes: 60,
          total_price: 100,
          service_fee: 10,
          status: 'pending',
          customer_notes: null,
          location: null,
          is_online: true,
          meeting_link: null,
          created_at: '2024-01-10T10:00:00Z',
        },
        error: 'Wallet addresses not configured',
        message: 'Please ensure both customer and provider have wallet addresses configured',
      };

      expect(() => CreateBookingResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('EIP712AuthorizationSchema', () => {
    it('validates a valid authorization', () => {
      const authorization = {
        bookingId: '0x123abc',
        customer: '0x1234567890abcdef1234567890abcdef12345678',
        provider: '0xabcdef1234567890abcdef1234567890abcdef12',
        inviter: '0x0000000000000000000000000000000000000000',
        amount: '100000000',
        platformFeeRate: 800,
        inviterFeeRate: 200,
        expiry: 1704970000,
        nonce: '123',
      };

      expect(() => EIP712AuthorizationSchema.parse(authorization)).not.toThrow();
    });

    it('rejects authorization with missing fields', () => {
      const invalidAuth = {
        bookingId: '0x123abc',
        customer: '0x1234567890abcdef1234567890abcdef12345678',
        // missing other fields
      };

      expect(() => EIP712AuthorizationSchema.parse(invalidAuth)).toThrow();
    });
  });
});
