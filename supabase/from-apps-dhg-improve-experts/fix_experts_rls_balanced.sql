-- SQL script to fix experts table RLS with a balanced approach
-- Run this directly in the Supabase SQL Editor

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

-- Verify the changes
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM 
    pg_class
WHERE 
    relname = 'experts' AND
    relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Get all RLS policies for the experts table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'experts'; 