#!/usr/bin/env ts-node
/**
 * Script to fix all MP4 files that are incorrectly marked as needs_reprocessing
 * 
 * MP4 files should not be processed with text-based AI, so they should be
 * marked as skip_processing instead.
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function fixMp4ProcessingStatus() {
  try {
    // Get supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First get all MP4 source IDs
    console.log('Finding sources with mime_type = video/mp4...');
    const { data: mp4Sources, error: sourcesError } = await supabase
      .from('sources_google')
      .select('id, name')
      .eq('mime_type', 'video/mp4');
      
    if (sourcesError) {
      console.error(`Error finding MP4 sources: ${sourcesError.message}`);
      return;
    }
    
    if (!mp4Sources || mp4Sources.length === 0) {
      console.log('No MP4 sources found in the database.');
      return;
    }
    
    console.log(`Found ${mp4Sources.length} MP4 sources.`);
    
    // Get source IDs array
    const mp4SourceIds = mp4Sources.map(source => source.id);
    
    // Find expert documents for those sources that need reprocessing
    const { data: mp4DocsNeedingReprocessing, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, source_id')
      .in('source_id', mp4SourceIds)
      .eq('document_processing_status', 'needs_reprocessing');
      
    if (docsError) {
      console.error(`Error finding MP4 documents: ${docsError.message}`);
      return;
    }
    
    // Display results
    if (!mp4DocsNeedingReprocessing || mp4DocsNeedingReprocessing.length === 0) {
      console.log('✅ No MP4 files have needs_reprocessing status. All good!');
      return;
    }
    
    console.log(`⚠️ Found ${mp4DocsNeedingReprocessing.length} MP4 files with needs_reprocessing status.`);
    
    // Display the first few files (if there are many)
    if (mp4DocsNeedingReprocessing.length > 0) {
      console.log('Sample files:');
      const samplesToShow = Math.min(5, mp4DocsNeedingReprocessing.length);
      for (let i = 0; i < samplesToShow; i++) {
        const doc = mp4DocsNeedingReprocessing[i];
        // Find the corresponding source name
        const source = mp4Sources.find(s => s.id === doc.source_id);
        console.log(`  - ${source?.name || 'Unknown'} (ID: ${doc.id})`);
      }
      if (mp4DocsNeedingReprocessing.length > samplesToShow) {
        console.log(`  - ... and ${mp4DocsNeedingReprocessing.length - samplesToShow} more`);
      }
    }
    
    console.log('Updating all of them to have document_processing_status = "skip_processing"...');
    
    // Batch process updates
    const batchSize = 50;
    
    for (let i = 0; i < mp4DocsNeedingReprocessing.length; i += batchSize) {
      const batch = mp4DocsNeedingReprocessing.slice(i, i + batchSize);
      const batchUpdateData = batch.map(doc => ({
        id: doc.id,
        source_id: doc.source_id, // Required for the update to work
        document_processing_status: 'skip_processing',
        document_processing_status_updated_at: new Date().toISOString(),
        processing_status: 'completed',
        processing_skip_reason: 'Video files should not be processed with text-based AI tools',
        updated_at: new Date().toISOString()
      }));
      
      const { error: updateError } = await supabase
        .from('expert_documents')
        .upsert(batchUpdateData, { onConflict: 'id' });
        
      if (updateError) {
        console.error(`Error updating batch ${i}-${i+batchSize}: ${updateError.message}`);
      } else {
        console.log(`✅ Successfully updated batch ${i}-${i+batchSize} of ${mp4DocsNeedingReprocessing.length} documents`);
      }
    }
    
    console.log('All MP4 files have been updated to have document_processing_status = "skip_processing"');
  } catch (error) {
    console.error(`Error in fixMp4ProcessingStatus: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the function
fixMp4ProcessingStatus();