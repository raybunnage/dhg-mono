import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

export const createSupabaseClient = (url: string, key: string) => {
  return createClient<Database>(url, key)
} 