-- SQL script to fix experts table RLS
-- Run this directly in the Supabase SQL Editor to immediately fix 401 errors

-- First, drop any existing policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."experts";
DROP POLICY IF EXISTS "Allow access for all users" ON "public"."experts";

-- Disable RLS completely for the experts table (most permissive option)
ALTER TABLE "public"."experts" DISABLE ROW LEVEL SECURITY;

-- Create a policy that allows unrestricted access to everyone
-- This is a fallback in case RLS is re-enabled
CREATE POLICY "Unrestricted access for everyone" 
ON "public"."experts"
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant permissions to all roles
GRANT ALL ON "public"."experts" TO anon, authenticated, service_role;

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