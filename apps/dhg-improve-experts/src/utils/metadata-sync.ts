import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import type { Database } from '../../../../../supabase/types';

type SourcesGoogle = Database['public']['Tables']['sources_google']['Row'];

export const syncFileMetadata = async (accessToken: string) => {
  const toastId = toast.loading('Starting metadata sync...');
  
  try {
    // First get all files from sources_google
    const { data: files, error } = await supabase
      .from('sources_google')
      .select('drive_id, name, metadata')
      .eq('deleted', false);
      
    if (error) throw error;
    
    toast.loading(`Found ${files.length} files to check...`, { id: toastId });
    
    let updated = 0;
    let errors = 0;
    
    // Process files in batches of 10 to avoid rate limits
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = Math.round((i / files.length) * 100);
      
      if (i % 10 === 0) {
        toast.loading(
          `Processing: ${progress}% (${i}/${files.length})
           Updated: ${updated}, Errors: ${errors}`,
          { id: toastId }
        );
      }
      
      try {
        // Get file metadata from Google Drive
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.drive_id}?fields=size,modifiedTime`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata for ${file.name}`);
        }
        
        const metadata = await response.json();
        
        // Update the metadata in Supabase
        await supabase
          .from('sources_google')
          .update({
            metadata: {
              size: metadata.size,
              modifiedTime: metadata.modifiedTime,
            },
            updated_at: new Date().toISOString()
          })
          .eq('drive_id', file.drive_id);
          
        updated++;
        
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        errors++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    toast.success(
      `Metadata sync complete!
       Total files: ${files.length}
       Updated: ${updated}
       Errors: ${errors}`,
      { id: toastId, duration: 5000 }
    );
    
    return { success: true, updated, errors };
    
  } catch (error) {
    console.error('Metadata sync failed:', error);
    toast.error('Metadata sync failed: ' + (error as Error).message, { id: toastId });
    return { success: false, error };
  }
}; 