#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

const supabase = SupabaseClientService.getInstance().getClient();

/**
 * Updates expert documents with valid processing_content JSON and no processing errors
 * to have a pipeline_status of "processed"
 */
async function updateProcessedRecords(options: {
  limit?: number;
  dryRun?: boolean;
}) {
  // Generate tracking ID
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'update-processed-records');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    const limit = options.limit || 500;
    const dryRun = options.dryRun || false;

    console.log(`Finding records with valid processed_content and no processing_error...`);
    console.log(`Limit: ${limit}, Dry run: ${dryRun ? 'Yes' : 'No'}`);

    // Find records where processed_content is not null (and valid JSON) and processing_error is null
    // and pipeline_status is not already "processed"
    const { data: recordsToUpdate, error } = await supabase
      .from('expert_documents')
      .select('id, source_id, processed_content, pipeline_status')
      .is('processing_error', null)
      .not('processed_content', 'is', null)
      .not('pipeline_status', 'eq', 'processed')
      .limit(limit);

    if (error) {
      console.error(`Error fetching records: ${error.message}`);
      
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Error fetching records: ${error.message}`);
      }
      return;
    }

    if (!recordsToUpdate || recordsToUpdate.length === 0) {
      console.log('No records found that match the criteria.');
      
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: 0,
          summary: 'No records found that match the criteria'
        });
      }
      return;
    }

    // Filter records to only include those with valid JSON in processed_content
    const validRecords = recordsToUpdate.filter(record => {
      try {
        // If processed_content is already parsed as an object, it's valid
        if (typeof record.processed_content === 'object' && record.processed_content !== null) {
          return true;
        }
        
        // If it's a string, try to parse it
        if (typeof record.processed_content === 'string') {
          JSON.parse(record.processed_content);
          return true;
        }
        
        return false;
      } catch (e) {
        console.log(`Skipping record ${record.id} - Invalid JSON in processed_content`);
        return false;
      }
    });

    console.log(`Found ${validRecords.length} records with valid processed_content and no processing_error.`);

    // Group records by current pipeline_status for reporting
    const statusGroups: Record<string, number> = {};
    validRecords.forEach(record => {
      const status = record.pipeline_status || 'null';
      statusGroups[status] = (statusGroups[status] || 0) + 1;
    });

    console.log('\nCurrent pipeline_status breakdown:');
    Object.entries(statusGroups).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} records`);
    });

    if (dryRun) {
      console.log(`\nDRY RUN: Would update ${validRecords.length} records to pipeline_status = "processed"`);
      
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: validRecords.length,
          summary: `Dry run: Would have updated ${validRecords.length} records to pipeline_status = "processed"`
        });
      }
      return;
    }

    // Perform the update
    const { data: updateResult, error: updateError } = await supabase
      .from('expert_documents')
      .update({ pipeline_status: 'processed' })
      .in('id', validRecords.map(r => r.id))
      .select('id');

    if (updateError) {
      console.error(`Error updating records: ${updateError.message}`);
      
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Error updating records: ${updateError.message}`);
      }
      return;
    }

    console.log(`\nSuccess! Updated ${updateResult?.length || 0} records to pipeline_status = "processed"`);
    
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: updateResult?.length || 0,
        summary: `Updated ${updateResult?.length || 0} records to pipeline_status = "processed"`
      });
    }
  } catch (error) {
    console.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.failTracking(trackingId, 
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Set up CLI command
const program = new Command();

program
  .name('update-processed-records')
  .description('Updates expert documents with valid processed_content JSON and no processing errors to have a pipeline_status of "processed"')
  .option('-l, --limit <number>', 'Maximum number of records to process', '500')
  .option('-d, --dry-run', 'Show what would be updated without making changes', false)
  .action((options) => {
    updateProcessedRecords({
      limit: parseInt(options.limit),
      dryRun: options.dryRun
    });
  });

// If this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}