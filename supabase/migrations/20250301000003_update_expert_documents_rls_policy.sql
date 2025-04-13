-- Update RLS policy for expert_documents table to allow anon access

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to delete expert documents" ON "public"."expert_documents";
DROP POLICY IF EXISTS "Allow authenticated users to insert expert documents" ON "public"."expert_documents";
DROP POLICY IF EXISTS "Allow authenticated users to update expert documents" ON "public"."expert_documents";
DROP POLICY IF EXISTS "Allow users to view all expert documents" ON "public"."expert_documents";

-- Create a single policy that allows all access for both authenticated and anonymous users
CREATE POLICY "Allow access for all users" 
ON "public"."expert_documents"
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMENT ON MIGRATION IS 'This migration updates the RLS policies for the expert_documents table to allow access for both authenticated and anonymous users, making it consistent with the experts and document_types tables.'; 