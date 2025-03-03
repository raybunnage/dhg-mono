import { supabase } from '@/integrations/supabase/client'
import type { SourceGoogle } from '../../../../../supabase/types'
import type { ExpertFolder } from '@/components/ExpertFolderAnalysis'

export async function getExpertFolders() {
  const { data, error } = await supabase
    .from('sources_google')
    .select('*')
    .eq('is_root', false)
    .in('mime_type', [
      'application/vnd.google-apps.document',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ])
    .order('path')

  if (error) throw error

  // Group by parent folder
  const folderMap = new Map<string, ExpertFolder>()
  
  data?.forEach(file => {
    const parentPath = file.path.slice(0, -1).join('/')
    if (!folderMap.has(parentPath)) {
      folderMap.set(parentPath, {
        id: file.parent_folder_id || 'root',
        name: file.path[file.path.length - 2] || 'Root',
        path: file.path.slice(0, -1),
        documents: { docx: [], pdf: [] }
      })
    }

    const folder = folderMap.get(parentPath)!
    const fileType = file.mime_type.includes('pdf') ? 'pdf' : 'docx'
    folder.documents[fileType].push({
      id: file.id,
      name: file.name,
      path: file.path.join('/')
    })
  })

  return Array.from(folderMap.values())
} 