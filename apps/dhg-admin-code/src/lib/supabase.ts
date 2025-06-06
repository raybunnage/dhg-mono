import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

console.log('=== Supabase Client Setup ===');
console.log('Environment variables:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'exists' : 'missing',
  allEnvKeys: Object.keys(import.meta.env).filter(k => k.includes('SUPABASE'))
});

// Create Supabase client using the universal adapter
// Pass the environment variables from Vite
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});

console.log('Supabase client created successfully using universal adapter');