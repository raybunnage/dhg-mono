-- Migration: Remove user_roles table and all dependencies
-- Description: Remove the user_roles table which is no longer needed for allowed_emails functionality

-- Step 1: Drop policies on other tables that reference user_roles
DROP POLICY IF EXISTS "Admin users can view allowed emails" ON allowed_emails;
DROP POLICY IF EXISTS "Admin users can manage allowed emails" ON allowed_emails;

-- Only drop access_requests policies if the table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_requests') THEN
        DROP POLICY IF EXISTS "Admin users can view all access requests" ON access_requests;
        DROP POLICY IF EXISTS "Admin users can update access requests" ON access_requests;
    END IF;
END $$;

-- Step 2: Create replacement policies using auth.users app_metadata
-- For allowed_emails table
CREATE POLICY "Admin users can view allowed emails"
  ON allowed_emails FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admin users can manage allowed emails"
  ON allowed_emails FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_app_meta_data->>'role' = 'admin'
    )
  );

-- For access_requests table (only create policies if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_requests') THEN
        CREATE POLICY "Admin users can view all access requests"
          ON access_requests FOR SELECT
          TO authenticated
          USING (
            auth.uid() IN (
              SELECT id FROM auth.users 
              WHERE raw_app_meta_data->>'role' IN ('admin', 'moderator')
            )
          );

        CREATE POLICY "Admin users can update access requests"
          ON access_requests FOR UPDATE
          TO authenticated
          USING (
            auth.uid() IN (
              SELECT id FROM auth.users 
              WHERE raw_app_meta_data->>'role' = 'admin'
            )
          );
    END IF;
END $$;

-- Step 3: Drop the make_me_admin function
DROP FUNCTION IF EXISTS make_me_admin();

-- Step 4: Drop policies on user_roles table itself
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage user roles" ON user_roles;

-- Step 5: Revoke grants on user_roles
REVOKE ALL ON public.user_roles FROM authenticated;
REVOKE ALL ON public.user_roles FROM service_role;

-- Step 6: Finally drop the user_roles table
DROP TABLE IF EXISTS public.user_roles;

-- Optional: Add comment about the removal
COMMENT ON SCHEMA public IS 'user_roles table removed - allowed_emails now handles access control directly';