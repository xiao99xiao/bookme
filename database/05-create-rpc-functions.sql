-- Create RPC functions for Web3Auth integration

-- Function to set current user context for RLS
CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create user from Web3Auth data
CREATE OR REPLACE FUNCTION get_or_create_user(
  p_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_profile_image TEXT DEFAULT NULL,
  p_verifier TEXT DEFAULT NULL,
  p_verifier_id TEXT DEFAULT NULL
)
RETURNS public.users AS $$
DECLARE
  user_record public.users;
BEGIN
  -- Try to get existing user
  SELECT * INTO user_record FROM public.users WHERE id = p_id;
  
  -- If user doesn't exist, create them
  IF NOT FOUND THEN
    INSERT INTO public.users (
      id, 
      email, 
      name, 
      display_name,
      profile_image, 
      verifier, 
      verifier_id
    ) VALUES (
      p_id,
      p_email,
      p_name,
      COALESCE(p_name, SPLIT_PART(p_email, '@', 1)), -- Use name or email prefix as display_name
      p_profile_image,
      p_verifier,
      p_verifier_id
    )
    RETURNING * INTO user_record;
  ELSE
    -- Update existing user with latest info
    UPDATE public.users SET
      email = COALESCE(p_email, email),
      name = COALESCE(p_name, name),
      profile_image = COALESCE(p_profile_image, profile_image),
      verifier = COALESCE(p_verifier, verifier),
      verifier_id = COALESCE(p_verifier_id, verifier_id),
      updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO user_record;
  END IF;
  
  RETURN user_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user services with category info
CREATE OR REPLACE FUNCTION get_user_services(user_id TEXT)
RETURNS TABLE(
  id UUID,
  user_id TEXT,
  title TEXT,
  description TEXT,
  price DECIMAL,
  duration_minutes INTEGER,
  category_name TEXT,
  category_id UUID,
  is_active BOOLEAN,
  is_online BOOLEAN,
  location TEXT,
  availability_schedule JSONB,
  total_bookings INTEGER,
  average_rating DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.title,
    s.description,
    s.price,
    s.duration_minutes,
    c.name as category_name,
    s.category_id,
    s.is_active,
    s.is_online,
    s.location,
    s.availability_schedule,
    s.total_bookings,
    s.average_rating,
    s.created_at,
    s.updated_at
  FROM public.services s
  LEFT JOIN public.categories c ON s.category_id = c.id
  WHERE s.user_id = get_user_services.user_id
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all active services with provider info
CREATE OR REPLACE FUNCTION get_all_services()
RETURNS TABLE(
  id UUID,
  user_id TEXT,
  provider_name TEXT,
  provider_avatar TEXT,
  title TEXT,
  description TEXT,
  price DECIMAL,
  duration_minutes INTEGER,
  category_name TEXT,
  category_id UUID,
  is_online BOOLEAN,
  location TEXT,
  average_rating DECIMAL,
  total_bookings INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    COALESCE(u.display_name, u.name) as provider_name,
    COALESCE(u.avatar, u.profile_image) as provider_avatar,
    s.title,
    s.description,
    s.price,
    s.duration_minutes,
    c.name as category_name,
    s.category_id,
    s.is_online,
    s.location,
    s.average_rating,
    s.total_bookings
  FROM public.services s
  JOIN public.users u ON s.user_id = u.id
  LEFT JOIN public.categories c ON s.category_id = c.id
  WHERE s.is_active = TRUE
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_current_user_id(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION set_current_user_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_or_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_services(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_services(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_services() TO anon;
GRANT EXECUTE ON FUNCTION get_all_services() TO authenticated;