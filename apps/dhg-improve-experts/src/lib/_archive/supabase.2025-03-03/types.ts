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
  last_indexed?: string
  metadata: any
}

export type SourceGoogleInsert = Omit<SourceGoogle, 'id' | 'created_at' | 'updated_at'>
export type SourceGoogleUpdate = Partial<SourceGoogleInsert> 