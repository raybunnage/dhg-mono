-- Update RLS policy for experts table to allow anon access

-- First, drop the existing policy
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."experts";

-- Create a new policy that allows access for both authenticated and anonymous users
CREATE POLICY "Allow access for all users" 
ON "public"."experts"
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Create a corresponding down migration
COMMENT ON MIGRATION IS 'This migration updates the RLS policy for the experts table to allow access for both authenticated and anonymous users.'; 