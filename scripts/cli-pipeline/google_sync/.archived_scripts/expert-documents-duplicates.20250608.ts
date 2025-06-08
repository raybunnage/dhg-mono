#!/usr/bin/env ts-node
/**
 * Expert Documents Duplicates Finder
 * 
 * This script identifies and reports duplicate expert_documents records 
 * with the same source_id. Duplicates can cause confusion and inconsistency
 * in document processing.
 * 
 * The report includes:
 * - source_id
 * - expert_document id
 * - document_type_id
 * - document_processing_status
 * - sources_google name
 * 
 * Usage:
 *   ts-node expert-documents-duplicates.ts [options]
 * 
 * Options:
 *   --limit <n>        Limit the number of duplicate sets to display (default: 50)
 *   --verbose          Show detailed information about each duplicate set
 *   --output <path>    Write the report to a JSON file
 *   --format <format>  Output format (console or json, default: console)
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as fs from 'fs';

interface DuplicateReportOptions {
  limit?: number;
  verbose?: boolean;
  output?: string;
  format?: 'console' | 'json';
}

interface ExpertDocumentWithSource {
  id: string;
  source_id: string;
  document_type_id: string | null;
  document_processing_status: string | null;
  source_name: string | null;
  document_type_name?: string | null;
}

interface DuplicateGroup {
  source_id: string;
  source_name: string | null;
  count: number;
  documents: ExpertDocumentWithSource[];
}

/**
 * Finds and reports on duplicate expert_documents records with the same source_id
 */
async function findDuplicateExpertDocuments(options: DuplicateReportOptions = {}): Promise<DuplicateGroup[]> {
  console.log('=== Finding Duplicate Expert Documents ===');
  
  const limit = options.limit || 50;
  const verbose = options.verbose || false;
  
  console.log(`Mode: Report Only`);
  console.log(`Limit: ${limit} duplicate sets`);
  console.log(`Verbose: ${verbose ? 'Yes' : 'No'}`);
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Test connection
  console.log('\nTesting Supabase connection...');
  const connectionTest = await SupabaseClientService.getInstance().testConnection();
  if (!connectionTest.success) {
    throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
  }
  console.log('✅ Supabase connection test successful');
  
  // Step 1: Find source_ids that have multiple expert_documents entries
  console.log('\nFinding sources with multiple expert_documents entries...');
  
  // Use a workaround by fetching all expert_documents and grouping in memory
  const { data: allExpertDocs, error: fetchError } = await supabase
    .from('google_expert_documents')
    .select('source_id')
    .not('source_id', 'is', null);
    
  if (fetchError) {
    throw new Error(`Error fetching expert documents: ${fetchError.message}`);
  }
  
  // Group by source_id and count occurrences
  const sourceCounts = new Map<string, number>();
  
  if (allExpertDocs) {
    for (const doc of allExpertDocs) {
      if (!doc.source_id) continue;
      
      const count = sourceCounts.get(doc.source_id) || 0;
      sourceCounts.set(doc.source_id, count + 1);
    }
  }
  
  // Find sources with multiple documents
  const duplicateSourceIds: string[] = [];
  const duplicateCounts: Map<string, number> = new Map();
  
  // Convert to array to avoid MapIterator issues
  Array.from(sourceCounts.entries()).forEach(([sourceId, count]) => {
    if (count > 1) {
      duplicateSourceIds.push(sourceId);
      duplicateCounts.set(sourceId, count);
    }
  });
  
  // Sort by count (descending) and limit results
  duplicateSourceIds.sort((a, b) => (duplicateCounts.get(b) || 0) - (duplicateCounts.get(a) || 0));
  const limitedDuplicateIds = duplicateSourceIds.slice(0, limit);
  
  // Create a format compatible with the rest of the code
  const duplicateSources = limitedDuplicateIds.map(sourceId => ({
    source_id: sourceId,
    count: duplicateCounts.get(sourceId) || 0
  }));
  
  if (!duplicateSources || duplicateSources.length === 0) {
    console.log('No duplicate expert_documents found.');
    return [];
  }
  
  console.log(`Found ${duplicateSources.length} sources with multiple expert_documents entries.`);
  
  // Step 2: For each source with duplicates, get the details of all its expert_documents
  const duplicateGroups: DuplicateGroup[] = [];
  
  // Create a lookup function for document type names
  const documentTypeMap = new Map<string, string>();
  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, document_type');
  
  if (documentTypes) {
    documentTypes.forEach(dt => {
      documentTypeMap.set(dt.id, dt.document_type);
    });
  }
  
  for (const source of duplicateSources) {
    const sourceId = source.source_id;
    const count = source.count;
    
    // Get all expert_documents for this source
    const { data: documents, error: docsError } = await supabase
      .from('google_expert_documents')
      .select('id, source_id, document_type_id, document_processing_status')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });
      
    if (docsError) {
      console.warn(`Error getting expert_documents for source ${sourceId}: ${docsError.message}`);
      continue;
    }
    
    // Get the source name from sources_google
    const { data: sourceData, error: sourceError } = await supabase
      .from('google_sources')
      .select('name')
      .eq('id', sourceId)
      .limit(1);
      
    const sourceName = sourceData && sourceData.length > 0 ? sourceData[0].name : null;
    
    if (documents && documents.length > 0) {
      // Enhance the documents with source name and document type name
      const enhancedDocuments: ExpertDocumentWithSource[] = documents.map(doc => ({
        ...doc,
        source_name: sourceName,
        document_type_name: doc.document_type_id ? documentTypeMap.get(doc.document_type_id) || null : null
      }));
      
      duplicateGroups.push({
        source_id: sourceId,
        source_name: sourceName,
        count: count,
        documents: enhancedDocuments
      });
    }
  }
  
  return duplicateGroups;
}

