-- Chat Feature Database Schema - Fixed Version
-- Execute this in your Supabase SQL editor

-- First, let's check if the bookings table has the required columns
-- If you get an error about missing columns, you may need to add them first

-- Check current bookings table structure (run this first to see what columns exist)
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'bookings' AND table_schema = 'public';

-- If customer_id and provider_id don't exist in bookings, add them:
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Conversations table - main chat threads between users
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one conversation per booking
  UNIQUE(booking_id)
);

-- Messages table - individual chat messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_booking ON conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_provider ON conversations(provider_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(is_read) WHERE is_read = FALSE;

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they are part of" ON conversations
  FOR SELECT USING (
    auth.uid()::text = customer_id::text OR 
    auth.uid()::text = provider_id::text
  );

CREATE POLICY "Users can create conversations for their bookings" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid()::text = customer_id::text OR 
    auth.uid()::text = provider_id::text
  );

CREATE POLICY "Users can update conversations they are part of" ON conversations
  FOR UPDATE USING (
    auth.uid()::text = customer_id::text OR 
    auth.uid()::text = provider_id::text
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.customer_id::text = auth.uid()::text OR c.provider_id::text = auth.uid()::text)
    )
  );

CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id::text = auth.uid()::text AND
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.customer_id::text = auth.uid()::text OR c.provider_id::text = auth.uid()::text)
    )
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (
    sender_id::text = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.customer_id::text = auth.uid()::text OR c.provider_id::text = auth.uid()::text)
    )
  );

-- Functions to automatically update timestamps
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_conversations_updated_at ON conversations;
CREATE TRIGGER trigger_update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_conversations_updated_at();

DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Enable realtime for live chat (if not already enabled)
-- You may need to manually enable these in the Supabase dashboard under Database > Publications
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Grant permissions
GRANT ALL ON conversations TO authenticated, anon;
GRANT ALL ON messages TO authenticated, anon;

-- Final check - verify the tables were created successfully
SELECT 'conversations' as table_name, count(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'conversations' AND table_schema = 'public'
UNION ALL
SELECT 'messages' as table_name, count(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'messages' AND table_schema = 'public';