-- Authentication Service Database Schema
-- 
-- This migration creates the necessary tables for the authentication service

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);

-- Create CLI authentication tokens table
CREATE TABLE IF NOT EXISTS public.cli_auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for cli_auth_tokens
CREATE INDEX IF NOT EXISTS idx_cli_auth_tokens_user_id ON public.cli_auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_cli_auth_tokens_token_hash ON public.cli_auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_cli_auth_tokens_expires_at ON public.cli_auth_tokens(expires_at);

-- Create authentication audit log table
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login',
    'logout',
    'login_failed',
    'token_created',
    'token_revoked',
    'password_changed',
    'profile_updated',
    'session_refreshed'
  )),
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for auth_audit_log
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON public.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON public.auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON public.auth_audit_log(created_at DESC);

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cli_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- User profiles policies
-- Users can view and update their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- CLI auth tokens policies
-- Users can view and manage their own tokens
CREATE POLICY "Users can view own tokens"
  ON public.cli_auth_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tokens"
  ON public.cli_auth_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON public.cli_auth_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON public.cli_auth_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Auth audit log policies
-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.auth_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert audit logs (for backend logging)
CREATE POLICY "Service role can insert audit logs"
  ON public.auth_audit_log
  FOR INSERT
  WITH CHECK (true);

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to clean up expired CLI tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_cli_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.cli_auth_tokens
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to clean up expired tokens
-- This requires pg_cron extension (available in Supabase)
-- Uncomment if you want automatic cleanup
/*
SELECT cron.schedule(
  'cleanup-expired-cli-tokens',
  '0 0 * * *', -- Run daily at midnight
  'SELECT public.cleanup_expired_cli_tokens();'
);
*/

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.cli_auth_tokens TO authenticated;
GRANT SELECT ON public.auth_audit_log TO authenticated;
GRANT INSERT ON public.auth_audit_log TO service_role;

-- Create views for easier access

-- View for user details with profile
CREATE OR REPLACE VIEW public.user_details AS
SELECT 
  u.id,
  u.email,
  u.created_at as user_created_at,
  u.last_sign_in_at,
  p.full_name,
  p.preferences,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id;

-- Grant access to the view
GRANT SELECT ON public.user_details TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.user_profiles IS 'Extended user profile information';
COMMENT ON TABLE public.cli_auth_tokens IS 'CLI authentication tokens for programmatic access';
COMMENT ON TABLE public.auth_audit_log IS 'Audit trail for authentication events';
COMMENT ON COLUMN public.cli_auth_tokens.token_hash IS 'SHA-256 hash of the actual token';
COMMENT ON COLUMN public.auth_audit_log.event_type IS 'Type of authentication event that occurred';