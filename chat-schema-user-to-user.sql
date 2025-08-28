-- User-to-User Chat Feature Database Schema
-- Execute this in your Supabase SQL editor

-- Drop existing tables if needed (uncomment if you want to start fresh)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Conversations table - chat threads between two users
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique conversation between two users (order doesn't matter)
  CONSTRAINT unique_conversation UNIQUE (user1_id, user2_id),
  -- Ensure user1_id is always less than user2_id for consistency
  CONSTRAINT user_order CHECK (user1_id < user2_id)
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
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(is_read) WHERE is_read = FALSE;

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations with booking" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages with active booking" ON messages;
DROP POLICY IF EXISTS "Users can update read status" ON messages;

-- RLS Policies for conversations
CREATE POLICY "Users can view their conversations" ON conversations
  FOR SELECT USING (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id
  );

-- Users can create conversations only if they have a booking relationship
CREATE POLICY "Users can create conversations with booking" ON conversations
  FOR INSERT WITH CHECK (
    -- User must be one of the participants
    (auth.uid() = user1_id OR auth.uid() = user2_id) AND
    -- There must be an active booking between them
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE status IN ('pending', 'confirmed', 'completed')
      AND (
        (customer_id = user1_id AND provider_id = user2_id) OR
        (customer_id = user2_id AND provider_id = user1_id)
      )
    )
  );

CREATE POLICY "Users can update their conversations" ON conversations
  FOR UPDATE USING (
    auth.uid() = user1_id OR 
    auth.uid() = user2_id
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Users can only send messages if there's an active booking
CREATE POLICY "Users can send messages with active booking" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM bookings 
        WHERE status IN ('pending', 'confirmed', 'completed')
        AND (
          (customer_id = c.user1_id AND provider_id = c.user2_id) OR
          (customer_id = c.user2_id AND provider_id = c.user1_id)
        )
      )
    )
  );

-- Allow users to mark messages as read
CREATE POLICY "Users can update read status" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Function to get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_user1_id UUID,
  p_user2_id UUID
) RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_ordered_user1 UUID;
  v_ordered_user2 UUID;
BEGIN
  -- Ensure consistent ordering
  IF p_user1_id < p_user2_id THEN
    v_ordered_user1 := p_user1_id;
    v_ordered_user2 := p_user2_id;
  ELSE
    v_ordered_user1 := p_user2_id;
    v_ordered_user2 := p_user1_id;
  END IF;
  
  -- Check if conversation exists
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE user1_id = v_ordered_user1 AND user2_id = v_ordered_user2;
  
  -- Create if doesn't exist
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (user1_id, user2_id)
    VALUES (v_ordered_user1, v_ordered_user2)
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Enable realtime for live chat
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Grant permissions
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON conversations TO anon;
GRANT ALL ON messages TO anon;
GRANT EXECUTE ON FUNCTION get_or_create_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_conversation TO anon;

-- Verify the tables were created successfully
SELECT 'Setup Complete!' as status;
SELECT 'conversations' as table_name, count(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'conversations' AND table_schema = 'public'
UNION ALL
SELECT 'messages' as table_name, count(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'messages' AND table_schema = 'public';