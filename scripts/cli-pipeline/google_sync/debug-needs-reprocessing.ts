#!/usr/bin/env ts-node
/**
 * Script to debug why we're not finding files that need reprocessing
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function debugReprocessingStatus() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Checking for expert documents with needs_reprocessing status...');
  
  // 1. Find expert documents with needs_reprocessing status
  const { data: docsToReprocess, error: docsError } = await supabase
    .from('expert_documents')
    .select('id, source_id, document_processing_status')
    .eq('document_processing_status', 'needs_reprocessing')
    .limit(10);
    
  if (docsError) {
    console.error('Error fetching documents:', docsError.message);
    return;
  }
  
  if (!docsToReprocess || docsToReprocess.length === 0) {
    console.log('No documents found with needs_reprocessing status.');
    return;
  }
  
  console.log(`Found ${docsToReprocess.length} documents with needs_reprocessing status.`);
  console.log('Documents:', docsToReprocess);
  
  // 2. Get the corresponding sources_google records
  const sourceIds = docsToReprocess.map(doc => doc.source_id);
  
  const { data: sources, error: sourcesError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, document_type_id')
    .in('id', sourceIds);
    
  if (sourcesError) {
    console.error('Error fetching sources:', sourcesError.message);
    return;
  }
  
  if (!sources || sources.length === 0) {
    console.log('No sources found for these expert documents.');
    return;
  }
  
  console.log(`Found ${sources.length} sources for these expert documents.`);
  
  // 3. Print details about each source
  for (const source of sources) {
    console.log(`\nSource: ${source.name}`);
    console.log(`ID: ${source.id}`);
    console.log(`MIME Type: ${source.mime_type}`);
    console.log(`Document Type ID: ${source.document_type_id || 'null'}`);
    
    // 4. Count PDF documents specifically
    if (source.mime_type === 'application/pdf') {
      console.log('✅ This is a PDF file that should be processed by classify-pdfs.');
    } else {
      console.log('❌ This is not a PDF file - will not be processed by classify-pdfs.');
    }
  }
  
  // 5. Count how many PDFs
  const pdfCount = sources.filter(source => source.mime_type === 'application/pdf').length;
  console.log(`\n${pdfCount} out of ${sources.length} sources are PDF files.`);
  
  if (pdfCount === 0) {
    console.log('No PDF files found that need reprocessing. This is why classify-pdfs is not finding any files.');
  } else {
    console.log('There are PDF files that need reprocessing, but classify-pdfs is not finding them. Check classify-pdfs-with-service.ts implementation.');
  }
}

debugReprocessingStatus().catch(console.error);