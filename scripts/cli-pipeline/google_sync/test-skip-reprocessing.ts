#!/usr/bin/env ts-node
/**
 * Test script to check for documents with skip_processing status and specific file extensions
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import path from 'path';

async function checkSkipReprocessingStatus() {
  try {
    console.log('\n=== Checking for skip_processing documents with specific file extensions ===');
    
    const supabase = SupabaseClientService.getInstance().getClient();

    // Get the expert_documents with skip_processing status 
    const { data: skipReprocessingDocs, error: skipReprocessingError } = await supabase
      .from('expert_documents')
      .select(`
        id, 
        source_id, 
        document_processing_status
      `)
      .eq('document_processing_status', 'skip_processing')
      .limit(500);
      
    if (skipReprocessingError) {
      console.error(`Error fetching skip_processing expert documents: ${skipReprocessingError.message}`);
      return;
    }
    
    if (!skipReprocessingDocs || skipReprocessingDocs.length === 0) {
      console.log('No documents with "skip_processing" status found.');
      return;
    }
    
    console.log(`Found ${skipReprocessingDocs.length} documents with "skip_processing" status`);
    
    // Get source information for these documents
    const sourceIds = skipReprocessingDocs.map(doc => doc.source_id).filter(Boolean);
    
    if (sourceIds.length === 0) {
      console.log('No valid source IDs found for these documents.');
      return;
    }
    
    const { data: sources, error: sourcesError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type')
      .in('id', sourceIds);
      
    if (sourcesError) {
      console.error(`Error fetching source information: ${sourcesError.message}`);
      return;
    }
    
    if (!sources || sources.length === 0) {
      console.log('No source records found for these documents.');
      return;
    }
    
    // Create a map of source_id to file name
    const sourceMap = new Map<string, string>();
    sources.forEach(source => {
      if (source.id && source.name) {
        sourceMap.set(source.id, source.name);
      }
    });
    
    // Target file extensions
    const targetExtensions = ['.txt', '.docx', '.pdf', '.pptx'];
    
    // Check each document's source file
    let matchingDocs = 0;
    const matchingFiles: {id: string, fileName: string, extension: string}[] = [];
    
    for (const doc of skipReprocessingDocs) {
      const fileName = sourceMap.get(doc.source_id);
      if (fileName) {
        const extension = path.extname(fileName).toLowerCase();
        if (targetExtensions.includes(extension)) {
          matchingDocs++;
          matchingFiles.push({
            id: doc.id,
            fileName,
            extension
          });
        }
      }
    }
    
    if (matchingDocs > 0) {
      console.log(`\nFound ${matchingDocs} "skip_processing" documents with targeted file extensions:`);
      console.log('----------------------------------------------------------');
      matchingFiles.forEach((file, index) => {
        console.log(`${index + 1}. ID: ${file.id}`);
        console.log(`   Filename: ${file.fileName}`);
        console.log(`   Extension: ${file.extension}`);
        console.log('----------------------------------------------------------');
      });
      
      // Group by extension
      const extCounts = targetExtensions.map(ext => {
        const count = matchingFiles.filter(f => f.extension === ext).length;
        return { extension: ext, count };
      });
      
      console.log('\nCounts by extension:');
      extCounts.forEach(ec => {
        console.log(`- ${ec.extension}: ${ec.count}`);
      });
    } else {
      console.log('\nNo "skip_processing" documents with targeted file extensions found.');
    }
  } catch (error: any) {
    console.error(`Error checking skip_reprocessing status: ${error.message || error}`);
  }
}

// Run the function
checkSkipReprocessingStatus();