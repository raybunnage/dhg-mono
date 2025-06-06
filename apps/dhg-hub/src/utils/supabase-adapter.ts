/**
 * Supabase client for dhg-hub
 * Uses the universal adapter which automatically handles environment detection
 */

import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Create and export the Supabase client using the universal adapter
// Browser apps MUST pass their environment variables to the adapter
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any,
  // DEBUGGING: Disable auto refresh to see if this stops the flashing
  authConfig: {
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Debug log when client is created
console.log('🔧 SUPABASE CLIENT CREATED WITH DISABLED AUTO REFRESH');