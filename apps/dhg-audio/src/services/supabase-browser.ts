/**
 * @deprecated This file is deprecated. Use imports from '@/lib/supabase' instead.
 * 
 * This file now re-exports from the central supabase instance to maintain
 * backward compatibility while we migrate all imports.
 */

// Re-export from the central supabase instance
export { supabaseBrowserClient, getSupabase, supabase } from '../lib/supabase';