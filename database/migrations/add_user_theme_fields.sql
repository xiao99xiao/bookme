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

-- 主题 ID 不做数据库约束 - 前端负责 fallback 到 'default'
-- 这样可以灵活添加新主题而无需更新数据库

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