// Main function to display the report
async function displayDuplicatesReport(options: DuplicateReportOptions = {}): Promise<void> {
  try {
    // Start command tracking
    const trackingId = await commandTrackingService.startTracking('google_sync', 'expert-documents-duplicates');
    
    // Find duplicate expert documents
    const duplicateGroups = await findDuplicateExpertDocuments(options);
    
    // Generate console report if needed
    if (options.format !== 'json' || !options.output) {
      console.log('\n=== Expert Documents Duplicates Report ===');
      
      if (duplicateGroups.length === 0) {
        console.log('No duplicates found.');
      } else {
        console.log(`Found ${duplicateGroups.length} sources with duplicate expert_documents.`);
        
        // Sort duplicates by count (most duplicates first)
        duplicateGroups.sort((a, b) => b.count - a.count);
        
        // Display table header
        console.log('\n-----------------------------------------------------------------------------------------------------------------------------------------');
        console.log('| Source ID                             | Expert Document ID                       | Document Type             | Processing Status   | Source Name                                                 |');
        console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
        
        // Display detailed information for each duplicate set
        for (const group of duplicateGroups) {
          if (options.verbose) {
            console.log(`\nSource: ${group.source_id} - ${group.source_name || 'Unknown'} (${group.count} expert documents)`);
          }
          
          for (const doc of group.documents) {
            // Prepare fields with proper padding
            const sourceId = doc.source_id.padEnd(40);
            const docId = doc.id.padEnd(40);
            const docType = (doc.document_type_name || 'null').substring(0, 25).padEnd(25);
            const status = (doc.document_processing_status || 'null').substring(0, 20).padEnd(20);
            const name = (doc.source_name || 'Unknown').substring(0, 60).padEnd(60);
            
            console.log(`| ${sourceId} | ${docId} | ${docType} | ${status} | ${name.substring(0, 55)} |`);
          }
          
          // Add a separator line between sources unless it's verbose mode (which already has good separation)
          if (!options.verbose) {
            console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
          }
        }
      }
    }
    
    // Generate JSON output if requested
    if (options.output) {
      const outputData = {
        timestamp: new Date().toISOString(),
        totalDuplicateSets: duplicateGroups.length,
        duplicates: duplicateGroups
      };
      
      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\nDetailed results written to: ${options.output}`);
    }
    
    // Complete tracking
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: duplicateGroups.length,
      summary: `Found ${duplicateGroups.length} sources with duplicate expert_documents entries`
    });
    
    console.log('\nExpert documents duplicates check complete!');
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Log tracking failure
    try {
      const trackingId = await commandTrackingService.startTracking('google_sync', 'expert-documents-duplicates');
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
  .name('expert-documents-duplicates')
  .description('Find and report on duplicate expert_documents with the same source_id')
  .option('--limit <number>', 'Limit the number of duplicate sets to report', '50')
  .option('--verbose', 'Show detailed information about each duplicate', false)
  .option('--output <path>', 'Write results to a JSON file')
  .option('--format <format>', 'Output format (console or json)', 'console')
  .action(async (options) => {
    const reportOptions: DuplicateReportOptions = {
      limit: parseInt(options.limit, 10),
      verbose: options.verbose,
      output: options.output,
      format: (options.format as 'console' | 'json') || 'console'
    };
    
    await displayDuplicatesReport(reportOptions);
  });

// Run the CLI if this module is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { findDuplicateExpertDocuments, displayDuplicatesReport };