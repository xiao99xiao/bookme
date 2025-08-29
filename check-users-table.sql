-- Check the actual users table structure
\d users;

-- Also check the data type specifically
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public'
  AND column_name = 'id';

-- Check what type of values are actually stored
SELECT id, typeof(id) as id_type FROM users LIMIT 1;