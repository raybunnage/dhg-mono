-- Migration: Add email allowlist authentication functions and policies
-- Description: Adds functions and policies for the email allowlist system
-- Note: This assumes tables already exist from a previous partial migration

-- Add professional fields to user_profiles if they don't exist
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS professional_interests TEXT,
ADD COLUMN IF NOT EXISTS organization TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS research_areas TEXT[],
ADD COLUMN IF NOT EXISTS expertise_keywords TEXT[],
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'private' CHECK (profile_visibility IN ('private', 'internal', 'public'));

-- Create a function to check if an email is allowed
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.allowed_emails 
    WHERE LOWER(email) = LOWER(check_email) 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to add an allowed email
CREATE OR REPLACE FUNCTION public.add_allowed_email(
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_organization TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_added_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.allowed_emails (email, name, organization, notes, added_by)
  VALUES (LOWER(p_email), p_name, p_organization, p_notes, p_added_by)
  ON CONFLICT (email) 
  DO UPDATE SET 
    is_active = true,
    name = COALESCE(EXCLUDED.name, allowed_emails.name),
    organization = COALESCE(EXCLUDED.organization, allowed_emails.organization),
    notes = COALESCE(EXCLUDED.notes, allowed_emails.notes)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to submit an access request
CREATE OR REPLACE FUNCTION public.submit_access_request(
  p_email TEXT,
  p_name TEXT,
  p_profession TEXT DEFAULT NULL,
  p_professional_interests TEXT DEFAULT NULL,
  p_organization TEXT DEFAULT NULL,
  p_reason_for_access TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check if email is already allowed
  IF is_email_allowed(p_email) THEN
    RAISE EXCEPTION 'Email is already on the allowed list';
  END IF;
  
  -- Insert the access request
  INSERT INTO public.access_requests (
    email, 
    name, 
    profession, 
    professional_interests, 
    organization,
    reason_for_access
  )
  VALUES (
    LOWER(p_email), 
    p_name, 
    p_profession, 
    p_professional_interests, 
    p_organization,
    p_reason_for_access
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to approve an access request
CREATE OR REPLACE FUNCTION public.approve_access_request(
  p_request_id UUID,
  p_approved_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO v_request
  FROM public.access_requests
  WHERE id = p_request_id AND approved = false AND denied = false;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found or already processed';
  END IF;
  
  -- Add email to allowed list
  PERFORM add_allowed_email(
    v_request.email, 
    v_request.name, 
    v_request.organization,
    p_notes,
    p_approved_by
  );
  
  -- Update the request
  UPDATE public.access_requests
  SET 
    approved = true,
    approved_at = NOW(),
    approved_by = p_approved_by,
    notes = p_notes
  WHERE id = p_request_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to deny an access request
CREATE OR REPLACE FUNCTION public.deny_access_request(
  p_request_id UUID,
  p_denied_by UUID DEFAULT NULL,
  p_denial_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.access_requests
  SET 
    denied = true,
    denied_at = NOW(),
    denied_by = p_denied_by,
    denial_reason = p_denial_reason
  WHERE id = p_request_id AND approved = false AND denied = false;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found or already processed';
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin users can view allowed emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Admin users can manage allowed emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Users can view their own access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Anyone can insert access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admin users can view all access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admin users can update access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can manage user roles" ON public.user_roles;

-- Enable RLS on tables if not already enabled
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage user roles"
  ON public.user_roles FOR ALL
  TO service_role
  USING (true);

-- Allowed emails policies
CREATE POLICY "Admin users can view allowed emails"
  ON public.allowed_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admin users can manage allowed emails"
  ON public.allowed_emails FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Access requests policies
CREATE POLICY "Users can view their own access requests"
  ON public.access_requests FOR SELECT
  TO authenticated
  USING (LOWER(email) = LOWER(auth.email()));

CREATE POLICY "Anyone can insert access requests"
  ON public.access_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin users can view all access requests"
  ON public.access_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admin users can update access requests"
  ON public.access_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.allowed_emails TO authenticated;
GRANT SELECT, INSERT ON public.access_requests TO anon, authenticated;
GRANT UPDATE ON public.access_requests TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT EXECUTE ON FUNCTION public.is_email_allowed TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_access_request TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_allowed_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_access_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_access_request TO authenticated;
GRANT SELECT ON public.pending_access_requests TO authenticated;
GRANT SELECT ON public.professional_profiles TO authenticated;

-- Create a function to add yourself as an admin (for initial setup)
-- This should be run once and then dropped for security
CREATE OR REPLACE FUNCTION public.make_me_admin()
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.make_me_admin TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.make_me_admin IS 'Temporary function to make the current user an admin. Should be dropped after initial setup.';