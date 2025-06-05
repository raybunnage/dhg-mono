#\!/usr/bin/env ts-node
/**
 * Expert Documents Orphaned Records Purge Tool with Presentation Assets Cleanup
 * 
 * This script identifies and resolves orphaned expert_documents records
 * where the source_id is null or doesn't exist in sources_google table.
 * It handles presentation_assets references by removing them first.
 * 
 * Usage:
 *   ts-node purge-orphaned-with-presentations.ts [options]
 * 
 * Options:
 *   --dry-run             Show what would be done without making changes
 *   --limit <n>           Limit for orphaned records to process (default: 100)
 *   --verbose             Show detailed information during processing
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

interface PurgeOptions {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
}

interface PurgeResult {
  orphanedRecordsFound: number;
  presentationAssetsDeleted: number;
  expertDocumentsDeleted: number;
  errors: string[];
}

/**
 * Find and purge orphaned expert_documents records that have null source_id
 * or whose source_id doesn't exist in sources_google table,
 * including handling presentation_assets dependencies
 */
async function purgeOrphanedWithPresentations(options: PurgeOptions = {}): Promise<PurgeResult> {
  console.log('=== Purging Orphaned Expert Documents with Presentation Assets Cleanup ===');
  
  const isDryRun = options.dryRun \!== undefined ? options.dryRun : false;
  const limit = options.limit || 100;
  const verbose = options.verbose || false;
  
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL PURGE'}`);
  console.log(`Limit: ${limit} orphaned records`);
  console.log(`Verbose: ${verbose ? 'Yes' : 'No'}`);
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Test connection
  console.log('\nTesting Supabase connection...');
  const connectionTest = await SupabaseClientService.getInstance().testConnection();
  if (\!connectionTest.success) {
    throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
  }
  console.log('✅ Supabase connection test successful');
  
  // Initialize the result object
  const result: PurgeResult = {
    orphanedRecordsFound: 0,
    presentationAssetsDeleted: 0,
    expertDocumentsDeleted: 0,
    errors: []
  };
  
  // Step 1: Find expert_documents with null source_id
  console.log('\nFinding expert_documents with null source_id...');
  const { data: nullSourceData, error: nullSourceError } = await supabase
    .from('google_expert_documents')
    .select('id, document_type_id, document_processing_status, created_at, updated_at')
    .is('source_id', null)
    .limit(limit);
    
  if (nullSourceError) {
    const errorMessage = `Error querying records with null source_id: ${nullSourceError.message}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
    return result;
  }
  
  const nullSourceRecords = nullSourceData || [];
  console.log(`Found ${nullSourceRecords.length} expert_documents with null source_id.`);
  result.orphanedRecordsFound += nullSourceRecords.length;
  
  // Step 2: Find expert_documents with non-existent source_id in sources_google
  console.log('\nFinding expert_documents with non-existent source_id in sources_google...');
  
  // We need to use a more complex approach since Supabase doesn't directly support NOT IN subqueries
  console.log('Fetching all source_ids from sources_google...');
  const { data: allSourcesData, error: sourcesError } = await supabase
    .from('google_sources')
    .select('id');
    
  if (sourcesError) {
    const errorMessage = `Error fetching sources_google ids: ${sourcesError.message}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
    return result;
  }
  
  // Create a set of all valid source_ids
  const validSourceIds = new Set((allSourcesData || []).map(source => source.id));
  console.log(`Found ${validSourceIds.size} valid source_ids in sources_google.`);
  
  // Get expert_documents with non-null source_id
  const { data: expertDocsData, error: expertDocsError } = await supabase
    .from('google_expert_documents')
    .select('id, source_id, document_type_id, document_processing_status, created_at, updated_at')
    .not('source_id', 'is', null)
    .limit(1000); // Get more records since we'll filter them in memory
    
  if (expertDocsError) {
    const errorMessage = `Error fetching expert_documents with non-null source_id: ${expertDocsError.message}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
    return result;
  }
  
  // Filter to find orphaned records (those with source_id not in the valid set)
  const orphanedRecords = (expertDocsData || [])
    .filter(doc => doc.source_id && \!validSourceIds.has(doc.source_id))
    .slice(0, limit); // Apply the limit after filtering
  
  console.log(`Found ${orphanedRecords.length} expert_documents with non-existent source_id.`);
  result.orphanedRecordsFound += orphanedRecords.length;
  
  // Combine both sets of orphaned records
  const allOrphanedRecords = [...nullSourceRecords, ...orphanedRecords];
  
  if (allOrphanedRecords.length === 0) {
    console.log('\nNo orphaned expert_documents found.');
    return result;
  }
  
  // Display the records if verbose
  if (verbose || isDryRun) {
    console.log('\nOrphaned Expert Documents to be purged:');
    console.table(allOrphanedRecords.map(doc => ({
      id: doc.id,
      source_id: doc.source_id || 'NULL',
      document_type_id: doc.document_type_id,
      status: doc.document_processing_status,
      created_at: doc.created_at
    })));
  }
  
  // Get all orphaned expert_document IDs
  const orphanedIds = allOrphanedRecords.map(doc => doc.id);
  
  // Step 3: Find presentation_assets that reference these expert_documents
  console.log('\nFinding presentation_assets that reference these orphaned expert_documents...');
  const { data: presentationAssetsData, error: presentationAssetsError } = await supabase
    .from('presentation_assets')
    .select('*')
    .in('expert_document_id', orphanedIds);
  
  if (presentationAssetsError) {
    const errorMessage = `Error finding presentation_assets: ${presentationAssetsError.message}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
    return result;
  }
  
  const presentationAssets = presentationAssetsData || [];
  console.log(`Found ${presentationAssets.length} presentation_assets referencing orphaned expert_documents.`);
  
  // Display presentation assets
  if (presentationAssets.length > 0 && (verbose || isDryRun)) {
    console.log('\nPresentation Assets to be deleted:');
    console.table(presentationAssets.map(asset => ({
      id: asset.id,
      presentation_id: asset.presentation_id,
      expert_document_id: asset.expert_document_id,
      created_at: asset.created_at
    })));
  }
  
  // Step 4: Delete the presentation_assets if not in dry-run mode
  if (\!isDryRun && presentationAssets.length > 0) {
    const presentationAssetIds = presentationAssets.map(asset => asset.id);
    console.log(`Deleting ${presentationAssetIds.length} presentation_assets...`);
    
    const { error: deleteAssetsError } = await supabase
      .from('presentation_assets')
      .delete()
      .in('id', presentationAssetIds);
      
    if (deleteAssetsError) {
      const errorMessage = `Error deleting presentation_assets: ${deleteAssetsError.message}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
      return result;
    }
    
    console.log(`✅ Successfully deleted ${presentationAssetIds.length} presentation_assets`);
    result.presentationAssetsDeleted = presentationAssetIds.length;
  } else if (isDryRun) {
    console.log(`[DRY RUN] Would delete ${presentationAssets.length} presentation_assets`);
    result.presentationAssetsDeleted = presentationAssets.length;
  }
  
  // Step 5: Delete the orphaned expert_documents if not in dry-run mode
  if (\!isDryRun) {
    console.log(`Deleting ${orphanedIds.length} orphaned expert_documents...`);
    
    const { error: deleteDocsError } = await supabase
      .from('google_expert_documents')
      .delete()
      .in('id', orphanedIds);
      
    if (deleteDocsError) {
      const errorMessage = `Error deleting expert_documents: ${deleteDocsError.message}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
      return result;
    }
    
    console.log(`✅ Successfully deleted ${orphanedIds.length} orphaned expert_documents`);
    result.expertDocumentsDeleted = orphanedIds.length;
  } else {
    console.log(`[DRY RUN] Would delete ${orphanedIds.length} orphaned expert_documents`);
    result.expertDocumentsDeleted = orphanedIds.length;
  }
  
  return result;
}

