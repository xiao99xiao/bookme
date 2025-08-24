-- Create bookings table (updated for Web3Auth user IDs)

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References to Web3Auth user IDs
  customer_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  
  -- Booking details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  
  -- Pricing
  total_price DECIMAL(10,2) NOT NULL,
  service_fee DECIMAL(10,2) DEFAULT 0.00,
  
  -- Location and meeting details
  is_online BOOLEAN DEFAULT FALSE,
  location TEXT,
  meeting_link TEXT,
  
  -- Notes and communication
  customer_notes TEXT,
  provider_notes TEXT,
  
  -- Cancellation details
  cancellation_reason TEXT,
  cancelled_by TEXT, -- 'customer' or 'provider'
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON public.bookings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_provider_id_idx ON public.bookings(provider_id);
CREATE INDEX IF NOT EXISTS bookings_service_id_idx ON public.bookings(service_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings(status);
CREATE INDEX IF NOT EXISTS bookings_scheduled_at_idx ON public.bookings(scheduled_at);

-- Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Customers can access their bookings
CREATE POLICY "bookings_customer_access" ON public.bookings
  FOR ALL USING (customer_id = current_setting('app.current_user_id', TRUE));

-- Providers can access bookings for their services
CREATE POLICY "bookings_provider_access" ON public.bookings
  FOR ALL USING (provider_id = current_setting('app.current_user_id', TRUE));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;