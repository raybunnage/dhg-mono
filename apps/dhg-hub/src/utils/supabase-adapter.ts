/**
 * Supabase client for dhg-hub
 * Uses the universal adapter which automatically handles environment detection
 */

import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Track how many times the client is accessed
let clientAccessCount = 0;

// Create the Supabase client using the universal adapter
const _supabaseClient = createSupabaseAdapter({
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

// Proxy the client to track usage
export const supabase = new Proxy(_supabaseClient, {
  get(target, prop) {
    clientAccessCount++;
    if (clientAccessCount % 10 === 0) { // Log every 10th access
      console.log(`📊 SUPABASE ACCESS #${clientAccessCount}: ${String(prop)}`);
      if (clientAccessCount % 50 === 0) {
        console.trace('Supabase access stack trace (every 50th access)');
      }
    }
    return target[prop as keyof typeof target];
  }
});