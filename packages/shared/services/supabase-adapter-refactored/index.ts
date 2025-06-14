/**
 * Refactored SupabaseAdapterService
 * Export the service and types
 */

export { 
  SupabaseAdapterService,
  createSupabaseAdapter,
  type SupabaseAdapterConfig
} from './SupabaseAdapterService';

export type { SupabaseClient } from '@supabase/supabase-js';