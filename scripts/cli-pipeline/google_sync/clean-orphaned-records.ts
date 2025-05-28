#\!/usr/bin/env ts-node

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

interface CleanOptions {
  dryRun: boolean;
  limit: number;
  verbose: boolean;
}

async function cleanOrphanedRecords(options: CleanOptions): Promise<void> {
  console.log('=== Cleaning Orphaned Expert Documents ===');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL CLEAN'}`);
  console.log(`Limit: ${options.limit} records`);
  console.log(`Verbose: ${options.verbose ? 'Yes' : 'No'}`);
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('\nTesting Supabase connection...');
  const connectionTest = await SupabaseClientService.getInstance().testConnection();
  if (\!connectionTest.success) {
    throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
  }
  console.log('✅ Supabase connection test successful');
  
  // Find orphaned expert_documents
  console.log('\nFinding orphaned expert_documents...');
  
  // Get valid source IDs from sources_google
  const { data: validSources, error: sourcesError } = await supabase
    .from('google_sources')
    .select('id');
    
  if (sourcesError) {
    throw new Error(`Failed to fetch sources_google: ${sourcesError.message}`);
  }
  
  const validSourceIds = new Set(validSources?.map(source => source.id) || []);
  console.log(`Found ${validSourceIds.size} valid source IDs`);
  
  // Get all expert_documents
  const { data: expertDocs, error: docsError } = await supabase
    .from('expert_documents')
    .select('id, source_id, document_type_id, document_processing_status, created_at');
    
  if (docsError) {
    throw new Error(`Failed to fetch expert_documents: ${docsError.message}`);
  }
  
  // Find orphaned records
  const orphanedDocs = expertDocs?.filter(doc => 
    \!doc.source_id || \!validSourceIds.has(doc.source_id)
  ) || [];
  
  // Limit the number of records
  const limitedOrphanedDocs = orphanedDocs.slice(0, options.limit);
  
  console.log(`Found ${orphanedDocs.length} orphaned expert_documents`);
  console.log(`Processing up to ${options.limit} records`);
  
  if (limitedOrphanedDocs.length === 0) {
    console.log('No orphaned records to process');
    return;
  }
  
  // Display orphaned records if verbose
  if (options.verbose) {
    console.log('\nOrphaned records:');
    console.table(limitedOrphanedDocs.map(doc => ({
      id: doc.id,
      source_id: doc.source_id || 'NULL',
      document_type_id: doc.document_type_id,
      status: doc.document_processing_status,
      created_at: doc.created_at
    })));
  }
  
  // Find presentation_assets that reference these expert_documents
  const orphanedIds = limitedOrphanedDocs.map(doc => doc.id);
  
  const { data: presentationAssets, error: assetsError } = await supabase
    .from('presentation_assets')
    .select('id, presentation_id, expert_document_id, created_at')
    .in('expert_document_id', orphanedIds);
    
  if (assetsError) {
    throw new Error(`Failed to fetch presentation_assets: ${assetsError.message}`);
  }
  
  console.log(`Found ${presentationAssets?.length || 0} presentation_assets referencing orphaned expert_documents`);
  
  // Display presentation assets if verbose
  if (options.verbose && presentationAssets && presentationAssets.length > 0) {
    console.log('\nPresentation assets to delete:');
    console.table(presentationAssets);
  }
  
  // Delete presentation_assets first (if not dry run)
  if (\!options.dryRun && presentationAssets && presentationAssets.length > 0) {
    const assetIds = presentationAssets.map(asset => asset.id);
    
    console.log(`Deleting ${assetIds.length} presentation_assets...`);
    
    const { error: deleteAssetsError } = await supabase
      .from('presentation_assets')
      .delete()
      .in('id', assetIds);
      
    if (deleteAssetsError) {
      throw new Error(`Failed to delete presentation_assets: ${deleteAssetsError.message}`);
    }
    
    console.log(`✅ Successfully deleted ${assetIds.length} presentation_assets`);
  } else if (options.dryRun && presentationAssets && presentationAssets.length > 0) {
    console.log(`[DRY RUN] Would delete ${presentationAssets.length} presentation_assets`);
  }
  
  // Delete orphaned expert_documents (if not dry run)
  if (\!options.dryRun) {
    console.log(`Deleting ${orphanedIds.length} orphaned expert_documents...`);
    
    const { error: deleteDocsError } = await supabase
      .from('expert_documents')
      .delete()
      .in('id', orphanedIds);
      
    if (deleteDocsError) {
      throw new Error(`Failed to delete expert_documents: ${deleteDocsError.message}`);
    }
    
    console.log(`✅ Successfully deleted ${orphanedIds.length} orphaned expert_documents`);
  } else {
    console.log(`[DRY RUN] Would delete ${orphanedIds.length} orphaned expert_documents`);
  }
  
  // Results summary
  console.log('\n=== Cleanup Results ===');
  console.log(`Presentation assets ${options.dryRun ? 'that would be ' : ''}deleted: ${presentationAssets?.length || 0}`);
  console.log(`Expert documents ${options.dryRun ? 'that would be ' : ''}deleted: ${orphanedIds.length}`);
  
  if (options.dryRun) {
    console.log('\n⚠️ This was a DRY RUN. No records were actually deleted.');
    console.log('To perform the actual cleanup, run the command without the --dry-run flag.');
  }
  
  console.log('\nCleanup complete\!');
}

async function main(): Promise<void> {
  try {
    const program = new Command();
    
    program
      .name('clean-orphaned-records')
      .description('Clean up orphaned expert_documents and related presentation_assets')
      .option('--dry-run', 'Show what would be done without making changes', false)
      .option('--limit <number>', 'Limit for orphaned records to process', '100')
      .option('--verbose', 'Show detailed information during processing', false);
    
    program.parse(process.argv);
    const options = program.opts();
    
    // Start command tracking
    const trackingId = await commandTrackingService.startTracking(
      'google_sync', 
      'clean-orphaned-records'
    );
    
    await cleanOrphanedRecords({
      dryRun: options.dryRun || false,
      limit: parseInt(options.limit) || 100,
      verbose: options.verbose || false
    });
    
    // Complete tracking
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: 0, // We don't know exactly how many records were affected here
      summary: `${options.dryRun ? '[DRY RUN] ' : ''}Cleaned up orphaned expert_documents and related presentation_assets`
    });
    
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Log tracking failure
    try {
      const trackingId = await commandTrackingService.startTracking(
        'google_sync', 
        'clean-orphaned-records'
      );
      await commandTrackingService.failTracking(
        trackingId, 
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } catch (trackingError) {
      console.warn(`Failed to track command error: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { cleanOrphanedRecords };
