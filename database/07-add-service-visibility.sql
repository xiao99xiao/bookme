-- Add is_visible column to services table
-- This allows services to be hidden from public view while remaining active for bookings

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- Add index for visibility filtering
CREATE INDEX IF NOT EXISTS services_visible_idx ON public.services(is_visible) WHERE is_visible = TRUE;

-- Update RLS policies to consider both is_active AND is_visible for public access
DROP POLICY IF EXISTS "services_public_read" ON public.services;
DROP POLICY IF EXISTS "services_active_public" ON public.services;

-- Only visible services are publicly viewable (for discovery)
CREATE POLICY "services_public_visible" ON public.services
  FOR SELECT USING (is_visible = TRUE);

-- Update the get_all_services function to only return visible services
CREATE OR REPLACE FUNCTION get_all_services()
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  title TEXT,
  description TEXT,
  price DECIMAL(10,2),
  duration_minutes INTEGER,
  category_id UUID,
  is_active BOOLEAN,
  is_visible BOOLEAN,
  is_online BOOLEAN,
  location TEXT,
  availability_schedule JSONB,
  tags TEXT[],
  requirements TEXT,
  cancellation_policy TEXT,
  total_bookings INTEGER,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  categories JSONB,
  providers JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    s.*,
    json_build_object('name', c.name, 'icon', c.icon, 'color', c.color) as categories,
    json_build_object('display_name', u.display_name, 'avatar', u.avatar) as providers
  FROM public.services s
  LEFT JOIN public.categories c ON s.category_id = c.id
  LEFT JOIN public.users u ON s.user_id = u.id
  WHERE s.is_visible = TRUE
  ORDER BY s.created_at DESC;
$$;