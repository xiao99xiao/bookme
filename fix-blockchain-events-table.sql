-- Fix blockchain_events table by making block_number nullable
-- This allows the simplified event storage to work without constraint violations

ALTER TABLE blockchain_events 
ALTER COLUMN block_number DROP NOT NULL;

-- Optional: Also remove the log_index constraint if it exists
-- ALTER TABLE blockchain_events 
-- ALTER COLUMN log_index DROP NOT NULL;