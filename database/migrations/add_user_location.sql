-- Migration: Add location field to users table
-- Date: 2026-01-12
-- Description: Add location field for user profile information

-- Add location column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.location IS 'User location (e.g., "San Francisco, CA" or "London, UK")';
