import { createSupabaseClient } from '../../../../../supabase/client'

// Verify environment variables exist
if (!import.meta.env.VITE_SUPABASE_URL) {
  throw new Error('Missing VITE_SUPABASE_URL')
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY')
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Re-export types
export type { SourceGoogle } from '../../../../../supabase/types' 