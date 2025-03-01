-- Revert the balanced RLS policy for the experts table

-- Drop the policies
DROP POLICY IF EXISTS "Allow access for authenticated users" ON "public"."experts";
DROP POLICY IF EXISTS "Allow read-only access for anonymous users" ON "public"."experts";

-- Recreate the original policy that only allows access for authenticated users
CREATE POLICY "Enable all access for authenticated users" 
ON "public"."experts"
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true); 