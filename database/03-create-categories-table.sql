-- Create service categories table

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Icon name or URL
  color TEXT, -- Hex color for UI
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO public.categories (name, description, icon, color, sort_order) VALUES
('Consulting', 'Business and professional consulting services', '💼', '#3B82F6', 1),
('Design', 'Graphic design, UI/UX, and creative services', '🎨', '#8B5CF6', 2),
('Development', 'Software development and programming services', '💻', '#10B981', 3),
('Marketing', 'Digital marketing and promotion services', '📈', '#F59E0B', 4),
('Writing', 'Content writing and copywriting services', '✍️', '#EF4444', 5),
('Education', 'Teaching and training services', '📚', '#6366F1', 6),
('Health', 'Fitness and wellness services', '🏥', '#EC4899', 7),
('Other', 'Other professional services', '⚡', '#6B7280', 8)
ON CONFLICT (name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS categories_active_idx ON public.categories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS categories_sort_idx ON public.categories(sort_order);

-- Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public read access for categories
CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT USING (is_active = TRUE);

-- Grant permissions
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.categories TO authenticated;