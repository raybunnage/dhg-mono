import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';
import type { Database } from '../../../../supabase/types';

// Create Supabase client using the universal adapter
// Pass the environment variables from Vite (required for browser apps)
// This is the ONLY Supabase client instance for the entire dhg-audio app
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
}) as any; // Type assertion for Database types when needed

// Export convenience aliases for backward compatibility during migration
export const supabaseBrowser = { getClient: () => supabase };
export const supabaseBrowserClient = { 
  getInstance: () => ({ getClient: () => supabase }),
  getClient: () => supabase 
};
export const getSupabase = () => supabase;