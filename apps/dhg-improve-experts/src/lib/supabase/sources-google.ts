import { supabase } from './client'
import type { SourceGoogle, SourceGoogleInsert, SourceGoogleUpdate } from './types'

export const sourcesGoogleService = {
  async upsertSource(source: SourceGoogleInsert) {
    const session = await supabase.auth.getSession()
    const userId = session.data.session?.user?.id

    const { data, error } = await supabase
      .from('sources_google')
      .upsert(
        { 
          ...source,
          created_by: userId || null,
          updated_by: userId || null
        },
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
    const session = await supabase.auth.getSession()
    const userId = session.data.session?.user?.id

    const { data, error } = await supabase
      .from('sources_google')
      .update({
        ...updates,
        updated_by: userId || null
      })
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