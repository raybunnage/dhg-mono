import { Logger } from '../../../../packages/shared/utils/logger';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface UpdateRootDriveIdOptions {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
}

export async function updateRootDriveIdCommand(options: UpdateRootDriveIdOptions = {}) {
  try {
    const isDryRun = options.dryRun === true;
    const limit = options.limit ? parseInt(options.limit.toString()) : undefined;
    const verbose = options.verbose === true;
    
    Logger.info(`Starting update-root-drive-id command in ${isDryRun ? "dry run" : "live"} mode`);
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Root drive ID to set for all records
    const rootDriveId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
    
    // First, count records with null or empty root_drive_id
    const { count: nullCount, error: countError } = await supabase
      .from('media_presentations')
      .select('id', { count: 'exact', head: true })
      .or('root_drive_id.is.null,root_drive_id.eq.');
    
    if (countError) {
      Logger.error('Error counting presentations with null root_drive_id:', countError);
      return;
    }
    
    Logger.info(`Found ${nullCount} presentations with null or empty root_drive_id`);
    
    // Then count total records
    const { count: totalCount, error: totalCountError } = await supabase
      .from('media_presentations')
      .select('id', { count: 'exact', head: true });
    
    if (totalCountError) {
      Logger.error('Error counting total presentations:', totalCountError);
      return;
    }
    
    Logger.info(`Total presentations in database: ${totalCount}`);
    
    // For dry run, just show what would be updated
    if (isDryRun) {
      // Get a sample of records with null root_drive_id
      const { data: sampleRecords, error: sampleError } = await supabase
        .from('media_presentations')
        .select('id, title, main_video_id, root_drive_id')
        .or('root_drive_id.is.null,root_drive_id.eq.')
        .limit(10);
      
      if (sampleError) {
        Logger.error('Error fetching sample records:', sampleError);
        return;
      }
      
      Logger.info(`Sample of ${sampleRecords.length} records that would be updated:`);
      console.log('\n| ID | Title | Current root_drive_id |');
      console.log('|----|-------|----------------------|');
      
      for (const record of sampleRecords) {
        console.log(`| ${record.id} | ${record.title || 'No title'} | ${record.root_drive_id || 'NULL'} |`);
      }
      
      Logger.info(`\nDRY RUN: Would update ${nullCount} records to have root_drive_id: ${rootDriveId}`);
      Logger.info('Run without --dry-run to actually update the records');
      return;
    }
    
    // For live run, try different approaches to update the records
    
    // Approach 1: PostgreSQL query through REST endpoint
    try {
      Logger.info('Trying PostgreSQL update method...');
      
      // Use Supabase REST endpoint to execute SQL directly
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
        },
        body: JSON.stringify({
          query: `UPDATE media_presentations SET root_drive_id = '${rootDriveId}' WHERE root_drive_id IS NULL OR root_drive_id = '';`
        })
      });
      
      if (!response.ok) {
        Logger.warn(`REST API returned status: ${response.status}. Trying next method...`);
        throw new Error(`REST API error: ${response.statusText}`);
      }
      
      Logger.info('Successfully executed PostgreSQL update');
      
      // Count updated records
      const { count, error: countError } = await supabase
        .from('media_presentations')
        .select('id', { count: 'exact' })
        .eq('root_drive_id', rootDriveId);
        
      if (countError) {
        Logger.warn(`Error counting updated records: ${countError.message || JSON.stringify(countError)}`);
      } else {
        Logger.info(`Successfully updated ${count} records with root_drive_id: ${rootDriveId}`);
      }
      
      return;
    } catch (sqlExecError) {
      const errMsg = sqlExecError instanceof Error ? sqlExecError.message : String(sqlExecError);
      Logger.warn(`PostgreSQL update method failed: ${errMsg}`);
    }
    
    // Approach 2: Update one record at a time
    try {
      Logger.info('Trying individual record update method...');
      
      // First get all records with null root_drive_id
      const { data: recordsToUpdate, error: fetchError } = await supabase
        .from('media_presentations')
        .select('id')
        .or('root_drive_id.is.null,root_drive_id.eq.');
        
      if (fetchError) {
        Logger.warn(`Error fetching records to update: ${fetchError.message || JSON.stringify(fetchError)}`);
        throw new Error('Failed to fetch records');
      }
      
      if (!recordsToUpdate || recordsToUpdate.length === 0) {
        Logger.info('No records found to update');
        return;
      }
      
      Logger.info(`Found ${recordsToUpdate.length} records to update individually`);
      
      // Update each record one by one
      let successCount = 0;
      let failCount = 0;
      
      for (const record of recordsToUpdate) {
        try {
          const { error: updateError } = await supabase
            .from('media_presentations')
            .update({ root_drive_id: rootDriveId })
            .eq('id', record.id);
            
          if (updateError) {
            Logger.warn(`Failed to update record ${record.id}: ${updateError.message || JSON.stringify(updateError)}`);
            failCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          Logger.warn(`Error updating record ${record.id}: ${errMsg}`);
          failCount++;
        }
      }
      
      Logger.info(`Individual update results: ${successCount} successful, ${failCount} failed`);
      
      if (successCount > 0) {
        return;
      }
    } catch (individualUpdateError) {
      const errMsg = individualUpdateError instanceof Error ? individualUpdateError.message : String(individualUpdateError);
      Logger.warn(`Individual update method failed: ${errMsg}`);
    }
    
    // Final approach: Try with SQL function
    try {
      Logger.info('Trying SQL function update method...');
      
      // Create a temporary SQL function and use it
      const createFunctionSql = `
        CREATE OR REPLACE FUNCTION temp_update_presentations_root_drive_id()
        RETURNS void AS $$
        BEGIN
          UPDATE media_presentations
          SET root_drive_id = '${rootDriveId}'
          WHERE root_drive_id IS NULL OR root_drive_id = '';
        END;
        $$ LANGUAGE plpgsql;
      `;
      
      const callFunctionSql = `SELECT temp_update_presentations_root_drive_id();`;
      
      // Create the function
      const { error: createError } = await supabase.rpc('exec', { 
        query: createFunctionSql 
      });
      
      if (createError) {
        Logger.warn(`Error creating function: ${createError.message || JSON.stringify(createError)}`);
        throw new Error('Failed to create function');
      }
      
      // Call the function
      const { error: callError } = await supabase.rpc('exec', { 
        query: callFunctionSql 
      });
      
      if (callError) {
        Logger.warn(`Error calling function: ${callError.message || JSON.stringify(callError)}`);
        throw new Error('Failed to call function');
      }
      
      Logger.info('Successfully updated with SQL function');
      
      // Drop the function
      await supabase.rpc('exec', { 
        query: 'DROP FUNCTION IF EXISTS temp_update_presentations_root_drive_id();' 
      });
      
      // Get updated count
      const { count, error: countError } = await supabase
        .from('media_presentations')
        .select('id', { count: 'exact' })
        .eq('root_drive_id', rootDriveId);
        
      if (countError) {
        Logger.warn(`Error counting updated records: ${countError.message || JSON.stringify(countError)}`);
      } else {
        Logger.info(`Successfully updated ${count} records with root_drive_id: ${rootDriveId}`);
      }
    } catch (functionError) {
      const errMsg = functionError instanceof Error ? functionError.message : String(functionError);
      Logger.error(`All update methods failed: ${errMsg}`);
      return;
    }
    
    // Verify all records now have the correct root_drive_id
    const { count: remainingNullCount, error: verifyError } = await supabase
      .from('media_presentations')
      .select('id', { count: 'exact', head: true })
      .or('root_drive_id.is.null,root_drive_id.eq.');
    
    if (verifyError) {
      Logger.error(`Error verifying update: ${verifyError.message || JSON.stringify(verifyError)}`);
      return;
    }
    
    if (remainingNullCount === 0) {
      Logger.info('✅ Verification successful: All presentations now have a root_drive_id');
    } else {
      Logger.warn(`⚠️ Verification found ${remainingNullCount} presentations still with null or empty root_drive_id`);
    }
    
  } catch (error) {
    Logger.error('Error in update-root-drive-id command:', error);
    throw error;
  }
}