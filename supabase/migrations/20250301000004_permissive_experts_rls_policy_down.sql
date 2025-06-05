-- Revert the highly permissive RLS policy for the experts table

-- Drop the unrestricted policy
DROP POLICY IF EXISTS "Unrestricted access for everyone" ON "public"."experts";

-- Re-enable RLS for the experts table
ALTER TABLE "public"."experts" ENABLE ROW LEVEL SECURITY;

-- Recreate the policy that allows access for both authenticated and anonymous users
CREATE POLICY "Allow access for all users" 
ON "public"."experts"
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true); 