-- Migration: Add email allowlist authentication system
-- Description: Creates tables for managing allowed emails and access requests,
-- plus enhanced user profiles for professional information

-- Create allowed_emails table for managing the email allowlist
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  organization TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index on email for fast lookups
CREATE INDEX idx_allowed_emails_email ON public.allowed_emails(email);
CREATE INDEX idx_allowed_emails_active ON public.allowed_emails(is_active) WHERE is_active = true;

-- Create access_requests table for users not on the allowlist
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  profession TEXT,
  professional_interests TEXT,
  organization TEXT,
  reason_for_access TEXT,
  request_date TIMESTAMPTZ DEFAULT NOW(),
  approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  denied BOOLEAN DEFAULT false,
  denied_at TIMESTAMPTZ,
  denied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  denial_reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for access_requests
CREATE INDEX idx_access_requests_email ON public.access_requests(email);
CREATE INDEX idx_access_requests_approved ON public.access_requests(approved) WHERE approved = false AND denied = false;
CREATE INDEX idx_access_requests_date ON public.access_requests(request_date DESC);

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

-- Create view for pending access requests
CREATE OR REPLACE VIEW public.pending_access_requests AS
SELECT 
  ar.*,
  CASE 
    WHEN ar.professional_interests IS NOT NULL THEN 
      string_to_array(ar.professional_interests, ',')
    ELSE 
      ARRAY[]::TEXT[]
  END as interests_array
FROM public.access_requests ar
WHERE ar.approved = false 
  AND ar.denied = false
ORDER BY ar.request_date DESC;

-- Create view for user profiles with professional info
CREATE OR REPLACE VIEW public.professional_profiles AS
SELECT 
  up.*,
  u.email,
  u.created_at as user_created_at,
  CASE 
    WHEN up.professional_interests IS NOT NULL THEN 
      string_to_array(up.professional_interests, ',')
    ELSE 
      ARRAY[]::TEXT[]
  END as interests_array,
  COALESCE(up.onboarding_completed, false) as has_completed_profile
FROM public.user_profiles up
JOIN auth.users u ON up.id = u.id;

-- RLS Policies

-- Enable RLS on tables
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Create simple user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create index for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Enable RLS on user_roles
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
-- Anyone can check if an email is allowed (via function)
-- Only authenticated users with admin role can view/modify the list
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
-- Anyone can submit an access request (handled by function)
-- Users can view their own requests
-- Admins can view and manage all requests
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

-- Add some helpful comments
COMMENT ON TABLE public.allowed_emails IS 'List of email addresses allowed to access the application without requesting access';
COMMENT ON TABLE public.access_requests IS 'Requests from users not on the allowed list who want access to the application';
COMMENT ON FUNCTION public.is_email_allowed IS 'Check if an email address is on the allowed list';
COMMENT ON FUNCTION public.submit_access_request IS 'Submit a request for access from a non-allowed email';
COMMENT ON VIEW public.pending_access_requests IS 'View of access requests that have not been approved or denied';
COMMENT ON VIEW public.professional_profiles IS 'Enhanced view of user profiles with professional information';

-- Insert sample allowed emails (optional - comment out if not needed)
-- INSERT INTO public.allowed_emails (email, name, notes) VALUES
-- ('admin@example.com', 'Admin User', 'System administrator'),
-- ('test@example.com', 'Test User', 'For testing purposes');