// Main function to run the command
async function runPurge(options: PurgeOptions = {}): Promise<void> {
  try {
    // Start command tracking
    const trackingId = await commandTrackingService.startTracking(
      'google_sync', 
      'purge-orphaned-with-presentations'
    );
    
    // Run the purge operation
    const result = await purgeOrphanedWithPresentations(options);
    
    // Display the results
    console.log('\n=== Purge Results ===');
    console.log(`Orphaned expert_documents found: ${result.orphanedRecordsFound}`);
    console.log(`Presentation assets ${options.dryRun ? 'that would be ' : ''}deleted: ${result.presentationAssetsDeleted}`);
    console.log(`Expert documents ${options.dryRun ? 'that would be ' : ''}deleted: ${result.expertDocumentsDeleted}`);
    console.log(`Errors encountered: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    if (options.dryRun) {
      console.log('\n⚠️ This was a DRY RUN. No records were actually deleted.');
      console.log('To perform the actual purge, run the command without the --dry-run flag.');
    }
    
    // Create summary message
    let summaryMessage = `${options.dryRun ? '[DRY RUN] ' : ''}`;
    summaryMessage += `Purged ${result.expertDocumentsDeleted} orphaned expert_documents and ${result.presentationAssetsDeleted} presentation_assets`;
    
    // Complete tracking
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: result.expertDocumentsDeleted + result.presentationAssetsDeleted,
      summary: summaryMessage
    });
    
    console.log('\nOrphaned records purge complete\!');
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Log tracking failure
    try {
      const trackingId = await commandTrackingService.startTracking(
        'google_sync', 
        'purge-orphaned-with-presentations'
      );
      await commandTrackingService.failTracking(
        trackingId, 
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } catch (trackingError) {
      // Just log and continue if tracking fails
      console.warn(`Failed to track command error: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
    }
    
    process.exit(1);
  }
}

// Set up command line interface
const program = new Command();

program
  .name('purge-orphaned-with-presentations')
  .description('Purge orphaned expert_documents with presentation_assets cleanup')
  .option('--dry-run', 'Show what would be done without making changes', false)
  .option('--limit <number>', 'Limit for orphaned records to process', '100')
  .option('--verbose', 'Show detailed information during processing', false)
  .action(async (options) => {
    const purgeOptions: PurgeOptions = {
      dryRun: options.dryRun,
      limit: parseInt(options.limit, 10),
      verbose: options.verbose
    };
    
    await runPurge(purgeOptions);
  });

// Run the CLI if this module is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { purgeOrphanedWithPresentations, runPurge };
