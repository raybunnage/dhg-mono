import { getSupabaseClient } from './packages/cli/src/services/supabase-client';

async function refreshSchema() {
  console.log('Refreshing schema cache...');
  
  const supabase = getSupabaseClient(true);
  
  try {
    // Using direct SQL query with rpc instead of execute_sql
    console.log('Attempting to refresh schema cache with pg_notify...');
    const { data, error } = await supabase.rpc('pg_notify', { 
      channel: 'pgrst',
      payload: 'reload schema'
    });
    
    if (error) {
      console.error('Error with pg_notify RPC:', error);
      
      // Try direct SQL query as fallback
      console.log('Trying fallback method with SQL query...');
      const { data: sqlData, error: sqlError } = await supabase
        .from('documentation_files')
        .select('count(*)')
        .limit(1)
        .then(async () => {
          // After a successful query, try to manually trigger a schema refresh
          console.log('Attempting manual schema refresh...');
          
          // Try a few different ways that might work
          try {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/schema`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_ANON_KEY || '',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
              }
            });
            return { data: 'Success', error: null };
          } catch (e) {
            return { data: null, error: e };
          }
        });
        
      if (sqlError) {
        console.error('Error with fallback method:', sqlError);
      }
    } else {
      console.log('pg_notify command executed successfully');
    }
    
    // Optional: Wait for a moment to let the cache refresh
    console.log('Waiting for cache to refresh (3 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test if we can access the documentation_files table at all
    console.log('Testing basic table access...');
    const { data: basicTest, error: basicError } = await supabase
      .from('documentation_files')
      .select('id, file_path, metadata')
      .limit(1);
      
    if (basicError) {
      console.error('Basic table access failed:', basicError);
    } else {
      console.log('Basic table access succeeded');
      console.log('Sample record:', basicTest);
    }
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try creating a small test record with both metadata.file_size and size to verify
    console.log('Testing metadata operations...');
    
    try {
      // Get a random ID for a test update
      const testId = basicTest?.[0]?.id;
      
      if (testId) {
        console.log(`Testing update on record ${testId}...`);
        
        // First get the current metadata
        const { data: currentRecord, error: fetchError } = await supabase
          .from('documentation_files')
          .select('metadata')
          .eq('id', testId)
          .single();
          
        if (fetchError) {
          console.error('Error fetching test record:', fetchError);
        } else {
          // Make a test update to the metadata
          const metadata = currentRecord.metadata || {};
          const testValue = new Date().toISOString();
          metadata.test_timestamp = testValue;
          
          console.log('Testing metadata update...');
          const { error: updateError } = await supabase
            .from('documentation_files')
            .update({ metadata })
            .eq('id', testId);
            
          if (updateError) {
            console.error('Metadata update failed:', updateError);
          } else {
            console.log('Metadata update succeeded');
            console.log('The schema cache for JSONB operations is working');
          }
        }
      }
    } catch (testError) {
      console.error('Error in metadata test:', testError);
    }
    
    console.log('Schema refresh test complete');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

refreshSchema();