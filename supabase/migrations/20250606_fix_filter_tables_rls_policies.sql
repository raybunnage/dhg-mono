-- Fix RLS policies for filter tables to allow public read access
-- This allows browser apps to read filter profiles

-- Enable RLS on filter tables (if not already enabled)
ALTER TABLE filter_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_user_profile_drives ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "filter_user_profiles_select_policy" ON filter_user_profiles;
DROP POLICY IF EXISTS "filter_user_profile_drives_select_policy" ON filter_user_profile_drives;

-- Create new policies that allow public read access
-- Policy for filter_user_profiles: Allow everyone to read all profiles
CREATE POLICY "filter_user_profiles_select_policy" 
ON filter_user_profiles 
FOR SELECT 
TO public 
USING (true);

-- Policy for filter_user_profile_drives: Allow everyone to read all drive mappings
CREATE POLICY "filter_user_profile_drives_select_policy" 
ON filter_user_profile_drives 
FOR SELECT 
TO public 
USING (true);

-- Add comments to explain the policies
COMMENT ON POLICY "filter_user_profiles_select_policy" ON filter_user_profiles IS 
'Allow public read access to filter profiles so browser apps can display available filters';

COMMENT ON POLICY "filter_user_profile_drives_select_policy" ON filter_user_profile_drives IS 
'Allow public read access to filter drive mappings so browser apps can show which drives belong to which filters';

-- Note: Write operations (INSERT, UPDATE, DELETE) still require authentication
-- This maintains security while allowing the UI to display available filters