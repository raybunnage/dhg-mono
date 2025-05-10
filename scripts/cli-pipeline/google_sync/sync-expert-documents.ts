#!/usr/bin/env ts-node

import { v4 as uuidv4 } from 'uuid';
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();

interface SyncExpertDocumentsOptions {
  limit?: number;
  dryRun?: boolean;
  verbose?: boolean;
}

program
  .name('sync-expert-documents')
  .description('Check sources_google files against expert_documents records and sync them')
  .option('-l, --limit <number>', 'Limit the number of records to process', parseInt)
  .option('-d, --dry-run', 'Perform a dry run without making changes to the database', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (options: SyncExpertDocumentsOptions) => {
    await syncExpertDocuments(options);
  });

/**
 * Process a list of sources to create expert_documents records
 */
async function processSourcesForSync(sources: any[], options: SyncExpertDocumentsOptions): Promise<void> {
  const { dryRun = false, verbose = false } = options;
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // If dry run, just show what would be created
  if (dryRun) {
    if (verbose) {
      sources?.forEach((source) => {
        console.log(`Would create expert_documents record for: ${source.name} (ID: ${source.id})`);
      });
    }
    console.log(`Dry run completed. Would create ${sources?.length || 0} expert_documents records.`);
    return;
  }
  
  // Process each missing source and create expert_documents records
  const createdRecords = [];
  const totalSources = sources?.length || 0;
  let processingErrors = 0;
  
  for (let i = 0; i < totalSources; i++) {
    const source = sources[i];
    
    // Show progress for large batches
    if (i % 10 === 0 || i === totalSources - 1) {
      const percentComplete = Math.round((i / totalSources) * 100);
      process.stdout.write(`\rProcessing: ${i + 1}/${totalSources} (${percentComplete}%) - Created: ${createdRecords.length}, Errors: ${processingErrors}`);
    }
    
    if (verbose) {
      console.log(`\nCreating expert_documents record for: ${source.name} (ID: ${source.id})`);
    }
    
    const { data: insertedRecord, error: insertError } = await supabase
      .from('expert_documents')
      .insert({
        id: uuidv4(),
        source_id: source.id,
        document_type_id: source.document_type_id,
        title: source.name,
        pipeline_status: 'unprocessed',
        reprocessing_status: 'not_set'
      })
      .select();
    
    if (insertError) {
      processingErrors++;
      console.error(`\nError creating expert_documents record for ${source.id}:`, insertError.message);
      continue;
    }
    
    createdRecords.push(insertedRecord[0]);
    
    if (verbose) {
      console.log(`✅ Created expert_documents record: ${insertedRecord[0].id}`);
    }
  }
  
  // Add a newline after progress indicator
  console.log();
  
  console.log(`Successfully created ${createdRecords.length} expert_documents records`);
}

async function syncExpertDocuments(options: SyncExpertDocumentsOptions): Promise<void> {
  const { limit = 500, dryRun = false, verbose = false } = options;
  
  console.log(`Starting to sync expert_documents with sources_google files...`);
  console.log(`Options: limit=${limit}, dryRun=${dryRun}, verbose=${verbose}`);
  
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Try with RPC first - this would be the most efficient method if the function exists
    try {
      const { data: missingSources, error: missingSourcesError } = await supabase
        .rpc('get_sources_without_expert_documents', { limit_count: limit });
        
      if (!missingSourcesError && missingSources) {
        console.log(`Found ${missingSources.length} sources without expert_documents records via RPC`);
        return processSourcesForSync(missingSources, options);
      }
      
      // If we get here, the RPC didn't exist or there was an error
      console.log('RPC not available, trying alternate approach...');
    } catch (rpcError) {
      console.log('RPC call failed, trying alternate approach...');
    }
    
    // Fallback to a simpler query approach
    // Get all sources_google files that are not folders
    const { data: allSources, error: allSourcesError } = await supabase
      .from('sources_google')
      .select(`
        id,
        name,
        mime_type,
        document_type_id
      `)
      .is('is_deleted', false)
      .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
      .limit(limit);
      
    if (allSourcesError) {
      console.error('Error fetching sources:', allSourcesError.message);
      process.exit(1);
    }
    
    // Get all source_ids with expert_documents
    const { data: existingDocs, error: existingDocsError } = await supabase
      .from('expert_documents')
      .select('source_id');
      
    if (existingDocsError) {
      console.error('Error fetching existing expert documents:', existingDocsError.message);
      process.exit(1);
    }
    
    // Convert to a Set for faster lookups
    const existingSourceIds = new Set(existingDocs?.map(doc => doc.source_id) || []);
    
    // Filter sources that don't have expert_documents
    const filteredSources = allSources?.filter(source => !existingSourceIds.has(source.id)) || [];
    
    console.log(`Found ${filteredSources.length} sources without expert_documents records`);
    
    // Process the filtered sources
    return processSourcesForSync(filteredSources, options);
    
  } catch (error) {
    console.error('An unexpected error occurred:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  program.parse(process.argv);
}

export default program;