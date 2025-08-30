-- Enable RLS on all tables (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that use app.current_user_id
DROP POLICY IF EXISTS "users_read_access" ON users;
DROP POLICY IF EXISTS "users_update_access" ON users;
DROP POLICY IF EXISTS "services_public_read" ON services;
DROP POLICY IF EXISTS "services_owner_access" ON services;
DROP POLICY IF EXISTS "bookings_customer_access" ON bookings;
DROP POLICY IF EXISTS "bookings_provider_access" ON bookings;

-- Users table policies
-- Users can read all profiles (public)
CREATE POLICY "users_public_read" ON users
FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "users_update_own" ON users
FOR UPDATE USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

-- Services table policies
-- Anyone can read active services
CREATE POLICY "services_public_read" ON services
FOR SELECT USING (is_active = true);

-- Providers can manage their own services
CREATE POLICY "services_provider_insert" ON services
FOR INSERT WITH CHECK (auth.uid()::text = provider_id);

CREATE POLICY "services_provider_update" ON services
FOR UPDATE USING (auth.uid()::text = provider_id)
WITH CHECK (auth.uid()::text = provider_id);

CREATE POLICY "services_provider_delete" ON services
FOR DELETE USING (auth.uid()::text = provider_id);

-- Bookings table policies
-- Users can see bookings they're involved in
CREATE POLICY "bookings_customer_read" ON bookings
FOR SELECT USING (auth.uid()::text = customer_id);

CREATE POLICY "bookings_provider_read" ON bookings
FOR SELECT USING (auth.uid()::text = provider_id);

-- Customers can create bookings
CREATE POLICY "bookings_customer_insert" ON bookings
FOR INSERT WITH CHECK (auth.uid()::text = customer_id);

-- Both parties can update booking status
CREATE POLICY "bookings_customer_update" ON bookings
FOR UPDATE USING (auth.uid()::text = customer_id);

CREATE POLICY "bookings_provider_update" ON bookings
FOR UPDATE USING (auth.uid()::text = provider_id);

-- Conversations table policies
CREATE POLICY "conversations_participant_read" ON conversations
FOR SELECT USING (
  auth.uid()::text = customer_id OR 
  auth.uid()::text = provider_id
);

CREATE POLICY "conversations_participant_update" ON conversations
FOR UPDATE USING (
  auth.uid()::text = customer_id OR 
  auth.uid()::text = provider_id
);

-- Messages table policies
CREATE POLICY "messages_conversation_participants" ON messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.customer_id = auth.uid()::text 
         OR conversations.provider_id = auth.uid()::text)
  )
);

CREATE POLICY "messages_sender_insert" ON messages
FOR INSERT WITH CHECK (auth.uid()::text = sender_id);

-- Categories table (public read)
CREATE POLICY "categories_public_read" ON categories
FOR SELECT USING (true);

-- Reviews table policies
CREATE POLICY "reviews_public_read" ON reviews
FOR SELECT USING (true);

CREATE POLICY "reviews_reviewer_insert" ON reviews
FOR INSERT WITH CHECK (auth.uid()::text = reviewer_id);

CREATE POLICY "reviews_reviewer_update" ON reviews
FOR UPDATE USING (auth.uid()::text = reviewer_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;