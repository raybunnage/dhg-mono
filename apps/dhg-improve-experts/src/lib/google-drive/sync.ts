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
  let rootFolderId = null;  // Store the root folder's ID
  console.log('----------------------------------------');
  console.log(`Starting sync at depth ${currentDepth}`);
  console.log(`Folder ID: ${folderId}`);
  console.log(`Parent path: ${parentPath.join(' > ')}`);

  // Get folder metadata first
  const folderData = await getGoogleDriveFolder(folderId);
  console.log(`Got folder metadata: ${folderData.name} (${folderData.id})`);

  // Save folder info first
  try {
    console.log(`Saving folder: ${folderData.name}`);
    console.log(`Is root: ${currentDepth === 0}`);
    // If this is the root folder, store its ID
    if (currentDepth === 0) {
      rootFolderId = folderData.id;
    }
    await sourcesGoogleService.upsertSource({
      drive_id: folderData.id,
      name: folderData.name,
      mime_type: folderData.mimeType,
      web_view_link: folderData.webViewLink,
      parent_folder_id: currentDepth === 0 ? null : folderId,  // Link to immediate parent
      is_root: currentDepth === 0,
      path: [...parentPath, folderData.name],
      metadata: folderData
    });
    console.log(`Successfully saved folder: ${folderData.name}`);
  } catch (error) {
    console.error(`Error saving folder ${folderData.name}:`, error);
    console.error('Full folder data:', folderData);
    throw error;
  }

  // Get folder contents
  const { files } = await listDriveContents(folderId);
  console.log(`Found ${files.length} items in ${folderData.name}:`);
  files.forEach(f => console.log(`- ${f.name} (${f.mimeType})`));
  
  // Process each item
  for (const file of files) {
    const path = [...parentPath, folderData.name, file.name];
    
    try {
      console.log(`Saving item: ${file.name}`);
      console.log(`Parent folder: ${folderData.name} (${folderData.id})`);
      // Save file/folder to database
      await sourcesGoogleService.upsertSource({
        drive_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        web_view_link: file.webViewLink,
        parent_folder_id: currentDepth === 0 ? rootFolderId : folderData.id,  // Link to current folder
        is_root: false,
        path,
        metadata: file
      });
      console.log(`Successfully saved item: ${file.name}`);
    } catch (error) {
      console.error(`Error saving item ${file.name}:`, error);
      console.error('Full item data:', file);
      throw error;
    }

    // Recursively process folders up to maxDepth
    if (file.mimeType.includes('folder') && currentDepth < maxDepth) {
      console.log(`\nProcessing subfolder: ${file.name} at depth ${currentDepth + 1}`);
      await syncGoogleFolderWithDepth(
        file.id, 
        maxDepth, 
        currentDepth + 1, 
        [...parentPath, folderData.name]
      );
    }
  }
  console.log(`\nCompleted sync of folder: ${folderData.name}`);
  console.log('----------------------------------------');
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
}

async function syncGoogleDriveContents(folderId: string) {
  const files = await listAllDriveContents(folderId);
  const processedFiles = buildFileHierarchy(files);
  
  // Batch insert into Supabase
  const { data, error } = await supabase
    .from('sources_google')
    .upsert(processedFiles.map(file => ({
      drive_id: file.id,
      name: file.name,
      path: file.path,
      mime_type: file.mimeType,
      parent_folder_id: file.parentId,
      storage_type: 'reference',
      processing_status: shouldProcess(file.mimeType) ? 'pending' : 'skipped',
      file_metadata: {
        size: file.size,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }
    })));

  if (error) throw error;
  return data;
}

function shouldProcess(mimeType: string): boolean {
  return [
    'application/pdf',
    'application/vnd.google-apps.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ].includes(mimeType);
} 