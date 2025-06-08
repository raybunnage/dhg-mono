import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

const program = new Command();

program
  .description('Update the name field in sources_google when a file has been renamed in Google Drive')
  .option('-v, --verbose', 'Show verbose output')
  .option('--dry-run', 'Show what would be updated without making changes')
  .requiredOption('--source-id <sourceId>', 'The sources_google record ID to update')
  .requiredOption('--new-name <newName>', 'The new file name that was set in Google Drive')
  .parse(process.argv);

async function renameFile() {
  const options = program.opts();
  const { sourceId, newName, verbose, dryRun } = options;

  const startTime = new Date();
  const trackingId = await commandTrackingService.startTracking('google_sync', 'renamed-file');

  try {
    console.log(`Updating sources_google record ID: "${sourceId}" with new name: "${newName}"`);
    console.log(`Dry run mode: ${dryRun ? 'ON' : 'OFF'}`);

    const supabase = SupabaseClientService.getInstance().getClient();

    // Find the record by source_id
    const { data: record, error: findError } = await supabase
      .from('google_sources')
      .select('id, name, path, path_array')
      .eq('id', sourceId)
      .single();

    if (findError) {
      throw new Error(`Error finding sources_google record: ${findError.message}`);
    }

    if (!record) {
      throw new Error(`No sources_google record found with ID: ${sourceId}`);
    }

    console.log(`Found record with ID: ${record.id}`);
    console.log(`Current name: ${record.name}`);
    console.log(`Current path: ${record.path || 'N/A'}`);

    // Update path and path_array if they exist
    const updateData: any = {
      name: newName
    };

    if (record.path) {
      const pathParts = record.path.split('/');
      pathParts[pathParts.length - 1] = newName;
      updateData.path = pathParts.join('/');
      
      console.log(`New path will be: ${updateData.path}`);
    }

    if (record.path_array && Array.isArray(record.path_array)) {
      const newPathArray = [...record.path_array];
      newPathArray[newPathArray.length - 1] = newName;
      updateData.path_array = newPathArray;
      
      console.log(`Path array will be updated`);
    }

    if (dryRun) {
      console.log('DRY RUN: Would update record with the following data:');
      console.log(JSON.stringify(updateData, null, 2));
    } else {
      // Update the record
      const { data: updateResult, error: updateError } = await supabase
        .from('google_sources')
        .update(updateData)
        .eq('id', record.id)
        .select();

      if (updateError) {
        throw new Error(`Error updating sources_google record: ${updateError.message}`);
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error(`Failed to update sources_google record with ID: ${record.id}`);
      }

      console.log('✅ Successfully updated sources_google record:');
      console.log(`ID: ${updateResult[0].id}`);
      console.log(`New name: ${updateResult[0].name}`);
      console.log(`New path: ${updateResult[0].path || 'N/A'}`);
    }

    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: dryRun ? 0 : 1,
      summary: `Updated name for source ID "${sourceId}" to "${newName}" ${dryRun ? '(dry run)' : ''}`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);
    
    await commandTrackingService.failTracking(
      trackingId,
      `Command failed: ${errorMessage}`
    );
    
    process.exit(1);
  }
}

renameFile();