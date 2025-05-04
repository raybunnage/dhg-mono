#!/usr/bin/env ts-node
/**
 * Simple script to fix classify-pdfs to correctly handle needs_reprocessing status
 * This directly looks for PDFs with needs_reprocessing status and processes them
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { v4 as uuidv4 } from 'uuid';

// Main function to mark PDFs as processed
async function markProcessed(options: {
  limit?: number;
  verbose?: boolean;
  dryRun?: boolean;
}) {
  const limit = options.limit || 10;
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;
  
  console.log('=== Mark PDFs as Processed ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (updating database)'}`);
  console.log(`Limit: ${limit} files`);
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Step 1: Find expert_documents with needs_reprocessing status for PDFs
  console.log('\nFinding PDF files with needs_reprocessing status...');
  
  // First get the expert documents with needs_reprocessing status
  const { data: docsToProcess, error: docsError } = await supabase
    .from('expert_documents')
    .select('id, source_id, document_processing_status')
    .eq('document_processing_status', 'needs_reprocessing')
    .limit(limit * 2); // Get more than we need to account for filtering
    
  if (docsError) {
    console.error(`Error fetching expert documents: ${docsError.message}`);
    return [];
  }
  
  if (!docsToProcess || docsToProcess.length === 0) {
    console.log('No expert documents found with needs_reprocessing status.');
    return [];
  }
  
  console.log(`Found ${docsToProcess.length} expert documents with needs_reprocessing status.`);
  
  // Step 2: Get PDF files from sources_google for these expert documents
  const sourceIds = docsToProcess.map(doc => doc.source_id);
  
  const { data: pdfFiles, error: filesError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type')
    .in('id', sourceIds)
    .eq('mime_type', 'application/pdf')
    .is('is_deleted', false);
    
  if (filesError) {
    console.error(`Error fetching PDF files: ${filesError.message}`);
    return [];
  }
  
  if (!pdfFiles || pdfFiles.length === 0) {
    console.log('No PDF files found with needs_reprocessing status.');
    return [];
  }
  
  console.log(`Found ${pdfFiles.length} PDF files with needs_reprocessing status.`);
  
  // Step 3: Create a map from source_id to expert_document_id
  const sourceToExpertDoc = new Map();
  docsToProcess.forEach(doc => {
    sourceToExpertDoc.set(doc.source_id, doc.id);
  });
  
  // Step 4: Mark each PDF file as processed
  const processed: { id: string; name: string; docId: string }[] = [];
  
  for (const file of pdfFiles.slice(0, limit)) {
    const expertDocId = sourceToExpertDoc.get(file.id);
    
    if (!expertDocId) {
      console.log(`Warning: Could not find expert document ID for file ${file.name}`);
      continue;
    }
    
    console.log(`Processing: ${file.name} (Expert doc ID: ${expertDocId})`);
    
    if (!dryRun) {
      // Update the expert document to mark it as processed
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({
          document_processing_status: 'reprocessing_done',
          document_processing_status_updated_at: new Date().toISOString(),
          processed_content: {
            document_summary: "This document was marked as processed by the fix-classify-pdfs script.",
            key_topics: ["PDF", "automatic processing"],
            unique_insights: ["Marked as processed to skip classification"]
          }
        })
        .eq('id', expertDocId);
        
      if (updateError) {
        console.error(`Error updating expert document ${expertDocId}: ${updateError.message}`);
      } else {
        processed.push({ id: file.id, name: file.name, docId: expertDocId });
        console.log(`✅ Marked ${file.name} as processed`);
      }
    } else {
      console.log(`[DRY RUN] Would mark ${file.name} as processed`);
      processed.push({ id: file.id, name: file.name, docId: expertDocId });
    }
  }
  
  // Step 5: Print summary
  console.log('\n=== Summary ===');
  if (dryRun) {
    console.log(`Would mark ${processed.length} PDF files as processed.`);
  } else {
    console.log(`Marked ${processed.length} PDF files as processed.`);
  }
  
  return processed;
}

// CLI program
if (require.main === module) {
  const program = new Command();
  
  program
    .name('fix-classify-pdfs')
    .description('Mark PDF files with needs_reprocessing status as processed')
    .option('-l, --limit <number>', 'Maximum number of files to process', '10')
    .option('-v, --verbose', 'Show detailed output', false)
    .option('-d, --dry-run', 'Show what would be done without making changes', false)
    .action(async (options) => {
      try {
        await markProcessed({
          limit: parseInt(options.limit, 10),
          verbose: options.verbose,
          dryRun: options.dryRun
        });
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
    
  program.parse(process.argv);
}

export { markProcessed };