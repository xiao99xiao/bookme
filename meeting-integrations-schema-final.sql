-- Meeting Integrations Database Schema (Final - Type Safe)
-- Run this on your Supabase database to add meeting integration support

-- First, let's check what type users.id actually is
DO $$ 
DECLARE
    user_id_type text;
BEGIN
    SELECT data_type INTO user_id_type
    FROM information_schema.columns 
    WHERE table_name = 'users' 
      AND table_schema = 'public'
      AND column_name = 'id';
    
    RAISE NOTICE 'Users.id column type: %', user_id_type;
    
    -- Create the table with the correct user_id type
    IF user_id_type = 'uuid' THEN
        -- Users table has UUID id
        CREATE TABLE user_meeting_integrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          platform VARCHAR(50) NOT NULL CHECK (platform IN ('google_meet', 'zoom', 'teams')),
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TIMESTAMP WITH TIME ZONE,
          scope TEXT[],
          platform_user_id TEXT,
          platform_user_email TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(user_id, platform)
        );
        RAISE NOTICE 'Created user_meeting_integrations table with UUID user_id';
    ELSE
        -- Users table has TEXT id  
        CREATE TABLE user_meeting_integrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          platform VARCHAR(50) NOT NULL CHECK (platform IN ('google_meet', 'zoom', 'teams')),
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TIMESTAMP WITH TIME ZONE,
          scope TEXT[],
          platform_user_id TEXT,
          platform_user_email TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(user_id, platform)
        );
        RAISE NOTICE 'Created user_meeting_integrations table with TEXT user_id';
    END IF;
END $$;

-- 2. Add meeting platform fields to services table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'meeting_platform') THEN
    ALTER TABLE services 
    ADD COLUMN meeting_platform VARCHAR(50) CHECK (meeting_platform IN ('google_meet', 'zoom', 'teams')),
    ADD COLUMN meeting_settings JSONB DEFAULT '{}';
    RAISE NOTICE 'Added meeting platform fields to services table';
  ELSE
    RAISE NOTICE 'Meeting platform fields already exist in services table';
  END IF;
END $$;

-- 3. Add meeting metadata to bookings table (if not exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'meeting_platform') THEN
    ALTER TABLE bookings
    ADD COLUMN meeting_platform VARCHAR(50),
    ADD COLUMN meeting_id TEXT, -- external meeting ID from provider
    ADD COLUMN meeting_settings JSONB DEFAULT '{}';
    RAISE NOTICE 'Added meeting metadata fields to bookings table';
  ELSE
    RAISE NOTICE 'Meeting metadata fields already exist in bookings table';
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_meeting_integrations_user_id ON user_meeting_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_meeting_integrations_platform ON user_meeting_integrations(platform);
CREATE INDEX IF NOT EXISTS idx_user_meeting_integrations_active ON user_meeting_integrations(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_meeting_platform ON services(meeting_platform) WHERE meeting_platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_meeting_platform ON bookings(meeting_platform) WHERE meeting_platform IS NOT NULL;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE user_meeting_integrations ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for user_meeting_integrations
-- Users can only see and manage their own integrations
CREATE POLICY "Users can view own meeting integrations" ON user_meeting_integrations
  FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "Users can insert own meeting integrations" ON user_meeting_integrations
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "Users can update own meeting integrations" ON user_meeting_integrations
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "Users can delete own meeting integrations" ON user_meeting_integrations
  FOR DELETE USING (user_id = current_setting('app.current_user_id', TRUE));

-- 7. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_meeting_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_meeting_integrations_updated_at_trigger ON user_meeting_integrations;
CREATE TRIGGER update_user_meeting_integrations_updated_at_trigger
  BEFORE UPDATE ON user_meeting_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_meeting_integrations_updated_at();

-- 9. Create helpful view for active integrations with user info
CREATE OR REPLACE VIEW active_meeting_integrations AS
SELECT 
  i.id,
  i.user_id,
  i.platform,
  i.platform_user_email,
  i.expires_at,
  i.created_at,
  u.display_name as user_name,
  u.email as user_email,
  CASE 
    WHEN i.expires_at IS NULL THEN true
    WHEN i.expires_at > now() THEN true
    ELSE false
  END as is_valid
FROM user_meeting_integrations i
JOIN users u ON i.user_id = u.id
WHERE i.is_active = true;

-- 10. Grant necessary permissions
GRANT ALL ON user_meeting_integrations TO anon;
GRANT ALL ON user_meeting_integrations TO authenticated;
GRANT ALL ON active_meeting_integrations TO anon;
GRANT ALL ON active_meeting_integrations TO authenticated;

-- Grant sequence permissions (needed for UUID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Final verification and status
DO $$
DECLARE
    user_id_type text;
    services_has_meeting boolean;
    bookings_has_meeting boolean;
BEGIN
    SELECT data_type INTO user_id_type
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'id';
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'meeting_platform'
    ) INTO services_has_meeting;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'meeting_platform'
    ) INTO bookings_has_meeting;
    
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'Users ID type: %', user_id_type;
    RAISE NOTICE 'Services has meeting fields: %', services_has_meeting;
    RAISE NOTICE 'Bookings has meeting fields: %', bookings_has_meeting;
    RAISE NOTICE 'user_meeting_integrations table: Created';
    RAISE NOTICE '==========================';
END $$;