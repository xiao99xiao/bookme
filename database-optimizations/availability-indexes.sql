-- Smart Booking Availability System - Performance Indexes
-- This file creates optimized database indexes for fast availability calculations

-- =============================================================================
-- BOOKINGS TABLE INDEXES
-- =============================================================================

-- Index for provider availability queries (most critical)
-- Covers: provider_id, scheduled_at, status filtering
CREATE INDEX IF NOT EXISTS idx_bookings_provider_availability 
ON bookings (provider_id, scheduled_at, status) 
WHERE status IN ('confirmed', 'in_progress', 'pending', 'paid', 'pending_payment');

-- Index for date range queries during availability calculation
-- Covers: scheduled_at range queries with status filtering
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_status 
ON bookings (scheduled_at, status, duration_minutes, provider_id) 
WHERE status IN ('confirmed', 'in_progress', 'pending', 'paid', 'pending_payment');

-- =============================================================================
-- SERVICES TABLE INDEXES  
-- =============================================================================

-- Index for service lookup with availability schedule
-- Covers: id, provider_id, availability_schedule access
CREATE INDEX IF NOT EXISTS idx_services_availability_lookup 
ON services (id, provider_id, duration_minutes) 
WHERE is_visible = true AND availability_schedule IS NOT NULL;

-- Index for provider's services lookup
-- Covers: provider_id filtering with visibility
CREATE INDEX IF NOT EXISTS idx_services_provider_visible 
ON services (provider_id, is_visible, duration_minutes) 
WHERE is_visible = true;

-- =============================================================================
-- USER_MEETING_INTEGRATIONS TABLE INDEXES
-- =============================================================================

-- Index for active calendar integrations lookup
-- Covers: user_id, platform, is_active filtering
CREATE INDEX IF NOT EXISTS idx_user_meeting_integrations_active 
ON user_meeting_integrations (user_id, platform, is_active, expires_at) 
WHERE is_active = true;

-- Index for integration token refresh queries
CREATE INDEX IF NOT EXISTS idx_user_meeting_integrations_refresh 
ON user_meeting_integrations (user_id, expires_at, refresh_token) 
WHERE is_active = true AND expires_at IS NOT NULL;

-- =============================================================================
-- PERFORMANCE ANALYSIS QUERIES
-- =============================================================================

-- Query to check if indexes exist and are being used
-- Run this after creating indexes to verify performance improvement

/*
-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%availability%' 
OR indexname LIKE 'idx_%booking%'
ORDER BY idx_tup_read DESC;

-- Check query performance for availability calculation
EXPLAIN (ANALYZE, BUFFERS) 
SELECT scheduled_at, duration_minutes 
FROM bookings 
WHERE provider_id = 'sample-uuid'
AND scheduled_at >= '2024-01-15 00:00:00+00'
AND scheduled_at < '2024-01-16 00:00:00+00'
AND status IN ('confirmed', 'in_progress', 'pending', 'paid');

-- Check service lookup performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, provider_id, duration_minutes, availability_schedule 
FROM services 
WHERE id = 'sample-service-uuid' 
AND is_visible = true;
*/

-- =============================================================================
-- INDEX MAINTENANCE
-- =============================================================================

-- Commands to drop indexes if needed (for development/testing)
/*
DROP INDEX IF EXISTS idx_bookings_provider_availability;
DROP INDEX IF EXISTS idx_bookings_scheduled_status;
DROP INDEX IF EXISTS idx_services_availability_lookup;
DROP INDEX IF EXISTS idx_services_provider_visible;
DROP INDEX IF EXISTS idx_user_meeting_integrations_active;
DROP INDEX IF EXISTS idx_user_meeting_integrations_refresh;
*/

-- =============================================================================
-- VACUUM AND ANALYZE (Optional - run separately as needed)
-- =============================================================================

-- Run these commands after creating indexes to update statistics
-- VACUUM ANALYZE bookings;
-- VACUUM ANALYZE services;
-- VACUUM ANALYZE user_meeting_integrations;