// Using the shared Supabase adapter for cross-environment compatibility
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';

console.log('=== Supabase Client Setup ===');
console.log('Using shared Supabase adapter for cross-environment compatibility');

// The adapter automatically handles environment detection and uses the correct variables
export const supabase = createSupabaseAdapter();
console.log('Supabase client created successfully using shared adapter');