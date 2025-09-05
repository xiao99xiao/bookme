-- Add reminder tracking columns to bookings table for automation

-- Add columns for tracking sent reminders
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS reminder_24h_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_1h_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_15m_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_status_updated BOOLEAN DEFAULT FALSE;

-- Add index for efficient cron job queries
CREATE INDEX IF NOT EXISTS bookings_automation_idx ON public.bookings(status, scheduled_at, reminder_1h_sent);

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.reminder_24h_sent IS 'Timestamp when 24-hour reminder was sent';
COMMENT ON COLUMN public.bookings.reminder_1h_sent IS 'Timestamp when 1-hour reminder was sent';  
COMMENT ON COLUMN public.bookings.reminder_15m_sent IS 'Timestamp when 15-minute reminder was sent';
COMMENT ON COLUMN public.bookings.auto_status_updated IS 'Flag to track if booking was updated by automation system';