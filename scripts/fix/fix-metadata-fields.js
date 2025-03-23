/**
 * This script directly updates the metadata field in the documentation_files table
 * to replace 'size' with 'file_size' and ensure all records have a created date
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function updateMetadataFields() {
  // Load environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Fetching all documentation files...');
  
  // Get all documentation files with their metadata
  const { data, error } = await supabase
    .from('documentation_files')
    .select('id, file_path, metadata');
    
  if (error) {
    console.error('Error fetching files:', error);
    process.exit(1);
  }
  
  console.log(`Found ${data.length} files in the database.`);
  
  // Create update batches (smaller to avoid timeout issues)
  const BATCH_SIZE = 20;
  const batches = [];
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    batches.push(data.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Split into ${batches.length} batches of ${BATCH_SIZE} files each.`);
  
  // Process each batch
  let successCount = 0;
  let errorCount = 0;
  let sizeConversionCount = 0;
  let createdAddedCount = 0;
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length}...`);
    
    // Process each file in the batch
    for (const file of batch) {
      try {
        const { id, file_path, metadata } = file;
        
        // Skip files that don't exist
        const fullPath = path.resolve(process.cwd(), file_path);
        if (!fs.existsSync(fullPath)) {
          console.log(`File doesn't exist, skipping: ${file_path}`);
          continue;
        }

        // Get file stats
        const stats = fs.statSync(fullPath);
        const now = new Date().toISOString();
        
        // Create a new metadata object or use existing one
        const updatedMetadata = metadata ? { ...metadata } : {};
        let changesMade = false;
        
        // Check if there's a 'size' field to convert
        if (updatedMetadata.size !== undefined) {
          console.log(`Converting 'size' (${updatedMetadata.size}) to 'file_size' for ${file_path}`);
          updatedMetadata.file_size = updatedMetadata.size;
          delete updatedMetadata.size;
          sizeConversionCount++;
          changesMade = true;
        } else if (!updatedMetadata.file_size) {
          // If no file_size exists, add it
          console.log(`Adding missing file_size for ${file_path}`);
          updatedMetadata.file_size = stats.size;
          sizeConversionCount++;
          changesMade = true;
        }
        
        // Check if there's a 'created' field
        if (!updatedMetadata.created) {
          // Use filesystem birthtime (creation time) if available, otherwise use ctime
          const created = stats.birthtime ? stats.birthtime.toISOString() : stats.ctime.toISOString();
          console.log(`Adding missing created date for ${file_path}: ${created}`);
          updatedMetadata.created = created;
          createdAddedCount++;
          changesMade = true;
        }
        
        // Only update if changes were made
        if (changesMade) {
          // Update the record
          const { error: updateError } = await supabase
            .from('documentation_files')
            .update({ 
              metadata: updatedMetadata,
              last_modified_at: now
            })
            .eq('id', id);
            
          if (updateError) {
            console.error(`Error updating metadata for ${file_path}:`, updateError);
            errorCount++;
          } else {
            console.log(`Successfully updated metadata for ${file_path}`);
            successCount++;
          }
        } else {
          console.log(`No changes needed for ${file_path}`);
        }
      } catch (err) {
        console.error(`Error processing file:`, err);
        errorCount++;
      }
    }
    
    // Add a small delay between batches to reduce API pressure
    if (batchIndex < batches.length - 1) {
      console.log('Pausing between batches...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\nMetadata Update Summary:');
  console.log(`Total files processed: ${data.length}`);
  console.log(`Size conversions: ${sizeConversionCount}`);
  console.log(`Created dates added: ${createdAddedCount}`);
  console.log(`Successful updates: ${successCount}`);
  console.log(`Failed updates: ${errorCount}`);
}

// Run the update function
updateMetadataFields().catch(error => {
  console.error('Error in updateMetadataFields:', error);
  process.exit(1);
});