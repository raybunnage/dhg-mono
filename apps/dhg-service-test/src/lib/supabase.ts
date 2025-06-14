import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Create Supabase client using the universal adapter
// Pass the environment variables from Vite
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});