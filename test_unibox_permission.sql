-- Test query to check if has_unibox_access column exists and user data
SELECT 
    id,
    email,
    role,
    has_unibox_access,
    org_id
FROM users 
WHERE email = 'superadmin2@bitwords.com';

-- Also check the column exists in the table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name = 'has_unibox_access';
