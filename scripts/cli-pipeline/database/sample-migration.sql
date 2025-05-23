-- MIGRATION: auth_service_tables
-- VERSION: 20250522000000
-- DESCRIPTION: Authentication service tables and functions
-- AUTHOR: Claude Code Assistant

-- SECTION: extensions
-- Extensions that need to be enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SECTION: tables
-- Core table definitions

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CLI authentication tokens
CREATE TABLE IF NOT EXISTS public.cli_auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Authentication audit log
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

-- SECTION: indexes
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_cli_auth_tokens_user_id ON public.cli_auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_cli_auth_tokens_token_hash ON public.cli_auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_cli_auth_tokens_expires_at ON public.cli_auth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON public.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON public.auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON public.auth_audit_log(created_at DESC);

-- SECTION: functions
-- Database functions and triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create user profile on signup
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

-- Function to clean up expired CLI tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_cli_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.cli_auth_tokens
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECTION: triggers
-- Create trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- SECTION: rls
-- Row Level Security policies

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cli_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- User profiles policies
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
CREATE POLICY "Users can view own audit logs"
  ON public.auth_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit logs"
  ON public.auth_audit_log
  FOR INSERT
  WITH CHECK (true);

-- SECTION: grants
-- Permission grants
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.cli_auth_tokens TO authenticated;
GRANT SELECT ON public.auth_audit_log TO authenticated;
GRANT INSERT ON public.auth_audit_log TO service_role;

-- SECTION: views
-- Useful views for easier access

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