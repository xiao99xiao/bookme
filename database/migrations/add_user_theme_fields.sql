-- =====================================================
-- 用户公开页面主题字段迁移
-- 添加 page_theme, page_custom_css, page_theme_settings 到 users 表
-- =====================================================
--
-- 执行方式:
-- psql "$DATABASE_URL" -f database/migrations/add_user_theme_fields.sql
--
-- 或手动执行:
-- source .env && psql "$DATABASE_URL" -c "$(cat database/migrations/add_user_theme_fields.sql)"
--
-- =====================================================

-- 添加主题字段（使用 IF NOT EXISTS 确保幂等性）
ALTER TABLE users
ADD COLUMN IF NOT EXISTS page_theme TEXT DEFAULT 'default';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS page_custom_css TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS page_theme_settings JSONB DEFAULT '{}'::jsonb;

-- 添加主题 ID 验证约束（可选）
-- 这个约束确保只能使用预定义的主题 ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_page_theme_valid'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_page_theme_valid
    CHECK (page_theme IS NULL OR page_theme IN ('default', 'minimal', 'dark', 'vibrant'));
  END IF;
END $$;

-- 验证字段已添加
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('page_theme', 'page_custom_css', 'page_theme_settings')
ORDER BY column_name;

-- 完成
SELECT '用户主题字段迁移完成!' AS status;
