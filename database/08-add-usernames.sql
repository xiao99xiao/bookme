-- Add username system for clean public profile URLs
-- This allows users to have custom usernames instead of long UUIDs

-- Add username column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index for usernames
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users(username) WHERE username IS NOT NULL;

-- Add constraint for username format (3-30 chars, alphanumeric + underscore/dash)
-- Drop constraint first if it exists, then add it
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'username_format_check') THEN
        ALTER TABLE public.users DROP CONSTRAINT username_format_check;
    END IF;
END $$;

ALTER TABLE public.users ADD CONSTRAINT username_format_check 
  CHECK (username ~ '^[a-zA-Z0-9_-]{3,30}$');

-- Create function to generate default username from display name
CREATE OR REPLACE FUNCTION generate_username_from_name(display_name TEXT, user_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    base_username TEXT;
    candidate_username TEXT;
    counter INTEGER := 1;
    blacklist TEXT[] := ARRAY[
        'admin', 'administrator', 'api', 'app', 'auth', 'balance', 'balances', 
        'book', 'booking', 'bookings', 'chat', 'customer', 'dashboard', 
        'discover', 'help', 'home', 'index', 'login', 'logout', 'message', 
        'messages', 'order', 'orders', 'profile', 'provider', 'resume', 
        'root', 'service', 'services', 'setting', 'settings', 'support', 
        'user', 'wallet', 'wallets', 'www', 'mail', 'email', 'ftp', 
        'blog', 'news', 'shop', 'store', 'test', 'demo', 'example',
        'null', 'undefined', 'true', 'false', 'system', 'config'
    ];
BEGIN
    -- Clean display name: remove special chars, convert to lowercase
    base_username := lower(regexp_replace(display_name, '[^a-zA-Z0-9]', '', 'g'));
    
    -- Ensure minimum length
    IF length(base_username) < 3 THEN
        -- Use first 8 chars of user_id if name is too short
        base_username := lower(substring(replace(user_id, '-', ''), 1, 8));
    END IF;
    
    -- Truncate if too long
    IF length(base_username) > 20 THEN
        base_username := substring(base_username, 1, 20);
    END IF;
    
    candidate_username := base_username;
    
    -- Check if username is blacklisted or already taken
    WHILE candidate_username = ANY(blacklist) OR 
          EXISTS(SELECT 1 FROM public.users WHERE username = candidate_username) LOOP
        candidate_username := base_username || counter::text;
        counter := counter + 1;
        
        -- Prevent infinite loop
        IF counter > 999 THEN
            candidate_username := 'user' || extract(epoch from now())::bigint;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN candidate_username;
END;
$$;

-- Function to update users without usernames with generated ones
CREATE OR REPLACE FUNCTION generate_missing_usernames()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_record RECORD;
    generated_username TEXT;
    updated_count INTEGER := 0;
BEGIN
    -- Update users who don't have usernames
    FOR user_record IN 
        SELECT id, display_name 
        FROM public.users 
        WHERE username IS NULL AND display_name IS NOT NULL
    LOOP
        generated_username := generate_username_from_name(user_record.display_name, user_record.id::TEXT);
        
        UPDATE public.users 
        SET username = generated_username 
        WHERE id = user_record.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_username_from_name(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_missing_usernames() TO authenticated;