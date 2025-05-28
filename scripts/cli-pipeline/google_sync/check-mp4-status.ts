#!/usr/bin/env ts-node
/**
 * Script to check if any MP4 files have needs_reprocessing status
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkMp4Status() {
  try {
    // Get supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First get all sources with mime_type 'video/mp4'
    console.log('Finding sources with mime_type = video/mp4...');
    const { data: mp4Sources, error: sourcesError } = await supabase
      .from('google_sources')
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
    
    // Now check which of these MP4 sources have expert documents with needs_reprocessing status
    const { data: mp4DocsNeedingReprocessing, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_processing_status')
      .in('source_id', mp4Sources.map(s => s.id))
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
    
    console.log(`⚠️ Found ${mp4DocsNeedingReprocessing.length} MP4 files with needs_reprocessing status:`);
    
    // Display each file and its corresponding source name
    for (const doc of mp4DocsNeedingReprocessing) {
      const source = mp4Sources.find(s => s.id === doc.source_id);
      console.log(`- Document ID: ${doc.id}, Source: ${source?.name || 'Unknown'}`);
    }
    
    console.log('\nThese files should be updated to have document_processing_status = "not_set" or "skip_processing".');
    
  } catch (error) {
    console.error(`Error in checkMp4Status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the function
checkMp4Status();