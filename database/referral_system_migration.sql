-- BookMe Referral System Database Migration
-- This file contains all the database changes needed for the referral system
-- Execute this file after all backend and frontend changes are complete

-- 1. Create referral tables

-- Referral relationships table (simplified - no status needed!)
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL, -- Which code was used for this referral
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT no_self_referral CHECK (referrer_id != referee_id),
    CONSTRAINT unique_referral_relationship UNIQUE (referrer_id, referee_id)
);

-- One referral code per user (simplified - no expiration/limits needed!)
CREATE TABLE public.referral_codes (
    code TEXT PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE, -- UNIQUE = one code per user forever
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Update users table with referral fields
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS referral_earnings NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id);

-- 3. Create database indexes

-- Indexes for referrals table
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON public.referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);

-- Indexes for referral_codes table (user_id already has UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_referral_codes_usage_count ON public.referral_codes(usage_count);

-- Index for users table referral tracking
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);

-- 4. Create database functions

-- Apply referral code atomically
CREATE OR REPLACE FUNCTION apply_referral_code(
  referee_user_id UUID,
  referrer_user_id UUID,
  referral_code TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE users SET referred_by = referrer_user_id WHERE id = referee_user_id;

  INSERT INTO referrals (referrer_id, referee_id, referral_code)
  VALUES (referrer_user_id, referee_user_id, referral_code);

  UPDATE referral_codes
  SET usage_count = usage_count + 1
  WHERE code = referral_code;

  UPDATE users
  SET referral_count = referral_count + 1
  WHERE id = referrer_user_id;
END;
$$ LANGUAGE plpgsql;

-- Record referral earnings
CREATE OR REPLACE FUNCTION record_referral_earning(
  referrer_user_id UUID,
  referee_user_id UUID,
  booking_uuid UUID,
  commission_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  INSERT INTO transactions (
    provider_id,
    type,
    amount,
    booking_id,
    source_user_id,
    description
  ) VALUES (
    referrer_user_id,
    'inviter_fee',
    commission_amount,
    booking_uuid,
    referee_user_id,
    'Referral commission from booking'
  );

  UPDATE users
  SET referral_earnings = referral_earnings + commission_amount
  WHERE id = referrer_user_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Row Level Security

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Users can see their own referral data
CREATE POLICY "referrals_own_data" ON public.referrals
  FOR ALL USING (referrer_id = auth.uid() OR referee_id = auth.uid());

CREATE POLICY "referral_codes_own_data" ON public.referral_codes
  FOR ALL USING (user_id = auth.uid());

-- Public read for referral code validation (all codes are active)
CREATE POLICY "referral_codes_public_read" ON public.referral_codes
  FOR SELECT USING (true);

-- 6. Comments for documentation

COMMENT ON TABLE public.referrals IS 'Tracks referral relationships between users';
COMMENT ON TABLE public.referral_codes IS 'Stores unique referral codes for each user';
COMMENT ON COLUMN public.users.referral_earnings IS 'Total earnings from referral commissions';
COMMENT ON COLUMN public.users.referral_count IS 'Number of successful referrals made';
COMMENT ON COLUMN public.users.referred_by IS 'User ID of the person who referred this user';
COMMENT ON FUNCTION apply_referral_code IS 'Atomically applies a referral code and updates all related fields';
COMMENT ON FUNCTION record_referral_earning IS 'Records referral commission earnings and updates user totals';