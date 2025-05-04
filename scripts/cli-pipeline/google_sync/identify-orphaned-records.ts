#\!/usr/bin/env ts-node

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';

interface IdentifyOptions {
  limit: number;
  output: string;
  verbose: boolean;
}

interface OrphanedRecord {
  id: string;
  source_id: string | null;
  document_type_id: string | null;
  document_processing_status: string | null;
  created_at: string | null;
}

interface PresentationAsset {
  id: string;
  presentation_id: string;
  expert_document_id: string;
  created_at: string | null;
}

interface IdentifyResult {
  orphanedRecordsFound: number;
  presentationAssetsFound: number;
  orphanedRecords: OrphanedRecord[];
  presentationAssets: PresentationAsset[];
}

async function identifyOrphanedRecords(options: IdentifyOptions): Promise<void> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log('Testing Supabase connection...');
    const connectionTest = await SupabaseClientService.getInstance().testConnection();
    if (\!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    console.log('✅ Supabase connection test successful');
    
    // Step 1: Get all valid source IDs from sources_google
    console.log('Fetching valid source IDs from sources_google...');
    const { data: validSources, error: sourcesError } = await supabase
      .from('sources_google')
      .select('id');
      
    if (sourcesError) {
      throw new Error(`Failed to fetch sources_google: ${sourcesError.message}`);
    }
    
    const validSourceIds = new Set((validSources || []).map(source => source.id));
    console.log(`Found ${validSourceIds.size} valid source IDs`);
    
    // Step 2: Get expert_documents
    console.log('Fetching expert_documents...');
    const { data: expertDocs, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_type_id, document_processing_status, created_at');
      
    if (docsError) {
      throw new Error(`Failed to fetch expert_documents: ${docsError.message}`);
    }
    
    // Step 3: Find orphaned records
    const orphanedDocs = (expertDocs || []).filter(doc => 
      \!doc.source_id || \!validSourceIds.has(doc.source_id)
    );
    
    const limitedOrphanedDocs = orphanedDocs.slice(0, options.limit);
    console.log(`Found ${orphanedDocs.length} orphaned expert_documents`);
    console.log(`Limited to ${limitedOrphanedDocs.length} records`);
    
    if (options.verbose && limitedOrphanedDocs.length > 0) {
      console.log('\nOrphaned expert_documents:');
      console.table(limitedOrphanedDocs);
    }
    
    // Step 4: Get related presentation_assets
    if (limitedOrphanedDocs.length === 0) {
      // No orphaned records to process
      const result: IdentifyResult = {
        orphanedRecordsFound: 0,
        presentationAssetsFound: 0,
        orphanedRecords: [],
        presentationAssets: []
      };
      
      fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
      console.log(`Results written to ${options.output}`);
      return;
    }
    
    const orphanedIds = limitedOrphanedDocs.map(doc => doc.id);
    
    console.log('Fetching related presentation_assets...');
    const { data: presentationAssets, error: assetsError } = await supabase
      .from('presentation_assets')
      .select('id, presentation_id, expert_document_id, created_at')
      .in('expert_document_id', orphanedIds);
      
    if (assetsError) {
      throw new Error(`Failed to fetch presentation_assets: ${assetsError.message}`);
    }
    
    console.log(`Found ${presentationAssets?.length || 0} related presentation_assets`);
    
    if (options.verbose && presentationAssets && presentationAssets.length > 0) {
      console.log('\nRelated presentation_assets:');
      console.table(presentationAssets);
    }
    
    // Step 5: Write results to file
    const result: IdentifyResult = {
      orphanedRecordsFound: limitedOrphanedDocs.length,
      presentationAssetsFound: presentationAssets?.length || 0,
      orphanedRecords: limitedOrphanedDocs,
      presentationAssets: presentationAssets || []
    };
    
    fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
    console.log(`Results written to ${options.output}`);
    
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Set up command line interface
const program = new Command();

program
  .name('identify-orphaned-records')
  .description('Identify orphaned expert_documents records and related presentation_assets')
  .option('--limit <number>', 'Limit for orphaned records to process', '100')
  .option('--output <path>', 'Output file path for results', '/tmp/orphaned-records.json')
  .option('--verbose', 'Show detailed information during processing', false)
  .action(async (options) => {
    await identifyOrphanedRecords({
      limit: parseInt(options.limit, 10),
      output: options.output,
      verbose: options.verbose
    });
  });

if (require.main === module) {
  program.parse(process.argv);
}
