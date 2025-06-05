/**
 * Supabase client for dhg-hub
 * Uses the universal adapter which automatically handles environment detection
 */

import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Create and export the Supabase client using the universal adapter
export const supabase = createSupabaseAdapter();

// Re-export helper functions from shared service
export { SYSTEM_USER_ID, addUserReferences } from '@shared/services/supabase-helpers';