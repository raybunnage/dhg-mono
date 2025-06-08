// This file now uses the shared Supabase adapter for cross-environment compatibility
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Browser apps MUST pass environment variables to the adapter
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});