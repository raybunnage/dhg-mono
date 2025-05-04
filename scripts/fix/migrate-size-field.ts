import { getSupabaseClient } from '../../packages/cli/src/services/supabase-client';
import { Logger } from '../../packages/cli/src/utils/logger';

/**
 * This script migrates the size field from metadata.size to metadata.file_size
 * in the documentation_files table. It only modifies the metadata JSON field,
 * not the table structure.
 */
async function migrateSizeField() {
  try {
    Logger.info('Starting size field migration process');
    
    // Get the Supabase client using the client service (handles all environment loading)
    const supabase = getSupabaseClient(true);
    
    // First get all records with size in metadata
    const { data: records, error: fetchError } = await supabase
      .from('documentation_files')
      .select('id, file_path, metadata')
      .not('metadata->size', 'is', null);
      
    if (fetchError) throw fetchError;
    
    Logger.info(`Found ${records?.length || 0} records with size in metadata`);
    
    if (!records || records.length === 0) {
      Logger.info('No records to update');
      return;
    }
    
    // Track stats for reporting
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          const { metadata } = record;
          const size = metadata?.size;
          
          // Debug: Print the metadata to see what's going on
          Logger.info(`Record ${record.id} metadata: ${JSON.stringify(metadata)}`);
          
          // Skip if size is undefined
          if (size === undefined) {
            skippedCount++;
            continue;
          }
          
          // IMPORTANT: Copy size value to file_size, even if file_size already exists
          // We want to ensure all records have metadata.size moved to metadata.file_size
          metadata.file_size = size;
          delete metadata.size;
          
          // Update the record with modified metadata
          const { error: updateError } = await supabase
            .from('documentation_files')
            .update({
              metadata: metadata
            })
            .eq('id', record.id);
            
          if (updateError) {
            Logger.error(`Error updating record ${record.id}:`, updateError);
            errorCount++;
            continue;
          }
          
          Logger.info(`Updated record ${record.id}: moved size (${size}) to file_size`);
          updatedCount++;
        } catch (error) {
          Logger.error(`Error processing record ${record.id}:`, error);
          errorCount++;
        }
      }
      
      Logger.info(`Processed batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(records.length/batchSize)}`);
    }
    
    // Final report
    Logger.info('Migration complete');
    Logger.info(`Updated: ${updatedCount} records`);
    Logger.info(`Skipped: ${skippedCount} records`);
    Logger.info(`Errors: ${errorCount} records`);
    
  } catch (error) {
    Logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateSizeField();