-- Complete Database Setup for BookMe Application
-- Run this in your Supabase SQL Editor to ensure all policies are correct

-- First, drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Public profiles are viewable" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Create comprehensive user policies
CREATE POLICY "Anyone can view user profiles" ON users 
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own profile" ON users 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users 
  FOR UPDATE USING (auth.uid() = id);

-- Ensure categories table exists and is populated
INSERT INTO categories (name, description, icon, color) VALUES
  ('Web Development', 'Website and web application development', '💻', '#3B82F6'),
  ('Graphic Design', 'Logo, branding, and visual design services', '🎨', '#EF4444'),
  ('Content Writing', 'Blog posts, copywriting, and content creation', '✍️', '#10B981'),
  ('Digital Marketing', 'SEO, social media, and online marketing', '📈', '#F59E0B'),
  ('Photography', 'Portrait, event, and product photography', '📸', '#8B5CF6'),
  ('Video Editing', 'Video production and post-production services', '🎬', '#EC4899'),
  ('Consulting', 'Business, strategy, and professional consulting', '🤝', '#06B6D4'),
  ('Tutoring', 'Educational and skill-based tutoring', '📚', '#84CC16'),
  ('Fitness Training', 'Personal training and fitness coaching', '💪', '#F97316'),
  ('Music Lessons', 'Musical instrument and vocal training', '🎵', '#6366F1')
ON CONFLICT (name) DO NOTHING;

-- Create a function to automatically create user profiles when auth users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.services TO anon, authenticated;
GRANT ALL ON public.categories TO anon, authenticated;
GRANT ALL ON public.bookings TO anon, authenticated;
GRANT ALL ON public.reviews TO anon, authenticated;
GRANT ALL ON public.conversations TO anon, authenticated;
GRANT ALL ON public.messages TO anon, authenticated;
GRANT ALL ON public.notifications TO anon, authenticated;
GRANT ALL ON public.user_favorites TO anon, authenticated;
GRANT ALL ON public.provider_availability TO anon, authenticated;
GRANT ALL ON public.file_uploads TO anon, authenticated;