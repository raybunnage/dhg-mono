// Using the shared Supabase adapter for cross-environment compatibility
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';

console.log('=== Supabase Client Setup ===');
console.log('Using shared Supabase adapter for cross-environment compatibility');

// Browser apps MUST pass environment variables to the adapter
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});
console.log('Supabase client created successfully using shared adapter');