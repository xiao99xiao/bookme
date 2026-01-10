-- Migration: Add profile_buttons field to users table
-- 添加 profile_buttons 到 users 表用于存储用户公开页面的链接按钮

-- 添加字段
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_buttons JSONB DEFAULT '[]'::jsonb;

-- 添加注释
COMMENT ON COLUMN users.profile_buttons IS 'Array of link buttons for public profile page. Each button has: id, label, url, icon, order';

-- 验证添加成功
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name = 'profile_buttons';
