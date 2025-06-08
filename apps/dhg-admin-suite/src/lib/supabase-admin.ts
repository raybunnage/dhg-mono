import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Admin client using service role key for bypassing RLS
// This should only be used in admin contexts where we need full access

console.log('=== Supabase Admin Client Setup ===');

// Create admin client using the universal adapter with service role configuration
// Browser apps MUST pass their environment variables to the adapter
export const supabaseAdmin = createSupabaseAdapter({ 
  env: import.meta.env as any,
  useServiceRole: true,
  authConfig: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Supabase admin client created successfully using universal adapter');