import { listDriveContents } from '@/lib/google-drive'
import { sourcesGoogleService } from '../supabase/sources-google'

export async function getGoogleDriveFolder(folderId: string): Promise<any> {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=*`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch folder data')
  }

  return response.json()
}

export async function syncGoogleFolder(folderId: string, parentPath: string[] = []) {
  // Get folder contents
  const { files } = await listDriveContents(folderId)
  
  // Process each item
  for (const file of files) {
    const path = [...parentPath, file.name]
    
    // Upsert to database
    await sourcesGoogleService.upsertSource({
      drive_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      web_view_link: file.webViewLink,
      parent_folder_id: folderId,
      is_root: parentPath.length === 0,
      path,
      metadata: file
    })

    // Recursively process folders
    if (file.mimeType.includes('folder')) {
      await syncGoogleFolder(file.id, path)
    }
  }
} 