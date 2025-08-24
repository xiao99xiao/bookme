-- Create services table (updated for Web3Auth user IDs)

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to Web3Auth user ID
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Service information
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  
  -- Service configuration
  is_active BOOLEAN DEFAULT TRUE,
  is_online BOOLEAN DEFAULT FALSE,
  location TEXT,
  
  -- Availability schedule (JSON format)
  availability_schedule JSONB DEFAULT '[]'::jsonb,
  
  -- Service metadata
  tags TEXT[],
  requirements TEXT,
  cancellation_policy TEXT,
  
  -- Stats
  total_bookings INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER update_services_updated_at 
  BEFORE UPDATE ON public.services 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS services_user_id_idx ON public.services(user_id);
CREATE INDEX IF NOT EXISTS services_category_idx ON public.services(category_id);
CREATE INDEX IF NOT EXISTS services_active_idx ON public.services(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS services_location_idx ON public.services USING GIN(to_tsvector('english', location)) WHERE location IS NOT NULL;

-- Row Level Security
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can manage their own services
CREATE POLICY "services_manage_own" ON public.services
  FOR ALL USING (user_id = current_setting('app.current_user_id', TRUE));

-- Public read access for active services
CREATE POLICY "services_public_read" ON public.services
  FOR SELECT USING (is_active = TRUE);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;