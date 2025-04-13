import { SupabaseClient } from '../supabase-client';
import { PathUpdate } from './path-normalizer';

export async function updateFilePaths(
  supabase: SupabaseClient, 
  paths: PathUpdate[]
): Promise<{
  successCount: number;
  failureCount: number;
}> {
  let successCount = 0;
  let failureCount = 0;
  
  const batchSize = 10;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    
    const updatePromises = batch.map(async (item) => {
      try {
        const { error } = await supabase
          .from('documentation_files')
          .update({ file_path: item.normalizedPath })
          .eq('id', item.id);
          
        if (error) {
          console.error(`Error updating record ${item.id}: ${error.message}`);
          failureCount++;
          return false;
        }
        
        successCount++;
        return true;
      } catch (error) {
        console.error(`Exception updating record ${item.id}:`, error instanceof Error ? error.message : 'Unknown error');
        failureCount++;
        return false;
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`Processed ${Math.min(i + batchSize, paths.length)} of ${paths.length} records...`);
  }
  
  return { successCount, failureCount };
} 