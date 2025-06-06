/**
 * Supabase client for dhg-hub
 * Uses the universal adapter which automatically handles environment detection
 */

import { createSupabaseAdapter } from '../../../../../packages/shared/adapters/supabase-adapter';

// Create and export the Supabase client using the universal adapter
// Browser apps MUST pass their environment variables to the adapter
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});