#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

const program = new Command();

interface ResetProcessingOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Reset the reprocessing_status for specified expert_documents by source ID
 * @param ids - Comma-separated list of sources_google IDs to reset
 * @param options - Command options
 */
async function resetDocumentProcessingStatus(ids: string, options: ResetProcessingOptions): Promise<void> {
  const startTime = new Date();
  const trackingId = await commandTrackingService.startTracking('google_sync', 'ids-need-reprocessing');
  
  try {
    // Parse and validate IDs - be extra careful with whitespace and empty values
    // First replace any spaces that might occur after commas
    const cleanedIds = ids.replace(/,\s+/g, ',');
    // Then split and filter out any empty strings
    const sourceIds = cleanedIds.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    console.log(`Parsed ${sourceIds.length} IDs: ${sourceIds.join(', ')}`);
    
    if (sourceIds.length === 0) {
      console.error('Error: No valid IDs provided');
      await commandTrackingService.failTracking(
        trackingId,
        'No valid IDs provided'
      );
      process.exit(1);
    }
    
    if (options.verbose) {
      console.log(`Finding expert documents for ${sourceIds.length} source IDs...`);
    }
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First, verify the source IDs exist
    const { data: sourcesData, error: sourcesError } = await supabase
      .from('google_sources')
      .select('id, name')
      .in('id', sourceIds);
    
    if (sourcesError) {
      console.error('Error fetching sources:', sourcesError.message);
      await commandTrackingService.failTracking(
        trackingId,
        `Error fetching sources: ${sourcesError.message}`
      );
      process.exit(1);
    }
    
    if (!sourcesData || sourcesData.length === 0) {
      console.error('No matching sources found for the provided IDs');
      await commandTrackingService.failTracking(
        trackingId,
        'No matching sources found for the provided IDs'
      );
      process.exit(1);
    }
    
    const foundSourceIds = sourcesData.map(source => source.id);
    const missingSourceIds = sourceIds.filter(id => !foundSourceIds.includes(id));
    
    if (missingSourceIds.length > 0) {
      console.warn(`Warning: The following source IDs were not found in the database: ${missingSourceIds.join(', ')}`);
    }
    
    // Now find the corresponding expert documents
    const { data: expertDocs, error: expertDocsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, reprocessing_status')
      .in('source_id', foundSourceIds);
    
    if (expertDocsError) {
      console.error('Error fetching expert documents:', expertDocsError.message);
      await commandTrackingService.failTracking(
        trackingId,
        `Error fetching expert documents: ${expertDocsError.message}`
      );
      process.exit(1);
    }
    
    if (!expertDocs || expertDocs.length === 0) {
      console.error('No expert documents found for the provided source IDs');
      await commandTrackingService.failTracking(
        trackingId,
        'No expert documents found for the provided source IDs'
      );
      process.exit(1);
    }
    
    // Map source names to expert documents for display
    const sourceMap = new Map(sourcesData.map(source => [source.id, source.name]));
    
    // Display current status of expert documents
    if (options.verbose) {
      console.log('\nCurrent expert documents:');
      expertDocs.forEach(doc => {
        const sourceName = sourceMap.get(doc.source_id) || 'Unknown';
        console.log(`${doc.id} | ${sourceName} | ${doc.reprocessing_status || 'null'}`);
      });
      console.log('');
    }
    
    // Update records in dry-run mode or actual update
    if (options.dryRun) {
      console.log('[DRY RUN] Would update the following expert documents:');
      expertDocs.forEach(doc => {
        const sourceName = sourceMap.get(doc.source_id) || 'Unknown';
        console.log(`- ${doc.id} | ${sourceName}`);
        console.log(`  Current status: ${doc.reprocessing_status || 'null'}`);
        console.log(`  New status: needs_reprocessing`);
        console.log(`  reprocessing_status_updated_at: ${new Date().toISOString()}`);
        console.log('');
      });
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 0,
        summary: `[DRY RUN] Would have updated ${expertDocs.length} expert documents to needs_reprocessing status`
      });
    } else {
      // Perform the actual update
      const now = new Date().toISOString();
      
      // Update in batches to prevent exceeding Supabase limits
      const batchSize = 50;
      let updatedCount = 0;
      
      for (let i = 0; i < expertDocs.length; i += batchSize) {
        const batch = expertDocs.slice(i, i + batchSize);
        const batchIds = batch.map(doc => doc.id);
        
        const { data: updateData, error: updateError } = await supabase
          .from('expert_documents')
          .update({
            reprocessing_status: 'needs_reprocessing',
            reprocessing_status_updated_at: now
          })
          .in('id', batchIds)
          .select();
        
        if (updateError) {
          console.error(`Error updating batch ${i / batchSize + 1}:`, updateError.message);
          continue;
        }
        
        updatedCount += updateData?.length || 0;
        
        if (options.verbose) {
          console.log(`✅ Updated batch ${i / batchSize + 1} (${updateData?.length || 0} records)`);
        }
      }
      
      console.log(`✅ Successfully updated ${updatedCount} expert documents to needs_reprocessing status`);
      console.log(`\nIMPORTANT: The updates are made to the expert_documents table, not the sources_google table.`);
      console.log(`When checking in Supabase UI, verify the documents in the expert_documents table.`);
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: updatedCount,
        summary: `Updated ${updatedCount} expert documents to needs_reprocessing status`
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : String(error));
    await commandTrackingService.failTracking(
      trackingId,
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

program
  .name('ids-need-reprocessing')
  .description('Reset reprocessing_status for expert documents by source ID')
  .argument('<ids>', 'Comma-separated list of source IDs to reset')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('-v, --verbose', 'Show detailed output')
  .action(resetDocumentProcessingStatus);

program.parse(process.argv);