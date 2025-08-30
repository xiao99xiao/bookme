-- =====================================================
-- RLS Policies for Backend-Only Access Pattern
-- =====================================================
-- Since we're using Privy authentication with a backend service,
-- all database operations go through the backend using the service role.
-- These policies are restrictive by default, allowing public reads
-- only where necessary.

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_meeting_integrations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Drop all existing policies (clean slate)
-- =====================================================

-- Users table
DROP POLICY IF EXISTS "users_public_read" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_read_access" ON users;
DROP POLICY IF EXISTS "users_update_access" ON users;

-- Services table
DROP POLICY IF EXISTS "services_public_read" ON services;
DROP POLICY IF EXISTS "services_provider_insert" ON services;
DROP POLICY IF EXISTS "services_provider_update" ON services;
DROP POLICY IF EXISTS "services_provider_delete" ON services;
DROP POLICY IF EXISTS "services_owner_access" ON services;

-- Bookings table
DROP POLICY IF EXISTS "bookings_customer_read" ON bookings;
DROP POLICY IF EXISTS "bookings_provider_read" ON bookings;
DROP POLICY IF EXISTS "bookings_customer_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_customer_update" ON bookings;
DROP POLICY IF EXISTS "bookings_provider_update" ON bookings;
DROP POLICY IF EXISTS "bookings_customer_access" ON bookings;
DROP POLICY IF EXISTS "bookings_provider_access" ON bookings;

-- Conversations table
DROP POLICY IF EXISTS "conversations_participant_read" ON conversations;
DROP POLICY IF EXISTS "conversations_participant_update" ON conversations;

-- Messages table
DROP POLICY IF EXISTS "messages_conversation_participants" ON messages;
DROP POLICY IF EXISTS "messages_sender_insert" ON messages;

-- Categories table
DROP POLICY IF EXISTS "categories_public_read" ON categories;

-- Reviews table
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
DROP POLICY IF EXISTS "reviews_reviewer_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_reviewer_update" ON reviews;

-- =====================================================
-- Create new restrictive policies
-- =====================================================

-- -----------------------------------------------------
-- Users Table
-- -----------------------------------------------------
-- Public profiles are viewable by anyone (needed for profile pages)
CREATE POLICY "users_public_profiles" ON users
FOR SELECT
USING (true);

-- Note: All updates/inserts go through backend with service role

-- -----------------------------------------------------
-- Services Table
-- -----------------------------------------------------
-- Active services are publicly viewable (needed for discovery)
CREATE POLICY "services_active_public" ON services
FOR SELECT
USING (is_active = true);

-- Note: All CRUD operations go through backend with service role

-- -----------------------------------------------------
-- Categories Table
-- -----------------------------------------------------
-- Categories are publicly viewable
CREATE POLICY "categories_public" ON categories
FOR SELECT
USING (true);

-- -----------------------------------------------------
-- Reviews Table
-- -----------------------------------------------------
-- Reviews are publicly viewable (needed for service pages)
CREATE POLICY "reviews_public" ON reviews
FOR SELECT
USING (true);

-- -----------------------------------------------------
-- Bookings Table
-- -----------------------------------------------------
-- No public access - all operations through backend
-- Backend validates user identity before operations

-- -----------------------------------------------------
-- Conversations Table
-- -----------------------------------------------------
-- No public access - all operations through backend
-- Backend validates participant identity

-- -----------------------------------------------------
-- Messages Table
-- -----------------------------------------------------
-- No public access - all operations through backend
-- Backend validates conversation participant identity

-- -----------------------------------------------------
-- User Meeting Integrations Table
-- -----------------------------------------------------
-- No public access - sensitive OAuth tokens
-- All operations through backend only

-- =====================================================
-- Grant permissions for authenticated users
-- =====================================================
-- Even though we're using service role, we maintain these
-- for potential future direct database access patterns

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON users, services, categories, reviews TO anon;
GRANT SELECT ON users, services, categories, reviews TO authenticated;

-- =====================================================
-- Summary of Access Pattern
-- =====================================================
-- Public (anon) can read:
--   - User profiles (for profile pages)
--   - Active services (for discovery)
--   - Categories (for filtering)
--   - Reviews (for service ratings)
--
-- All write operations:
--   - Go through backend API
--   - Backend validates Privy tokens
--   - Backend uses service role to bypass RLS
--   - Backend enforces business logic and authorization
--
-- Sensitive data (bookings, messages, integrations):
--   - No direct database access
--   - Only accessible through authenticated backend endpoints
--
-- This pattern ensures:
--   1. No service role key exposure in frontend
--   2. Centralized authorization logic in backend
--   3. Consistent data validation and business rules
--   4. Protection of sensitive user data
-- =====================================================