import { supabase } from './client'
import type { SourceGoogle, SourceGoogleInsert, SourceGoogleUpdate } from './types'
import { drive_v3 } from '@googleapis/drive'

export const sourcesGoogleService = {
  async upsertSource(source: SourceGoogleInsert) {
    const { data, error } = await supabase
      .from('sources_google')
      .upsert(
        source,
        { onConflict: 'drive_id', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) throw error
    return data as SourceGoogle
  },

  async getByDriveId(driveId: string) {
    const { data, error } = await supabase
      .from('sources_google')
      .select()
      .eq('drive_id', driveId)
      .single()

    if (error) throw error
    return data as SourceGoogle
  },

  async getChildren(parentId: string) {
    const { data, error } = await supabase
      .from('sources_google')
      .select()
      .eq('parent_folder_id', parentId)
      .order('name')

    if (error) throw error
    return data as SourceGoogle[]
  },

  async updateSource(driveId: string, updates: SourceGoogleUpdate) {
    const { data, error } = await supabase
      .from('sources_google')
      .update(updates)
      .eq('drive_id', driveId)
      .select()
      .single()

    if (error) throw error
    return data as SourceGoogle
  },

  async updateLastIndexed(driveId: string) {
    return this.updateSource(driveId, {
      last_indexed: new Date().toISOString()
    })
  },

  async getByPath(path: string[]) {
    const { data, error } = await supabase
      .from('sources_google')
      .select()
      .contains('path', path)

    if (error) throw error
    return data as SourceGoogle[]
  }
}

export async function insertGoogleDriveFolder(folder: drive_v3.Schema$File) {
  const { data, error } = await supabase
    .from('sources_google')
    .insert({
      drive_id: folder.id,
      name: folder.name,
      mime_type: folder.mimeType,
      web_view_link: folder.webViewLink,
      is_root: true,
      path: [folder.name],
      metadata: folder
    })
    .select()
    .single()

  if (error) throw error
  return data
} 