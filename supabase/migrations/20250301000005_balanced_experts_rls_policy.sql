-- Create a balanced RLS policy for the experts table
-- This maintains security while ensuring authenticated users have access

-- First, drop any existing policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."experts";
DROP POLICY IF EXISTS "Allow access for all users" ON "public"."experts";
DROP POLICY IF EXISTS "Unrestricted access for everyone" ON "public"."experts";

-- Keep RLS enabled for security
ALTER TABLE "public"."experts" ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows access for authenticated users
CREATE POLICY "Allow access for authenticated users" 
ON "public"."experts"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create a separate policy for anon users that only allows SELECT
CREATE POLICY "Allow read-only access for anonymous users" 
ON "public"."experts"
FOR SELECT
TO anon
USING (true);

-- Grant appropriate permissions
GRANT SELECT ON "public"."experts" TO anon;
GRANT ALL ON "public"."experts" TO authenticated, service_role;

COMMENT ON MIGRATION IS 'This migration creates a balanced security policy for the experts table that allows full access for authenticated users and read-only access for anonymous users.'; 