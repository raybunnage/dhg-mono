import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config as loadDotEnv } from 'dotenv';

// Load environment variables
loadDotEnv({ path: '.env.local' });
loadDotEnv({ path: '.env.development' });

/**
 * A targeted fix for the schema cache issue in the markdown sync process.
 * This ensures the metadata.file_size field is properly recognized.
 */
async function fixSyncSchemaCache() {
  console.log('Starting targeted schema cache fix for markdown sync process...');
  
  // Initialize Supabase client
  const SUPABASE_URL = process.env.CLI_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.CLI_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }
  
  console.log(`Connecting to Supabase at: ${SUPABASE_URL}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  try {
    // Step 1: Refresh the schema cache
    console.log('Step 1: Refreshing schema cache...');
    try {
      const { error } = await supabase.rpc('pg_notify', { 
        channel: 'pgrst',
        payload: 'reload schema'
      });
      
      if (error) {
        console.error('Error sending schema refresh command:', error);
      } else {
        console.log('Schema refresh command sent successfully');
      }
    } catch (error) {
      console.error('Error refreshing schema cache:', error);
    }
    
    // Step 2: Wait for schema cache to update
    console.log('Waiting 3 seconds for schema cache to refresh...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Perform a test update to ensure metadata.file_size works properly
    console.log('Step 3: Performing test update with metadata.file_size...');
    
    // Get a random documentation file to update
    const { data: testFile, error: fetchError } = await supabase
      .from('documentation_files')
      .select('id, file_path, metadata')
      .limit(1);
    
    if (fetchError) {
      console.error('Error fetching test file:', fetchError);
    } else if (testFile && testFile.length > 0) {
      console.log(`Test file selected: ${testFile[0].file_path}`);
      
      // Get existing metadata
      const metadata = testFile[0].metadata || {};
      console.log('Current metadata:', metadata);
      
      // Update metadata with file_size (preserving existing file_size if present)
      const updatedMetadata = {
        ...metadata,
        test_timestamp: new Date().toISOString(), // Add a test field
        file_size: metadata.file_size || metadata.size || 100 // Preserve existing file_size or size, or use default
      };
      
      // Remove size if present
      if (updatedMetadata.size !== undefined) {
        console.log(`Moving size (${updatedMetadata.size}) to file_size`);
        delete updatedMetadata.size;
      }
      
      console.log('Updated metadata to be written:', updatedMetadata);
      
      try {
        // First try a simple update with just the metadata field
        const { error: updateError } = await supabase
          .from('documentation_files')
          .update({
            metadata: updatedMetadata
          })
          .eq('id', testFile[0].id);
        
        if (updateError) {
          console.error('Error updating metadata with file_size:', updateError);
          
          // Try working around the issue by doing a more focused update
          console.log('Trying alternate approach...');
          
          // Get raw SQL access
          try {
            const { error: rpcError } = await supabase.rpc('execute_sql', {
              sql_query: `
                UPDATE documentation_files 
                SET metadata = jsonb_set(
                  jsonb_set(
                    metadata - 'size', 
                    '{file_size}', 
                    to_jsonb(100::int)
                  ),
                  '{test_timestamp}', 
                  to_jsonb('${new Date().toISOString()}'::text)
                ) 
                WHERE id = '${testFile[0].id}'
              `
            });
            
            if (rpcError) {
              console.error('Error with SQL update approach:', rpcError);
            } else {
              console.log('SQL update successful!');
            }
          } catch (sqlError) {
            console.error('Error with SQL approach:', sqlError);
          }
        } else {
          console.log('Metadata update successful!');
        }
        
        // Get the updated record to verify changes
        const { data: updatedFile, error: verifyError } = await supabase
          .from('documentation_files')
          .select('metadata')
          .eq('id', testFile[0].id)
          .single();
        
        if (verifyError) {
          console.error('Error verifying update:', verifyError);
        } else {
          console.log('Updated file metadata:', updatedFile.metadata);
          console.log('file_size value:', updatedFile.metadata.file_size);
          console.log('size value:', updatedFile.metadata.size);
        }
      } catch (error) {
        console.error('Error in test update:', error);
      }
    } else {
      console.log('No test file found to update');
    }
    
    console.log('\nSchema cache fix process complete');
    console.log('When running the markdown sync process, if you still encounter schema cache issues:');
    console.log('1. Try manually running a database migration that refreshes the schema');
    console.log('2. Restart your Supabase instance if you have local access');
    console.log('3. Contact Supabase support if issues persist on their hosted service');
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the function
fixSyncSchemaCache();