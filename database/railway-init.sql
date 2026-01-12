-- =====================================================
-- Railway PostgreSQL 初始化脚本
-- 适用于 BookMe 项目迁移到 Railway
-- =====================================================

-- 清理现有表（如果需要重新初始化）
DROP TABLE IF EXISTS blockchain_events CASCADE;
DROP TABLE IF EXISTS signature_nonces CASCADE;
DROP TABLE IF EXISTS file_uploads CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS referral_codes CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS cancellation_policy_conditions CASCADE;
DROP TABLE IF EXISTS cancellation_policies CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS user_meeting_integrations CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- 辅助函数
-- =====================================================

-- 自动更新 updated_at 列的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 用户表 (users)
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基础信息
  email TEXT,
  display_name TEXT,
  username TEXT UNIQUE,
  avatar TEXT,
  bio TEXT,
  location TEXT,

  -- 钱包地址
  wallet_address TEXT,

  -- 时区设置
  timezone TEXT DEFAULT 'UTC',

  -- 用户状态
  is_verified BOOLEAN DEFAULT FALSE,
  is_provider BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,

  -- 统计数据
  rating DECIMAL(3,2) DEFAULT 0.00,
  review_count INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  total_spent DECIMAL(10,2) DEFAULT 0.00,

  -- 推荐系统
  referred_by UUID REFERENCES users(id),
  referral_earnings DECIMAL(10,2) DEFAULT 0.00,
  referral_count INTEGER DEFAULT 0,

  -- 公开页面主题设置
  page_theme TEXT DEFAULT 'default',
  page_custom_css TEXT,
  page_theme_settings JSONB DEFAULT '{}'::jsonb,
  profile_buttons JSONB DEFAULT '[]'::jsonb,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户名格式验证
ALTER TABLE users ADD CONSTRAINT username_format
  CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_-]{3,30}$');

-- 主题 ID 不做数据库约束 - 前端负责 fallback 到 'default'
-- 这样可以灵活添加新主题而无需更新数据库

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_wallet ON users(wallet_address);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 分类表 (categories)
-- =====================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认分类
INSERT INTO categories (name, description, icon, color, sort_order) VALUES
  ('Consulting', 'Professional consulting services', 'briefcase', '#3B82F6', 1),
  ('Tutoring', 'Educational tutoring and teaching', 'academic-cap', '#10B981', 2),
  ('Coaching', 'Life, career, and personal coaching', 'sparkles', '#8B5CF6', 3),
  ('Mentoring', 'Professional mentoring services', 'users', '#F59E0B', 4),
  ('Creative', 'Creative and design services', 'paint-brush', '#EC4899', 5),
  ('Technical', 'Technical and IT services', 'code', '#6366F1', 6),
  ('Health', 'Health and wellness services', 'heart', '#EF4444', 7),
  ('Other', 'Other services', 'dots-horizontal', '#6B7280', 8);

-- =====================================================
-- 服务表 (services)
-- =====================================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联到用户
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),

  -- 服务信息
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- 服务配置
  is_active BOOLEAN DEFAULT TRUE,
  is_visible BOOLEAN DEFAULT TRUE,
  is_online BOOLEAN DEFAULT FALSE,
  location TEXT,
  meeting_platform TEXT,

  -- 可用时间 (JSON 格式)
  availability_schedule JSONB DEFAULT '[]'::jsonb,

  -- 元数据
  tags TEXT[],
  requirements TEXT,
  cancellation_policy TEXT,

  -- 统计
  total_bookings INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0.00,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_services_provider ON services(provider_id);
CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_services_visible ON services(is_visible) WHERE is_visible = TRUE;
CREATE INDEX idx_services_active ON services(is_active) WHERE is_active = TRUE;

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 预订表 (bookings)
-- =====================================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- 预订状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'pending_payment', 'paid', 'confirmed',
    'in_progress', 'completed', 'cancelled', 'rejected',
    'refunded', 'failed', 'pending_completion', 'pending_cancellation'
  )),

  -- 时间安排
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- 价格
  total_price DECIMAL(10,2) NOT NULL,
  service_fee DECIMAL(10,2) DEFAULT 0.00,

  -- 会议信息
  is_online BOOLEAN DEFAULT FALSE,
  location TEXT,
  meeting_link TEXT,

  -- 备注
  customer_notes TEXT,
  provider_notes TEXT,

  -- 区块链集成
  blockchain_booking_id TEXT,
  blockchain_tx_hash TEXT,
  blockchain_confirmed_at TIMESTAMP WITH TIME ZONE,
  completion_tx_hash TEXT,
  cancellation_tx_hash TEXT,
  blockchain_data JSONB,

  -- 取消信息
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- 拒绝信息
  rejection_reason TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE,

  -- 完成信息
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_notes TEXT,
  backend_completed BOOLEAN DEFAULT FALSE,
  backend_completion_reason TEXT,

  -- 自动完成阻止
  auto_complete_blocked BOOLEAN DEFAULT FALSE,
  auto_complete_blocked_reason TEXT,

  -- 提醒跟踪
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_1h_sent BOOLEAN DEFAULT FALSE,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_provider ON bookings(provider_id);
CREATE INDEX idx_bookings_service ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_scheduled ON bookings(scheduled_at);
CREATE INDEX idx_bookings_blockchain ON bookings(blockchain_booking_id);

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 对话表 (conversations)
-- =====================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 参与者
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 元数据
  latest_message_id UUID,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 消息表 (messages)
