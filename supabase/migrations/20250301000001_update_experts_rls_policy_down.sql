-- Revert RLS policy changes for experts table

-- First, drop the new policy
DROP POLICY IF EXISTS "Allow access for all users" ON "public"."experts";

-- Recreate the original policy that only allows access for authenticated users
CREATE POLICY "Enable all access for authenticated users" 
ON "public"."experts"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true); 