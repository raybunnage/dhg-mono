-- Add public read policies for filter tables
-- These tables need to be publicly readable for the filter functionality to work

-- Enable RLS on filter tables if not already enabled
ALTER TABLE filter_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_user_profile_drives ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON filter_user_profiles;
DROP POLICY IF EXISTS "Allow public read access" ON filter_user_profile_drives;

-- Create public read policies
CREATE POLICY "Allow public read access"
ON filter_user_profiles
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access"
ON filter_user_profile_drives
FOR SELECT
TO public
USING (true);

-- Add comments explaining the policies
COMMENT ON POLICY "Allow public read access" ON filter_user_profiles IS 
'Filter profiles need to be publicly readable for the audio app filter functionality';

COMMENT ON POLICY "Allow public read access" ON filter_user_profile_drives IS 
'Filter drive mappings need to be publicly readable for the audio app filter functionality';