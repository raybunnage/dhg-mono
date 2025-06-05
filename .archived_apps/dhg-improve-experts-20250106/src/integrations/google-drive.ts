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
  let pageToken: string | undefined;
  
  try {
    console.log('Starting Google Drive source population...');
    
    do {
      // Get batch of files
      const { files, nextPageToken } = await listDriveContents(folderId, pageToken);
      console.log(`Found ${files.length} files in current batch`);
      
      // Process each file in this batch
      for (const file of files) {
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
          .from('google_sources')
          .upsert(sourceData, {
            onConflict: 'drive_id',
            returning: true
          });

        if (error) {
          console.error('Error inserting source:', error);
          continue;
        }

        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`Processed ${processedCount} files...`);
        }
      }

      pageToken = nextPageToken;
    } while (pageToken); // Continue while there are more pages

    console.log(`Completed processing ${processedCount} files`);
    return processedCount;

  } catch (error) {
    console.error('Error populating sources:', error);
    throw error;
  }
}

// Update listDriveContents to handle pagination
export async function listDriveContents(folderId: string, pageToken?: string) {
  const accessToken = await getValidAccessToken();
  
  try {
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents` +
      '&fields=nextPageToken,files(id,name,mimeType,webViewLink,parents,createdTime,modifiedTime,size,md5Checksum)' +
      '&orderBy=folder,name desc' +
      '&pageSize=1000'; // Maximum page size for efficiency

    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      files: data.files,
      nextPageToken: data.nextPageToken
    };
  } catch (error) {
    console.error('\n Error fetching drive contents:', error);
    throw error;
  }
} 