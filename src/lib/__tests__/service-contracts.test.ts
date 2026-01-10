/**
 * Service API Contract Tests
 *
 * These tests verify that mock API responses match the expected schema.
 */

import { describe, it, expect } from 'vitest';
import {
  ServiceSchema,
  ServiceWithProviderSchema,
  AvailabilityScheduleSchema,
  MeetingPlatformSchema,
} from '../schemas';

describe('Service API Contracts', () => {
  describe('MeetingPlatformSchema', () => {
    it('accepts valid meeting platforms', () => {
      expect(() => MeetingPlatformSchema.parse('google_meet')).not.toThrow();
      expect(() => MeetingPlatformSchema.parse('zoom')).not.toThrow();
      expect(() => MeetingPlatformSchema.parse('teams')).not.toThrow();
      expect(() => MeetingPlatformSchema.parse(null)).not.toThrow();
    });

    it('rejects invalid meeting platform', () => {
      expect(() => MeetingPlatformSchema.parse('skype')).toThrow();
      expect(() => MeetingPlatformSchema.parse('hangouts')).toThrow();
    });
  });

  describe('AvailabilityScheduleSchema', () => {
    it('validates a complete weekly schedule', () => {
      const schedule = {
        monday: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
        tuesday: [{ start: '09:00', end: '17:00' }],
        wednesday: [{ start: '10:00', end: '16:00' }],
        thursday: [],
        friday: [{ start: '09:00', end: '12:00' }],
      };

      expect(() => AvailabilityScheduleSchema.parse(schedule)).not.toThrow();
    });

    it('validates empty schedule', () => {
      expect(() => AvailabilityScheduleSchema.parse({})).not.toThrow();
      expect(() => AvailabilityScheduleSchema.parse(null)).not.toThrow();
    });

    it('rejects invalid time format', () => {
      const invalidSchedule = {
        monday: [{ start: '9:00', end: '12:00' }], // missing leading zero
      };

      expect(() => AvailabilityScheduleSchema.parse(invalidSchedule)).toThrow();
    });

    it('rejects invalid day names', () => {
      const invalidSchedule = {
        lundi: [{ start: '09:00', end: '12:00' }], // French day name
      };

      expect(() => AvailabilityScheduleSchema.parse(invalidSchedule)).toThrow();
    });
  });

  describe('ServiceSchema', () => {
    const validService = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      provider_id: '123e4567-e89b-12d3-a456-426614174001',
      category_id: '123e4567-e89b-12d3-a456-426614174002',
      title: 'Test Service',
      description: 'A great service for testing',
      price: 50,
      duration_minutes: 60,
      is_online: true,
      location: null,
      is_visible: true,
      created_at: '2024-01-01T00:00:00Z',
    };

    it('validates a minimal valid service', () => {
      expect(() => ServiceSchema.parse(validService)).not.toThrow();
    });

    it('validates service with all optional fields', () => {
      const fullService = {
        ...validService,
        short_description: 'Short desc',
        meeting_platform: 'google_meet',
        availability_schedule: {
          monday: [{ start: '09:00', end: '17:00' }],
        },
        max_bookings_per_day: 5,
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        tags: ['consulting', 'business'],
        is_active: true,
        rating: 4.5,
        review_count: 10,
        total_bookings: 50,
        updated_at: '2024-01-10T00:00:00Z',
      };

      expect(() => ServiceSchema.parse(fullService)).not.toThrow();
    });

    it('validates service with null category', () => {
      const serviceWithNullCategory = {
        ...validService,
        category_id: null,
      };

      expect(() => ServiceSchema.parse(serviceWithNullCategory)).not.toThrow();
    });

    it('validates offline service with location', () => {
      const offlineService = {
        ...validService,
        is_online: false,
        location: '123 Main St, City, Country',
      };

      expect(() => ServiceSchema.parse(offlineService)).not.toThrow();
    });

    it('rejects service with empty title', () => {
      const invalidService = { ...validService, title: '' };
      expect(() => ServiceSchema.parse(invalidService)).toThrow();
    });

    it('rejects service with negative price', () => {
      const invalidService = { ...validService, price: -10 };
      expect(() => ServiceSchema.parse(invalidService)).toThrow();
    });

    it('rejects service with zero duration', () => {
      const invalidService = { ...validService, duration_minutes: 0 };
      expect(() => ServiceSchema.parse(invalidService)).toThrow();
    });

    it('rejects service with invalid rating', () => {
      const invalidService = { ...validService, rating: 6 };
      expect(() => ServiceSchema.parse(invalidService)).toThrow();
    });
  });

  describe('ServiceWithProviderSchema', () => {
    it('validates service with provider relation', () => {
      const serviceWithProvider = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        provider_id: '123e4567-e89b-12d3-a456-426614174001',
        category_id: null,
        title: 'Test Service',
        description: 'A test service',
        price: 100,
        duration_minutes: 60,
        is_online: true,
        location: null,
        is_visible: true,
        created_at: '2024-01-01T00:00:00Z',
        provider: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          display_name: 'Test Provider',
          avatar: 'https://example.com/avatar.jpg',
        },
      };

      expect(() => ServiceWithProviderSchema.parse(serviceWithProvider)).not.toThrow();
    });

    it('validates service without provider (optional)', () => {
      const serviceWithoutProvider = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        provider_id: '123e4567-e89b-12d3-a456-426614174001',
        category_id: null,
        title: 'Test Service',
        description: null,
        price: 100,
        duration_minutes: 60,
        is_online: true,
        location: null,
        is_visible: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(() => ServiceWithProviderSchema.parse(serviceWithoutProvider)).not.toThrow();
    });
  });
});
