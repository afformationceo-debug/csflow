-- Verify LINE webhook setup and diagnose why conversations table is empty

-- Step 1: Check if channel_accounts has LINE channel registered
SELECT
    'channel_accounts' as table_name,
    id,
    tenant_id,
    channel_type,
    account_name,
    account_id,
    is_active,
    webhook_url,
    created_at
FROM channel_accounts
WHERE channel_type = 'line';

-- Step 2: Check if any conversations exist at all (regardless of RLS)
SELECT
    'conversations_total_count' as check_name,
    COUNT(*) as count
FROM conversations;

-- Step 3: Check if any customers exist
SELECT
    'customers_total_count' as check_name,
    COUNT(*) as count
FROM customers;

-- Step 4: Check if any messages exist
SELECT
    'messages_total_count' as check_name,
    COUNT(*) as count
FROM messages;

-- Step 5: Check users table for afformation.ceo@gmail.com
SELECT
    'users_check' as check_name,
    id,
    email,
    role,
    tenant_ids,
    is_active
FROM users
WHERE email = 'afformation.ceo@gmail.com';

-- Step 6: Check auth.users
SELECT
    'auth_users_check' as check_name,
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
WHERE email = 'afformation.ceo@gmail.com';

-- Step 7: Verify tenant exists
SELECT
    'tenants_check' as check_name,
    id,
    name,
    created_at
FROM tenants;

-- Step 8: Check RLS policies on conversations table
SELECT
    'conversations_rls_policies' as check_name,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'conversations';
