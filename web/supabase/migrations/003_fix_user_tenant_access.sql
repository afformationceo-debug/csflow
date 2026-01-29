-- Fix user access to existing data
-- User: afformation.ceo@gmail.com (f1b421d2-18c6-43e3-a56e-b62a504bb8ba)
-- Problem: RLS policies require tenant_ids in users table, but user doesn't exist in users table

-- Step 1: First, let's get all existing tenant IDs and assign them to the user
DO $$
DECLARE
    all_tenant_ids UUID[];
    user_uuid UUID := 'f1b421d2-18c6-43e3-a56e-b62a504bb8ba';
BEGIN
    -- Get all tenant IDs into an array
    SELECT array_agg(id) INTO all_tenant_ids FROM tenants;

    -- Check if user already exists in users table
    IF EXISTS (SELECT 1 FROM users WHERE id = user_uuid) THEN
        -- Update existing user with all tenant IDs
        UPDATE users
        SET
            tenant_ids = all_tenant_ids,
            role = 'admin',
            updated_at = NOW()
        WHERE id = user_uuid;

        RAISE NOTICE 'Updated existing user with % tenants', array_length(all_tenant_ids, 1);
    ELSE
        -- Insert new user record with all tenant IDs
        INSERT INTO users (
            id,
            email,
            name,
            role,
            tenant_ids,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            user_uuid,
            'afformation.ceo@gmail.com',
            'CEO',
            'admin',
            all_tenant_ids,
            true,
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Created new user with % tenants', array_length(all_tenant_ids, 1);
    END IF;
END $$;

-- Step 2: Create a trigger to automatically add new tenants to admin users
CREATE OR REPLACE FUNCTION add_tenant_to_admin_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Add new tenant to all admin users
    UPDATE users
    SET
        tenant_ids = array_append(tenant_ids, NEW.id),
        updated_at = NOW()
    WHERE
        role = 'admin'
        AND NOT (NEW.id = ANY(tenant_ids));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS add_tenant_to_admins ON tenants;

-- Create trigger
CREATE TRIGGER add_tenant_to_admins
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION add_tenant_to_admin_users();

-- Step 3: Verify the fix (this will show in Supabase SQL Editor output)
SELECT
    u.email,
    u.role,
    array_length(u.tenant_ids, 1) as tenant_count,
    u.tenant_ids
FROM users u
WHERE u.id = 'f1b421d2-18c6-43e3-a56e-b62a504bb8ba';

-- Step 4: Show all tenants for verification
SELECT id, name FROM tenants;
