export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type { Database } from '../../../../supabase/types'

export type SourceGoogle = Database['public']['Tables']['sources_google']['Row'];
