import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';

// Create Supabase client using the universal adapter
// Pass the environment variables from Vite (required for browser apps)
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});