/**
 * Supabase client for dhg-admin-google
 * Uses the universal adapter which automatically handles environment detection
 */

import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Create and export the Supabase client using the universal adapter
// Browser apps MUST pass import.meta.env to the adapter
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});

// Re-export helper functions from shared service
export { SYSTEM_USER_ID, addUserReferences } from '@shared/services/supabase-helpers';

// Export convenience aliases for backward compatibility
export const supabaseAdapter = { getClient: () => supabase };
export const getSupabaseClient = () => supabase;