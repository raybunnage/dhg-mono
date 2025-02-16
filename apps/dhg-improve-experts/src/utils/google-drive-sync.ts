import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../../supabase/types';
import { toast } from 'react-hot-toast';

type SourcesGoogle = Database['public']['Tables']['sources_google']['Row'];
type SourcesGoogleInsert = Database['public']['Tables']['sources_google']['Insert'];

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  // ... other Google Drive file fields
}

export const syncGoogleDriveFiles = async (accessToken: string, folderId: string) => {
  try {
    // Start progress toast
    const toastId = toast.loading('Starting Google Drive sync...');
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&fields=files(id,name,mimeType,parents,size,modifiedTime,webViewLink)&pageSize=1000`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();
    const files: DriveFile[] = data.files;

    toast.loading(`Found ${files.length} files. Getting existing records...`, { id: toastId });

    // Get existing files
    const { data: existingFiles, error: existingError } = await supabase
      .from('sources_google')
      .select('drive_id, metadata')
      .eq('deleted', false);

    if (existingError) throw existingError;

    const existingFileMap = new Map(
      existingFiles?.map(f => [f.drive_id, f]) || []
    );

    let added = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Process files with progress updates
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = Math.round((i / files.length) * 100);
      
      if (i % 10 === 0) { // Update toast every 10 files
        toast.loading(
          `Processing files: ${progress}% (${i}/${files.length})
           Added: ${added}, Updated: ${updated}, Errors: ${errors}`, 
          { id: toastId }
        );
      }

      const existingFile = existingFileMap.get(file.id);
      const metadata = {
        size: file.size,
        modifiedTime: file.modifiedTime,
      };

      try {
        if (existingFile) {
          if (JSON.stringify(existingFile.metadata) !== JSON.stringify(metadata)) {
            await supabase
              .from('sources_google')
              .update({
                metadata,
                updated_at: new Date().toISOString()
              })
              .eq('drive_id', file.id);
            updated++;
          } else {
            skipped++;
          }
        } else {
          await supabase
            .from('sources_google')
            .insert([{
              drive_id: file.id,
              name: file.name,
              mime_type: file.mimeType,
              web_view_link: file.webViewLink,
              metadata,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);
          added++;
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errors++;
      }
    }

    // Show final results
    toast.success(
      `Sync complete!
       Total: ${files.length}
       Added: ${added}
       Updated: ${updated}
       Skipped: ${skipped}
       Errors: ${errors}`, 
      { id: toastId, duration: 5000 }
    );

    return {
      success: true,
      message: `Sync complete`,
      stats: { total: files.length, added, updated, skipped, errors }
    };
  } catch (error) {
    console.error('Error syncing Google Drive files:', error);
    toast.error('Failed to sync files: ' + (error as Error).message);
    return {
      success: false,
      message: 'Failed to sync files',
      error
    };
  }
}; 