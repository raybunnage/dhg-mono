export interface SourceGoogle {
  id: string
  drive_id: string
  name: string
  mime_type: string
  web_view_link?: string
  parent_folder_id?: string
  is_root: boolean
  path: string[]
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
  last_indexed?: string
  metadata?: Record<string, any>
}

export type SourceGoogleInsert = Omit<SourceGoogle, 'id' | 'created_at' | 'updated_at'> & {
  created_by?: string | null
  updated_by?: string | null
}
export type SourceGoogleUpdate = Partial<Omit<SourceGoogleInsert, 'created_by'>> & {
  updated_by?: string | null
} 