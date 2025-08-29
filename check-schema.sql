-- Check current schema to understand data types
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('users', 'bookings', 'services') 
  AND table_schema = 'public'
  AND column_name LIKE '%id%'
ORDER BY table_name, ordinal_position;

-- Check auth.users table structure as well
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'auth'
  AND column_name = 'id';

-- Check existing RLS policies to see the pattern
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('users', 'bookings', 'services')
ORDER BY tablename, policyname;