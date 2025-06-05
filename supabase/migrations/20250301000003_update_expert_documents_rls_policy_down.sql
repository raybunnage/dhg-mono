-- Revert RLS policy changes for expert_documents table

-- Drop the new policy
DROP POLICY IF EXISTS "Allow access for all users" ON "public"."expert_documents";

-- Recreate the original granular policies
CREATE POLICY "Allow authenticated users to delete expert documents" 
ON "public"."expert_documents"
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert expert documents" 
ON "public"."expert_documents"
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update expert documents" 
ON "public"."expert_documents"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow users to view all expert documents" 
ON "public"."expert_documents"
FOR SELECT
TO authenticated
USING (true); 