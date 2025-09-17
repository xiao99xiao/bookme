-- Migration: Add Google Meet Session Tracking Support
-- Date: 2024-09-18
-- Description: Add tables and columns to support Google Meet session duration tracking for bookings

-- Create booking_session_data table to store session duration information
CREATE TABLE IF NOT EXISTS booking_session_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_total_duration INTEGER, -- Total duration in seconds
  customer_total_duration INTEGER, -- Total duration in seconds
  provider_sessions JSONB, -- Array of session objects with startTime/endTime
  customer_sessions JSONB, -- Array of session objects with startTime/endTime
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient booking lookups
CREATE INDEX IF NOT EXISTS idx_booking_session_data_booking_id ON booking_session_data(booking_id);

-- Add auto-completion blocking columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS auto_complete_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_complete_blocked_reason TEXT;

-- Create index for efficient auto-completion queries
CREATE INDEX IF NOT EXISTS idx_bookings_auto_complete_blocked ON bookings(auto_complete_blocked) WHERE auto_complete_blocked = true;

-- Add comments for documentation
COMMENT ON TABLE booking_session_data IS 'Stores Google Meet session duration data for online bookings';
COMMENT ON COLUMN booking_session_data.provider_total_duration IS 'Total duration provider was online in seconds';
COMMENT ON COLUMN booking_session_data.customer_total_duration IS 'Total duration customer was online in seconds';
COMMENT ON COLUMN booking_session_data.provider_sessions IS 'Array of provider session objects with startTime/endTime/duration';
COMMENT ON COLUMN booking_session_data.customer_sessions IS 'Array of customer session objects with startTime/endTime/duration';

COMMENT ON COLUMN bookings.auto_complete_blocked IS 'Whether automatic completion is blocked due to insufficient session duration';
COMMENT ON COLUMN bookings.auto_complete_blocked_reason IS 'Reason why auto-completion was blocked';