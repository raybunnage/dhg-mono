-- Update RLS policy for document_types table to allow anon access

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to delete document_types" ON "public"."document_types";
DROP POLICY IF EXISTS "Allow authenticated users to insert document_types" ON "public"."document_types";
DROP POLICY IF EXISTS "Allow authenticated users to select document_types" ON "public"."document_types";
DROP POLICY IF EXISTS "Allow authenticated users to update document_types" ON "public"."document_types";
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."document_types";

-- Create a single policy that allows all access for both authenticated and anonymous users
CREATE POLICY "Allow access for all users" 
ON "public"."document_types"
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMENT ON MIGRATION IS 'This migration updates the RLS policies for the document_types table to allow access for both authenticated and anonymous users, making it consistent with the experts table.'; 