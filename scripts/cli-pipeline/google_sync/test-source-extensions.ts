#!/usr/bin/env ts-node
/**
 * Test script to check sources_google for specific file extensions
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import path from 'path';

async function checkSourceExtensions() {
  try {
    console.log('\n=== Checking for sources_google file extensions ===');
    
    const supabase = SupabaseClientService.getInstance().getClient();

    // Get sample sources_google records with specific extensions
    const targetExtensions = ['.txt', '.docx', '.pdf', '.pptx'];
    
    // Build an array of filters for each extension
    const filters = targetExtensions.map(ext => `name.ilike.%${ext}`);
    
    const { data: sources, error: sourcesError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type')
      .or(filters.join(','))
      .limit(50);
      
    if (sourcesError) {
      console.error(`Error fetching sources: ${sourcesError.message}`);
      return;
    }
    
    if (!sources || sources.length === 0) {
      console.log('No sources with target extensions found.');
      return;
    }
    
    console.log(`Found ${sources.length} sources with target extensions`);
    
    // Group by extension
    const extCounts: Record<string, number> = {};
    const samplesByExt: Record<string, { id: string, name: string, ext: string }[]> = {};
    
    sources.forEach(source => {
      if (source.name) {
        const ext = path.extname(source.name).toLowerCase();
        extCounts[ext] = (extCounts[ext] || 0) + 1;
        
        if (!samplesByExt[ext]) {
          samplesByExt[ext] = [];
        }
        
        if (samplesByExt[ext].length < 5) {
          samplesByExt[ext].push({
            id: source.id,
            name: source.name,
            ext
          });
        }
      }
    });
    
    console.log('\nExtension counts:');
    Object.entries(extCounts).forEach(([ext, count]) => {
      console.log(`- ${ext}: ${count}`);
    });
    
    console.log('\nSample files by extension:');
    Object.entries(samplesByExt).forEach(([ext, samples]) => {
      console.log(`\n${ext.toUpperCase()}:`);
      samples.forEach((sample, i) => {
        console.log(`  ${i+1}. ${sample.name} (ID: ${sample.id})`);
      });
    });
    
    // Now check expert_documents table for these sample sources
    const sourceIds = Object.values(samplesByExt).flat().map(s => s.id);
    
    console.log('\nChecking expert_documents for these sources...');
    const { data: expertDocs, error: expertDocsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_processing_status')
      .in('source_id', sourceIds);
      
    if (expertDocsError) {
      console.error(`Error fetching expert documents: ${expertDocsError.message}`);
      return;
    }
    
    if (!expertDocs || expertDocs.length === 0) {
      console.log('No expert documents found for these sources.');
      return;
    }
    
    console.log(`Found ${expertDocs.length} expert documents for these sources`);
    
    // Map source IDs to file details
    const sourceMap = new Map<string, { name: string, ext: string }>();
    Object.values(samplesByExt).flat().forEach(s => {
      sourceMap.set(s.id, { name: s.name, ext: s.ext });
    });
    
    // Count by status
    const statusCounts: Record<string, Record<string, number>> = {};
    targetExtensions.forEach(ext => {
      statusCounts[ext] = {};
    });
    
    expertDocs.forEach(doc => {
      const sourceInfo = sourceMap.get(doc.source_id);
      if (sourceInfo) {
        const { ext } = sourceInfo;
        const status = doc.document_processing_status || 'unknown';
        statusCounts[ext] = statusCounts[ext] || {};
        statusCounts[ext][status] = (statusCounts[ext][status] || 0) + 1;
      }
    });
    
    console.log('\nStatus counts by extension:');
    Object.entries(statusCounts).forEach(([ext, statuses]) => {
      console.log(`\n${ext.toUpperCase()}:`);
      Object.entries(statuses).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`);
      });
    });
    
    // Find skip_processing documents with target extensions
    const skipProcessingDocs = expertDocs.filter(doc => 
      doc.document_processing_status === 'skip_processing' && 
      sourceMap.has(doc.source_id)
    );
    
    console.log(`\nFound ${skipProcessingDocs.length} skip_processing documents with target extensions`);
    
    if (skipProcessingDocs.length > 0) {
      console.log('\nSample skip_processing documents:');
      skipProcessingDocs.slice(0, 10).forEach((doc, i) => {
        const sourceInfo = sourceMap.get(doc.source_id);
        console.log(`  ${i+1}. ${sourceInfo?.name} (ID: ${doc.id}, Source ID: ${doc.source_id})`);
      });
    }
    
  } catch (error: any) {
    console.error(`Error checking source extensions: ${error.message || error}`);
  }
}

// Run the function
checkSourceExtensions();