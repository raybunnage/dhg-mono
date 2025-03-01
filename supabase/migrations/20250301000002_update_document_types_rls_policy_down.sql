-- Revert RLS policy changes for document_types table

-- Drop the new policy
DROP POLICY IF EXISTS "Allow access for all users" ON "public"."document_types";

-- Recreate the original granular policies
CREATE POLICY "Allow authenticated users to delete document_types" 
ON "public"."document_types"
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert document_types" 
ON "public"."document_types"
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to select document_types" 
ON "public"."document_types"
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update document_types" 
ON "public"."document_types"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" 
ON "public"."document_types"
FOR ALL
TO public
USING (true)
WITH CHECK (true); 