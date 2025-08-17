-- BookMe Database Schema for Supabase PostgreSQL
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  location TEXT,
  hobbies TEXT, -- JSON string of array
  interests TEXT, -- JSON string of array
  avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services table
CREATE TABLE public.services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- consultation, coaching, tutoring, etc.
  availability_slots TEXT NOT NULL, -- JSON string of weekly schedule
  duration INTEGER NOT NULL, -- minutes per session
  price DECIMAL(10,2) NOT NULL,
  location TEXT NOT NULL, -- online, phone, in-person
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, confirmed, declined, cancelled, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Conversations table (for messaging)
CREATE TABLE public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  provider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_text TEXT,
  last_message_sender UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table (for real-time messaging)
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, file
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table (future feature)
CREATE TABLE public.reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_services_provider_id ON public.services(provider_id);
CREATE INDEX idx_services_category ON public.services(category);
CREATE INDEX idx_services_is_active ON public.services(is_active);

CREATE INDEX idx_bookings_service_id ON public.bookings(service_id);
CREATE INDEX idx_bookings_requester_id ON public.bookings(requester_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);

CREATE INDEX idx_conversations_booking_id ON public.conversations(booking_id);
CREATE INDEX idx_conversations_provider_id ON public.conversations(provider_id);
CREATE INDEX idx_conversations_customer_id ON public.conversations(customer_id);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies

-- Users: Users can read all profiles, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Services: Anyone can view active services, only owners can modify
CREATE POLICY "Active services are viewable by everyone" ON public.services
  FOR SELECT USING (is_active = true OR provider_id = auth.uid());

CREATE POLICY "Users can insert their own services" ON public.services
  FOR INSERT WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Users can update their own services" ON public.services
  FOR UPDATE USING (auth.uid() = provider_id);

CREATE POLICY "Users can delete their own services" ON public.services
  FOR DELETE USING (auth.uid() = provider_id);

-- Bookings: Users can see bookings they're involved in
CREATE POLICY "Users can view their bookings" ON public.bookings
  FOR SELECT USING (
    auth.uid() = requester_id OR 
    auth.uid() IN (SELECT provider_id FROM public.services WHERE id = service_id)
  );

CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Service providers can update bookings" ON public.bookings
  FOR UPDATE USING (
    auth.uid() IN (SELECT provider_id FROM public.services WHERE id = service_id)
  );

-- Conversations: Only participants can access
CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = provider_id OR auth.uid() = customer_id);

CREATE POLICY "Users can insert conversations for their bookings" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = provider_id OR auth.uid() = customer_id
  );

CREATE POLICY "Participants can update conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = provider_id OR auth.uid() = customer_id);

-- Messages: Only conversation participants can access
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT provider_id FROM public.conversations WHERE id = conversation_id
      UNION
      SELECT customer_id FROM public.conversations WHERE id = conversation_id
    )
  );

CREATE POLICY "Users can send messages in their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    auth.uid() IN (
      SELECT provider_id FROM public.conversations WHERE id = conversation_id
      UNION
      SELECT customer_id FROM public.conversations WHERE id = conversation_id
    )
  );

-- Reviews: Users can view all reviews, only authors can modify
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reviews" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own reviews" ON public.reviews
  FOR UPDATE USING (auth.uid() = author_id);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Function to automatically create conversation when booking is confirmed
CREATE OR REPLACE FUNCTION public.handle_booking_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- If booking status changed to confirmed, create conversation
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.conversations (booking_id, provider_id, customer_id)
    SELECT 
      NEW.id,
      s.provider_id,
      NEW.requester_id
    FROM public.services s
    WHERE s.id = NEW.service_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create conversations
CREATE TRIGGER handle_booking_confirmed 
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_booking_confirmed();

-- Function to update conversation last_message metadata
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET 
    last_message_at = NEW.created_at,
    last_message_text = NEW.content,
    last_message_sender = NEW.sender_id,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update conversation metadata
CREATE TRIGGER handle_new_message 
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message();