import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

console.log('=== Supabase Client Setup ===');

// Create Supabase client using the universal adapter
// Pass the environment variables from Vite
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});

console.log('Supabase client created successfully using universal adapter');