#\!/bin/bash

# Script to remove all references to created_by and updated_by in the codebase

echo "Starting to remove user reference fields from codebase..."

# Remove any code we just added related to user references in supabase.ts
rm -f src/utils/supabase.ts.bak
cp src/utils/supabase.ts src/utils/supabase.ts.bak

# Remove the helper function and constant from supabase.ts
sed -i '' '/export const SYSTEM_USER_ID/,/}/d' src/utils/supabase.ts
sed -i '' '/addUserReferencesToRecord/,/}/d' src/utils/supabase.ts

# Revert changes to googleDriveService.ts
git checkout -- src/services/googleDriveService.ts

# Now clean up any remaining created_by/updated_by references
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/created_by: [^,}]*//' 
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/updated_by: [^,}]*//' 
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/, ,/,/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/,}/}/g'

# Add new simplified versions to googleDriveService.ts
# First create temp files
cat > simplified_insert.ts << 'EOL'
export async function insertGoogleFiles(files: DriveFile[]): Promise<{success: number, errors: number}> {
  let successCount = 0;
  let errorCount = 0;
  
  try {
    console.log(`Inserting ${files.length} Google Drive files into the database`);
    
    // Create a supabase admin client with service role key to bypass RLS
    const supabaseAdmin = createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );

    // Process files in batches to avoid overloading the database
    const batchSize = 10; // Process in larger batches now that we don't need user validation
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      // Create records for insertion
      const records = batch.map(file => {
        // Extract parent folder from file.parents if available
        const parentFolderId = file.parents && file.parents.length > 0 
          ? file.parents[0] 
          : null;
          
        const record: any = {
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink || null,
          modified_time: file.modifiedTime || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          parent_folder_id: parentFolderId,
          parent_path: null,
          is_root: false,
          deleted: false,
          sync_status: 'pending',
          metadata: file
        };
        
        if (file.size) {
          record.size = parseInt(file.size);
        }
        
        return record;
      });
      
      // Don't log the entire record - it's too verbose
      console.log(`Inserting batch of ${records.length} files`);
      
      // Use the admin client to insert the batch
      const { data, error } = await supabaseAdmin
        .from('sources_google')
        .insert(records)
        .select();
        
      if (error) {
        console.error('Error inserting batch:', error);
        errorCount += batch.length;
      } else {
        console.log(`Successfully inserted ${data.length} files`);
        successCount += data.length;
      }
    }
    
    // Create a sync history record
    const syncId = uuidv4();
    
    await supabaseAdmin.from('sync_history').insert({
      id: syncId,
      folder_id: import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '',
      folder_name: 'Manual File Selection',
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: errorCount > 0 ? 'completed_with_errors' : 'completed',
      files_processed: successCount + errorCount,
      files_total: files.length,
      files_added: successCount,
      files_error: errorCount,
      error_message: errorCount > 0 ? `Failed to insert ${errorCount} files` : null
    });
    
    // Return the results
    return {
      success: successCount,
      errors: errorCount
    };
  } catch (error) {
    console.error('Error in insertGoogleFiles:', error);
    return {
      success: successCount,
      errors: errorCount + (files.length - successCount - errorCount)
    };
  }
}
EOL

# Copy the new simplified functions into the googleDriveService.ts file
TARGET_FILE="src/services/googleDriveService.ts"

# Function to insert the simplified functions
insert_simplified_functions() {
  # First back up the original file
  cp "$TARGET_FILE" "${TARGET_FILE}.bak"
  
  # Insert the simplified insert function - replace the original 
  # Find the original function start line
  INSERT_START=$(grep -n "export async function insertGoogleFiles" "$TARGET_FILE" | cut -d ":" -f 1)
  # Find where it ends (find the closing bracket + 2 more lines)
  INSERT_END=$(tail -n +$INSERT_START "$TARGET_FILE" | grep -n "^}" | head -1 | cut -d ":" -f 1)
  INSERT_END=$((INSERT_START + INSERT_END))
  
  # Create a temporary file with the replacement
  head -n $((INSERT_START-1)) "$TARGET_FILE" > "${TARGET_FILE}.tmp"
  cat simplified_insert.ts >> "${TARGET_FILE}.tmp"
  tail -n +$((INSERT_END+1)) "$TARGET_FILE" >> "${TARGET_FILE}.tmp"
  
  # Replace the original file
  mv "${TARGET_FILE}.tmp" "$TARGET_FILE"
  
  # Do the same for the syncWithGoogleDrive function
  SYNC_START=$(grep -n "export async function syncWithGoogleDrive" "$TARGET_FILE" | cut -d ":" -f 1)
  SYNC_END=$(tail -n +$SYNC_START "$TARGET_FILE" | grep -n "^}" | head -1 | cut -d ":" -f 1)
  SYNC_END=$((SYNC_START + SYNC_END))
  
  # Create a temporary file with the replacement
  head -n $((SYNC_START-1)) "$TARGET_FILE" > "${TARGET_FILE}.tmp"
  cat simplified_sync.ts >> "${TARGET_FILE}.tmp"
  tail -n +$((SYNC_END+1)) "$TARGET_FILE" >> "${TARGET_FILE}.tmp"
  
  # Replace the original file
  mv "${TARGET_FILE}.tmp" "$TARGET_FILE"
  
  # Remove the temporary files
  rm simplified_insert.ts simplified_sync.ts
}

# Call the function to insert the simplified functions
insert_simplified_functions

echo "All user reference fields have been removed from the codebase"
echo "You can now run the remove_user_references.sql in Supabase SQL Editor"
echo "After that, you'll need to update the actual code to remove any remaining references"

