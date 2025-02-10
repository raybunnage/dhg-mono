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

async function listDriveContents(folderId: string) {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&fields=files(id,name,mimeType,webViewLink)`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch drive contents');
  }

  return response.json();
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

export async function syncGoogleFolderWithDepth(
  folderId: string, 
  maxDepth = 2, 
  currentDepth = 0, 
  parentPath: string[] = []
) {
  // Get folder metadata first
  const folderData = await getGoogleDriveFolder(folderId);
  console.log(`Syncing folder: ${folderData.name} at depth ${currentDepth}`);

  // Save folder info
  await sourcesGoogleService.upsertSource({
    drive_id: folderData.id,
    name: folderData.name,
    mime_type: folderData.mimeType,
    web_view_link: folderData.webViewLink,
    parent_folder_id: currentDepth === 0 ? null : parentPath[parentPath.length - 1],
    is_root: currentDepth === 0,
    path: [...parentPath, folderData.name],
    metadata: folderData
  });

  // Get folder contents
  const { files } = await listDriveContents(folderId);
  console.log(`Found ${files.length} items in ${folderData.name}`);
  
  // Process each item
  for (const file of files) {
    const path = [...parentPath, folderData.name, file.name];
    
    // Save file/folder to database
    await sourcesGoogleService.upsertSource({
      drive_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      web_view_link: file.webViewLink,
      parent_folder_id: folderId,
      is_root: false,
      path,
      metadata: file
    });

    // Recursively process folders up to maxDepth
    if (file.mimeType.includes('folder') && currentDepth < maxDepth) {
      console.log(`Going deeper into folder: ${file.name}`);
      await syncGoogleFolderWithDepth(
        file.id, 
        maxDepth, 
        currentDepth + 1, 
        [...parentPath, folderData.name]
      );
    }
  }
} 