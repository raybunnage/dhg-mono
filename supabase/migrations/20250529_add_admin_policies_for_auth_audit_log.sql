-- Migration: Add admin policies for auth_audit_log
-- Description: Allow admin users to view all audit logs for the admin dashboard

-- Create a function to check if a user is an admin
-- This checks if the user has 'admin' role in their metadata
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has admin role in their metadata
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for admins to view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.auth_audit_log
  FOR SELECT
  USING (public.is_admin());

-- Add policy for admins to view all user profiles
CREATE POLICY "Admins can view all user profiles"
  ON public.user_profiles
  FOR SELECT
  USING (public.is_admin());

-- Create a more permissive policy for service role access
-- This ensures backend services can always access the data
CREATE POLICY "Service role full access to audit logs"
  ON public.auth_audit_log
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment explaining the admin access
COMMENT ON POLICY "Admins can view all audit logs" ON public.auth_audit_log IS 
  'Allows admin users to view all audit logs for dashboard and reporting purposes';