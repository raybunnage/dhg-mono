-- Migration: Add public access to allowed_emails for light auth service
-- Description: Allows the light auth service to check and insert allowed emails without authentication

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can check allowed emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Public can insert allowed emails" ON public.allowed_emails;

-- Create policy to allow public to check if email is allowed (for light auth)
CREATE POLICY "Public can check allowed emails"
  ON public.allowed_emails FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Create policy to allow public to insert allowed emails (for light auth auto-registration)
CREATE POLICY "Public can insert allowed emails"
  ON public.allowed_emails FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.allowed_emails TO anon;

-- Add helpful comment
COMMENT ON POLICY "Public can check allowed emails" ON public.allowed_emails IS 'Allows light auth service to check if emails are allowed without authentication';
COMMENT ON POLICY "Public can insert allowed emails" ON public.allowed_emails IS 'Allows light auth service to auto-register users without authentication';