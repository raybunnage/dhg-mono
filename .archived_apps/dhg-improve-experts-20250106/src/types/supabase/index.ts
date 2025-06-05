import { Database } from '../../../../../supabase/types'

// Derived types from your Supabase database
export type Expert = Database['public']['Tables']['experts']['Row']
export type DocumentType = Database['public']['Tables']['uni_document_types']['Row']
export type Source = Database['public']['Tables']['sources']['Row']
export type Domain = Database['public']['Tables']['domains']['Row']

// Common response types
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// Auth types
export interface UserSession {
  user: {
    id: string
    email?: string | undefined  // Made email optional to match Supabase User type
  } | null
  session: any | null
}