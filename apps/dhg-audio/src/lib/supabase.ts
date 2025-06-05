import { createSupabaseAdapter } from '../../../packages/shared/adapters/supabase-adapter';

// Create Supabase client using the universal adapter
// This automatically handles browser environment configuration
export const supabase = createSupabaseAdapter();