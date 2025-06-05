/**
 * Supabase Client Service
 * 
 * This file re-exports the universal adapter that works in both browser and Node.js environments.
 * This provides a consistent interface for all applications, regardless of their environment.
 */

// Re-export everything from the universal adapter
export * from './universal';

// Add a deprecation notice for developers using the old client directly
import { SupabaseClientService as OldService } from '../supabase-client';

/**
 * @deprecated Use the universal adapter instead:
 * import { supabase, supabaseAdapter } from 'path/to/packages/shared/services/supabase-client'
 */
export const SupabaseClientService = OldService;