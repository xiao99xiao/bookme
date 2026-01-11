-- =====================================================
-- Reschedule Requests Migration
-- Date: 2026-01-11
-- Description: Add table and columns for booking reschedule feature
-- =====================================================

-- =====================================================
-- 1. RESCHEDULE REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reschedule_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id),
    requester_role TEXT NOT NULL CHECK (requester_role IN ('host', 'visitor')),

    -- Proposed changes
    proposed_scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    proposed_duration_minutes INTEGER,  -- NULL means keep original duration
    reason TEXT,  -- Optional explanation

    -- Response
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'withdrawn')),
    response_notes TEXT,  -- Optional rejection reason
    responded_at TIMESTAMP WITH TIME ZONE,
    responder_id UUID REFERENCES users(id),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 days')
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_booking_id
    ON reschedule_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_requester_id
    ON reschedule_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_status
    ON reschedule_requests(status);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_expires_at
    ON reschedule_requests(expires_at) WHERE status = 'pending';

-- Trigger to update updated_at (drop if exists for idempotency)
DROP TRIGGER IF EXISTS trigger_reschedule_requests_updated_at ON reschedule_requests;
CREATE TRIGGER trigger_reschedule_requests_updated_at
    BEFORE UPDATE ON reschedule_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. MODIFY BOOKINGS TABLE
-- Add columns for reschedule tracking
-- =====================================================

-- Track visitor reschedule usage (visitors can only reschedule once per booking)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS visitor_reschedule_count INTEGER DEFAULT 0;

-- Store the original scheduled time before any rescheduling
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS original_scheduled_at TIMESTAMP WITH TIME ZONE;

-- Track when the booking was last rescheduled
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS last_rescheduled_at TIMESTAMP WITH TIME ZONE;

-- Track who initiated the most recent reschedule
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS rescheduled_by UUID REFERENCES users(id);

-- Add comments for clarity
COMMENT ON COLUMN bookings.visitor_reschedule_count IS 'Number of times visitor has rescheduled (max 1)';
COMMENT ON COLUMN bookings.original_scheduled_at IS 'Original scheduled time before any rescheduling';
COMMENT ON COLUMN bookings.last_rescheduled_at IS 'When the booking was last rescheduled';
COMMENT ON COLUMN bookings.rescheduled_by IS 'User ID who initiated the last reschedule';

-- =====================================================
-- 3. PREVENT DUPLICATE PENDING REQUESTS
-- Only one pending request per booking at a time
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_reschedule_requests_one_pending_per_booking
    ON reschedule_requests(booking_id)
    WHERE status = 'pending';

-- =====================================================
-- 4. SET DEFAULT VALUES FOR EXISTING BOOKINGS
-- =====================================================
UPDATE bookings
SET visitor_reschedule_count = 0
WHERE visitor_reschedule_count IS NULL;

-- =====================================================
-- VERIFICATION QUERIES (for manual checking)
-- =====================================================
-- SELECT COUNT(*) FROM reschedule_requests;
-- SELECT * FROM bookings WHERE last_rescheduled_at IS NOT NULL LIMIT 5;
-- \d reschedule_requests
