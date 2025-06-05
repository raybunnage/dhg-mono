#!/usr/bin/env ts-node
/**
 * Update pipeline_status for expert documents
 */
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

// Initialize Supabase client
const supabase = SupabaseClientService.getInstance().getClient();

/**
 * Update pipeline_status for expert documents matching criteria
 */
async function updatePipelineStatus(options: {
  fromStatus: string;
  toStatus: string;
  limit?: number; 
  dryRun?: boolean;
  verbose?: boolean;
}) {
  // Generate tracking ID
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'update-pipeline-status');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    const { fromStatus, toStatus, limit = 10, dryRun = false, verbose = false } = options;
    
    if (!fromStatus || !toStatus) {
      console.error("Both --from-status and --to-status parameters are required");
      return;
    }
    
    console.log(`Finding expert documents with pipeline_status = "${fromStatus}"...`);
    console.log(`Will update to pipeline_status = "${toStatus}"`);
    console.log(`Limit: ${limit}, Dry run: ${dryRun ? 'Yes' : 'No'}`);
    
    // Query for documents with the specified status
    const { data: documentsToUpdate, error: queryError } = await supabase
      .from('google_expert_documents')
      .select(`
        id, 
        pipeline_status, 
        source_id, 
        sources_google (
          name, 
          mime_type
        )
      `)
      .eq('pipeline_status', fromStatus)
      .limit(limit);
    
    if (queryError) {
      console.error(`Error querying documents: ${queryError.message}`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Error querying documents: ${queryError.message}`);
      }
      return;
    }
    
    if (!documentsToUpdate || documentsToUpdate.length === 0) {
      console.log(`No documents found with pipeline_status = "${fromStatus}"`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: 0,
          summary: `No documents found with pipeline_status = "${fromStatus}"`
        });
      }
      return;
    }
    
    console.log(`Found ${documentsToUpdate.length} document(s) with pipeline_status = "${fromStatus}"`);
    
    if (verbose) {
      console.log("\nDocuments to update:");
      for (const doc of documentsToUpdate) {
        try {
          // Handle sources_google which could be an array or object depending on Supabase query
          const sourcesGoogle = doc.sources_google as any;
          let sourceName = 'Unknown';
          let mimeType = 'Unknown';
          
          if (sourcesGoogle) {
            if (Array.isArray(sourcesGoogle)) {
              // If it's an array, take the first item
              if (sourcesGoogle.length > 0) {
                sourceName = sourcesGoogle[0].name || 'Unknown';
                mimeType = sourcesGoogle[0].mime_type || 'Unknown';
              }
            } else {
              // If it's an object (direct relation)
              sourceName = sourcesGoogle.name || 'Unknown';
              mimeType = sourcesGoogle.mime_type || 'Unknown';
            }
          }
          
          console.log(`- ID: ${doc.id}, Source: ${sourceName}, Type: ${mimeType}`);
        } catch (error) {
          // Fallback in case of any errors with the property access
          console.log(`- ID: ${doc.id}, Source: Could not determine (error: ${error instanceof Error ? error.message : 'unknown'})`);
        }
      }
      console.log("");
    }
    
    // If dry run, don't actually update
    if (dryRun) {
      console.log(`DRY RUN: Would update ${documentsToUpdate.length} documents from "${fromStatus}" to "${toStatus}"`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: 0,
          summary: `DRY RUN: Would update ${documentsToUpdate.length} documents from "${fromStatus}" to "${toStatus}"`
        });
      }
      return;
    }
    
    // Update the pipeline_status
    const { error: updateError } = await supabase
      .from('google_expert_documents')
      .update({ 
        pipeline_status: toStatus,
        processing_error: null // Clear any previous processing errors
      })
      .in('id', documentsToUpdate.map(doc => doc.id));
    
    if (updateError) {
      console.error(`Error updating pipeline_status: ${updateError.message}`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Error updating pipeline_status: ${updateError.message}`);
      }
      return;
    }
    
    console.log(`✅ Successfully updated ${documentsToUpdate.length} documents from "${fromStatus}" to "${toStatus}"`);
    
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: documentsToUpdate.length,
        summary: `Updated ${documentsToUpdate.length} documents from "${fromStatus}" to "${toStatus}"`
      });
    }
  } catch (error) {
    console.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.failTracking(trackingId, `Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Set up CLI command
const program = new Command();

program
  .name('update-pipeline-status')
  .description('Update pipeline_status for expert documents')
  .requiredOption('--from-status <status>', 'Current pipeline_status to match (e.g. extraction_failed)')
  .requiredOption('--to-status <status>', 'New pipeline_status to set (e.g. unprocessed)')
  .option('-l, --limit <number>', 'Maximum number of documents to update', '10')
  .option('-d, --dry-run', 'Show what would be updated without making changes', false)
  .option('-v, --verbose', 'Show detailed information about documents', false)
  .action((options) => {
    updatePipelineStatus({
      fromStatus: options.fromStatus,
      toStatus: options.toStatus,
      limit: parseInt(options.limit),
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  });

// If this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}