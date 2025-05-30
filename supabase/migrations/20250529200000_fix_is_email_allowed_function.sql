-- Migration: Fix auth functions to use renamed tables
-- Description: Updates auth functions to use auth_allowed_emails table instead of allowed_emails

-- Drop the old functions if they exist
DROP FUNCTION IF EXISTS public.is_email_allowed(TEXT);
DROP FUNCTION IF EXISTS public.add_allowed_email(TEXT, TEXT, TEXT, TEXT, UUID);

-- Create the updated is_email_allowed function using the correct table name
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.auth_allowed_emails 
    WHERE LOWER(email) = LOWER(check_email) 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the updated add_allowed_email function using the correct table name
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
  INSERT INTO public.auth_allowed_emails (email, name, organization, notes, added_by)
  VALUES (LOWER(p_email), p_name, p_organization, p_notes, p_added_by)
  ON CONFLICT (email) 
  DO UPDATE SET 
    is_active = true,
    name = COALESCE(EXCLUDED.name, auth_allowed_emails.name),
    organization = COALESCE(EXCLUDED.organization, auth_allowed_emails.organization),
    notes = COALESCE(EXCLUDED.notes, auth_allowed_emails.notes)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to appropriate roles
GRANT EXECUTE ON FUNCTION public.is_email_allowed TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_allowed_email TO authenticated;

-- Add comments explaining the functions
COMMENT ON FUNCTION public.is_email_allowed IS 'Checks if an email address is in the auth_allowed_emails table and is active';
COMMENT ON FUNCTION public.add_allowed_email IS 'Adds an email to the auth_allowed_emails table or updates existing entry';