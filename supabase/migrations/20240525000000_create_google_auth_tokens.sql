-- Create table for storing Google authentication tokens
CREATE TABLE IF NOT EXISTS public.google_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for the table
ALTER TABLE public.google_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select their own tokens
CREATE POLICY "Users can view their own tokens" 
  ON public.google_auth_tokens 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own tokens
CREATE POLICY "Users can insert their own tokens" 
  ON public.google_auth_tokens 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own tokens
CREATE POLICY "Users can update their own tokens" 
  ON public.google_auth_tokens 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.google_auth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_audit_timestamps(); 