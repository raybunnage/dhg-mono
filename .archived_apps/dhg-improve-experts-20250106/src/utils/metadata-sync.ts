import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import type { Database } from '../../../../../supabase/types';

type SourcesGoogle = Database['public']['Tables']['google_sources']['Row'];

export async function syncFileMetadata(accessToken: string) {
  const BATCH_SIZE = 50;
  let processed = 0;
  let failures = 0;
  let loadingToastId: string | undefined;
  const updates: Array<{
    name: string;
    id: string;
    oldMetadata: any;
    newMetadata: any;
  }> = [];

  try {
    // Get files with their current metadata
    const { data: files, error: fetchError } = await supabase
      .from('google_sources')
      .select('id, drive_id, name, metadata')  // Added name and metadata
      .eq('deleted', false)
      .order('id');

    if (fetchError) throw fetchError;
    if (!files?.length) {
      return { success: true, message: 'No files to process' };
    }

    console.log('Starting metadata sync:', {
      totalFiles: files.length,
      batchSize: BATCH_SIZE,
      batches: Math.ceil(files.length / BATCH_SIZE)
    });

    // Create initial loading toast and save its ID
    loadingToastId = toast.loading('Starting metadata sync...');

    for (const [batchIndex, batch] of files.reduce<Array<typeof files>>((acc, item, i) => {
      const idx = Math.floor(i / BATCH_SIZE);
      acc[idx] = [...(acc[idx] || []), item];
      return acc;
    }, []).entries()) {
      // Update the loading toast with batch progress
      toast.loading(
        `Batch ${batchIndex + 1}: ${processed} processed, ${failures} failed`, 
        { id: loadingToastId }
      );

      const batchPromises = batch.map(async (file) => {
        try {
          const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_id}?fields=size,quotaBytesUsed,fileSize,createdTime,modifiedTime,version,mimeType`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.status}`);
          }

          const newMetadata = await response.json();

          // Store the update for verification
          updates.push({
            name: file.name,
            id: file.id,
            oldMetadata: file.metadata,
            newMetadata
          });

          // Update database
          const { error: updateError } = await supabase
            .from('google_sources')
            .update({
              metadata: newMetadata,
              updated_at: new Date().toISOString()
            })
            .eq('id', file.id);

          if (updateError) throw updateError;
          processed++;

          // Log each successful update
          console.log(`Updated metadata for ${file.name}:`, {
            before: file.metadata,
            after: newMetadata,
            changes: Object.keys(newMetadata).filter(key => 
              JSON.stringify(file.metadata?.[key]) !== JSON.stringify(newMetadata[key])
            )
          });

        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
          failures++;
        }
      });

      await Promise.all(batchPromises);
      
      // Show detailed progress
      console.log(`Batch ${batchIndex + 1} complete:`, {
        processed,
        failures,
        updatesInBatch: updates.slice(-batch.length)
      });
    }

    // Dismiss loading toast and show success
    toast.dismiss(loadingToastId);
    toast.success(`Completed: ${processed} files processed, ${failures} failures`);

    // Show summary of changes
    const summary = {
      processed,
      failures,
      samplesOfChanges: updates.slice(0, 5).map(update => ({
        name: update.name,
        changes: Object.keys(update.newMetadata).filter(key => 
          JSON.stringify(update.oldMetadata?.[key]) !== JSON.stringify(update.newMetadata[key])
        )
      }))
    };

    console.log('Metadata sync complete:', summary);
    
    return { 
      success: true, 
      message: `Processed ${processed} files, ${failures} failures`,
      details: summary
    };

  } catch (error) {
    // Dismiss loading toast and show error
    toast.dismiss(loadingToastId);
    toast.error('Failed to sync metadata');
    
    console.error('Metadata sync failed:', error);
    return { 
      success: false, 
      message: error.message,
      details: { processed, failures, updates }
    };
  }
} 