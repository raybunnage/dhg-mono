import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';

console.log('=== Supabase Client Setup ===');

// Create Supabase client using the universal adapter
// This automatically handles browser environment configuration
export const supabase = createSupabaseAdapter();

console.log('Supabase client created successfully using universal adapter');