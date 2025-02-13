import { getValidAccessToken } from '../utils/google-auth';
import { supabase } from '@/integrations/supabase/client';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  parents?: string[];
}

export async function populateSourcesGoogle(expertId: string, folderId: string) {
  const accessToken = await getValidAccessToken();
  let processedCount = 0;
  const LIMIT = 100; // Limit to first 100 records
  
  try {
    // First get all files in the folder
    const files = await listDriveContents(folderId);
    
    console.log(`Found ${files.length} files, processing first ${LIMIT}`);
    
    // Process each file up to limit
    for (const file of files.slice(0, LIMIT)) {
      const sourceData = {
        drive_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        web_view_link: file.webViewLink,
        parent_folder_id: folderId,
        is_root: false,
        path: [folderId],
        expert_id: expertId,
        sync_status: 'pending',
        content_extracted: false,
        metadata: {
          driveData: file
        }
      };

      // Insert into sources_google using upsert
      const { data, error } = await supabase
        .from('sources_google')
        .upsert(sourceData, {
          onConflict: 'drive_id',
          returning: true
        });

      if (error) {
        console.error('Error inserting source:', error);
        continue;
      }

      processedCount++;
      console.log(`Processed ${processedCount}/${LIMIT}: ${file.name}`);
    }

    console.log(`Completed processing ${processedCount} files`);
    return processedCount;

  } catch (error) {
    console.error('Error populating sources:', error);
    throw error;
  }
}

// Update listDriveContents to get more metadata
export async function listDriveContents(folderId: string) {
  const accessToken = await getValidAccessToken();
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents` +
      '&fields=files(id,name,mimeType,webViewLink,parents,createdTime,modifiedTime,size,md5Checksum)' +
      '&orderBy=folder,name desc' +
      '&pageSize=100', { // Increased page size to match our limit
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.files;
  } catch (error) {
    console.error('\n Error fetching drive contents:', error);
    throw error;
  }
} 