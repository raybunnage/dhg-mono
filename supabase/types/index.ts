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
  metadata: any
}

export interface Database {
  public: {
    Tables: {
      sources_google: {
        Row: SourceGoogle
        Insert: Omit<SourceGoogle, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SourceGoogle, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
} 