-- =====================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 内容
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- =====================================================
-- 评论表 (reviews)
-- =====================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- 评论内容
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_public BOOLEAN DEFAULT TRUE,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_booking ON reviews(booking_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_reviews_service ON reviews(service_id);

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 交易表 (transactions)
-- =====================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  source_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- 交易信息
  type TEXT NOT NULL CHECK (type IN ('booking_payment', 'inviter_fee', 'bonus', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  transaction_hash TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_provider ON transactions(provider_id);
CREATE INDEX idx_transactions_booking ON transactions(booking_id);
CREATE INDEX idx_transactions_type ON transactions(type);

-- =====================================================
-- 用户会议集成表 (user_meeting_integrations)
-- =====================================================
CREATE TABLE user_meeting_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 集成信息
  provider TEXT NOT NULL CHECK (provider IN ('google', 'zoom')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,

  -- 状态
  is_active BOOLEAN DEFAULT TRUE,

  -- 元数据
  account_email TEXT,
  account_name TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 每个用户每个提供商只能有一个集成
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_integrations_user ON user_meeting_integrations(user_id);

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON user_meeting_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 文件上传表 (file_uploads)
-- =====================================================
CREATE TABLE file_uploads (
  id TEXT PRIMARY KEY,

  -- 关联
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 文件信息
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  upload_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  folder TEXT,

  -- 元数据
  metadata JSONB,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_uploads_type ON file_uploads(upload_type);

-- =====================================================
-- 签名 Nonce 表 (防重放攻击)
-- =====================================================
CREATE TABLE signature_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Nonce 信息
  nonce TEXT NOT NULL UNIQUE,
  signature_type TEXT NOT NULL,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_nonces_booking ON signature_nonces(booking_id);
CREATE INDEX idx_nonces_nonce ON signature_nonces(nonce);

-- =====================================================
-- 区块链事件表
-- =====================================================
CREATE TABLE blockchain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

  -- 事件信息
  event_type TEXT NOT NULL,
  transaction_hash TEXT,
  block_number BIGINT,
  block_timestamp TIMESTAMP WITH TIME ZONE,

  -- 事件数据
  event_data JSONB,

  -- 处理状态
  processing_status TEXT DEFAULT 'pending',

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_blockchain_events_booking ON blockchain_events(booking_id);
CREATE INDEX idx_blockchain_events_type ON blockchain_events(event_type);
CREATE INDEX idx_blockchain_events_tx ON blockchain_events(transaction_hash);

CREATE TRIGGER update_blockchain_events_updated_at
  BEFORE UPDATE ON blockchain_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 取消政策表
-- =====================================================
CREATE TABLE cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 政策信息
  title TEXT NOT NULL,
  description TEXT,
  refund_percentage INTEGER NOT NULL CHECK (refund_percentage >= 0 AND refund_percentage <= 100),

  -- 条件
  min_hours_before INTEGER,
  max_hours_before INTEGER,

  -- 状态
  is_active BOOLEAN DEFAULT TRUE,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 取消政策条件表
-- =====================================================
CREATE TABLE cancellation_policy_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  policy_id UUID NOT NULL REFERENCES cancellation_policies(id) ON DELETE CASCADE,

  -- 条件
  condition_type TEXT NOT NULL,
  condition_value TEXT,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_policy_conditions_policy ON cancellation_policy_conditions(policy_id);

-- =====================================================
-- 推荐码表
-- =====================================================
CREATE TABLE referral_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referral_codes_user ON referral_codes(user_id);

-- =====================================================
-- 推荐记录表
-- =====================================================
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  referral_code TEXT NOT NULL REFERENCES referral_codes(code),

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_id);

-- =====================================================
-- PostgreSQL NOTIFY 触发器 (用于实时功能)
-- =====================================================

-- 消息插入通知
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('new_message', json_build_object(
    'id', NEW.id,
    'conversation_id', NEW.conversation_id,
    'sender_id', NEW.sender_id,
    'content', NEW.content,
    'created_at', NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_insert_notify
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_new_message();

-- Booking 变更通知
CREATE OR REPLACE FUNCTION notify_booking_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('booking_change', json_build_object(
    'id', NEW.id,
    'customer_id', NEW.customer_id,
    'provider_id', NEW.provider_id,
    'status', NEW.status,
    'event_type', TG_OP
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_change_notify
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION notify_booking_change();

-- 对话更新通知
CREATE OR REPLACE FUNCTION notify_conversation_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('conversation_update', json_build_object(
    'id', NEW.id,
    'user1_id', NEW.user1_id,
    'user2_id', NEW.user2_id,
    'last_message_at', NEW.last_message_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_update_notify
AFTER UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION notify_conversation_update();

-- =====================================================
-- 初始化完成
-- =====================================================
SELECT 'Railway PostgreSQL 初始化完成!' AS status;
