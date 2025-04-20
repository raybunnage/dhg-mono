#!/usr/bin/env ts-node
import { Command } from 'commander';
import { config } from 'dotenv';
import { resolve } from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

// Load environment variables from different locations
const rootDir = resolve(__dirname, '../../..');

// Try to load from various .env files
const envFiles = ['.env', '.env.local', '.env.development'];
for (const file of envFiles) {
  const envPath = resolve(rootDir, file);
  try {
    const result = config({ path: envPath });
    if (result.parsed) {
      console.log(`Loaded environment from ${envPath}`);
    }
  } catch (e) {
    console.error(`Error loading ${envPath}:`, e);
  }
}

// Initialize Supabase client
const supabaseClient = SupabaseClientService.getInstance().getClient();

/**
 * Checks the reprocessing status of expert documents based on their metadata field
 * 
 * This command:
 * 1. Fetches sources_google records based on filtering options
 * 2. Looks up corresponding expert_documents
 * 3. Checks the metadata.needs_reprocessing field in each expert document
 * 4. Reports statistics and details about reprocessing status
 */
export async function checkReprocessingStatus(options: { 
  limit?: number; 
  filter?: string;
  expert?: string;
  verbose?: boolean;
  batchSize?: number;
  format?: 'json' | 'table';
  outputPath?: string;
  dryRun?: boolean;
}) {
  const limit = options.limit || 100;
  const batchSize = options.batchSize || 50;
  const verbose = options.verbose || false;
  const format = options.format || 'table';
  const dryRun = options.dryRun || false;
  
  console.log(`Checking reprocessing status of expert documents (limit: ${limit})...`);

  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'check-reprocessing-status');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    // Initialize summary stats
    const stats = {
      totalSources: 0,
      sourcesWithExpertDocs: 0,
      needsReprocessing: 0,
      reprocessingDone: 0,
      skipProcessing: 0, 
      notSet: 0
    };

    // Detailed results for output
    const results: Array<{
      sourceId: string;
      sourceName: string;
      expertDocId: string | null;
      processingStatus: string | null;
      processingReason: string | null;
      documentType: string | null;
    }> = [];

    // 1. Fetch sources from sources_google with filtering
    let query = supabaseClient
      .from('sources_google')
      .select('id, name, document_type_id')
      .limit(limit);
    
    // Apply name filter if provided
    if (options.filter) {
      query = query.ilike('name', `%${options.filter}%`);
    }
    
    // Apply expert filter if provided
    if (options.expert) {
      // First get the expert ID
      const { data: expertData, error: expertError } = await supabaseClient
        .from('experts')
        .select('id')
        .eq('expert_name', options.expert)
        .maybeSingle();
      
      if (expertError) {
        console.error(`Error fetching expert: ${expertError.message}`);
      } else if (expertData) {
        // Get sources_google_experts with this expert_id
        const { data: sourceExperts, error: sourceExpertsError } = await supabaseClient
          .from('sources_google_experts')
          .select('source_id')
          .eq('expert_id', expertData.id);
        
        if (sourceExpertsError) {
          console.error(`Error fetching sources_google_experts: ${sourceExpertsError.message}`);
        } else if (sourceExperts && sourceExperts.length > 0) {
          // Filter sources by these IDs
          query = query.in('id', sourceExperts.map(se => se.source_id));
        } else {
          console.warn(`No sources found for expert '${options.expert}'.`);
        }
      } else {
        console.warn(`Expert '${options.expert}' not found. No filter will be applied.`);
      }
    }
    
    // Execute the sources query
    const { data: sources, error: sourcesError } = await query;
    
    if (sourcesError) {
      console.error(`Error fetching sources: ${sourcesError.message}`);
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }
    
    if (!sources || sources.length === 0) {
      console.log('No sources found matching the criteria.');
      return;
    }
    
    stats.totalSources = sources.length;
    console.log(`Found ${sources.length} sources.`);
    
    // 2. For each source, find the corresponding expert document
    // Process in batches to avoid hitting limits
    for (let i = 0; i < sources.length; i += batchSize) {
      const batchSources = sources.slice(i, i + batchSize);
      const sourceIds = batchSources.map(source => source.id);
      
      const { data: expertDocs, error: expertDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id, source_id, document_type_id, processing_status, processing_skip_reason')
        .in('source_id', sourceIds);
      
      if (expertDocsError) {
        console.error(`Error fetching expert documents for batch ${i}-${i+batchSize}: ${expertDocsError.message}`);
        continue;
      }
      
      if (!expertDocs || expertDocs.length === 0) {
        console.log(`No expert documents found for batch ${i}-${i+batchSize}.`);
        
        // Add results for sources without expert docs
        for (const source of batchSources) {
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            expertDocId: null,
            processingStatus: null,
            processingReason: null,
            documentType: null
          });
        }
        
        continue;
      }
      
      // Create a map for quick lookups
      const expertDocMap = new Map(expertDocs.map(doc => [doc.source_id, doc]));
      
      // Process each source in this batch
      for (const source of batchSources) {
        const expertDoc = expertDocMap.get(source.id);
        
        if (expertDoc) {
          stats.sourcesWithExpertDocs++;
          
          // Check processing status
          const processingStatus = expertDoc.processing_status || 'not_set';
          const processingReason = expertDoc.processing_skip_reason;
          
          // Update stats based on processing status
          if (processingStatus === 'needs_reprocessing') {
            stats.needsReprocessing++;
          } else if (processingStatus === 'reprocessing_done') {
            stats.reprocessingDone++;
          } else if (processingStatus === 'skip_processing') {
            stats.skipProcessing++;
          } else if (processingStatus === 'not_set') {
            stats.notSet++;
          }
          
          // Get document type name if available
          let documentTypeName: string | null = null;
          if (expertDoc.document_type_id) {
            const { data: docType, error: docTypeError } = await supabaseClient
              .from('document_types')
              .select('document_type')
              .eq('id', expertDoc.document_type_id)
              .maybeSingle();
            
            if (!docTypeError && docType) {
              documentTypeName = docType.document_type;
            }
          }
          
          // Add to results
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            expertDocId: expertDoc.id,
            processingStatus,
            processingReason,
            documentType: documentTypeName
          });
          
          if (verbose) {
            console.log(`Source: ${source.name} (${source.id})`);
            console.log(`  Expert Document: ${expertDoc.id}`);
            console.log(`  Document Type: ${documentTypeName || 'Unknown'}`);
            console.log(`  Processing Status: ${processingStatus}`);
            if (processingReason) {
              console.log(`  Processing Reason: ${processingReason}`);
            }
            console.log('');
          }
        } else {
          // Add to results for sources without expert docs
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            expertDocId: null,
            processingStatus: null,
            processingReason: null,
            documentType: null
          });
          
          if (verbose) {
            console.log(`Source: ${source.name} (${source.id})`);
            console.log(`  No expert document found`);
            console.log('');
          }
        }
      }
      
      console.log(`Processed batch ${i+1}-${Math.min(i+batchSize, sources.length)} of ${sources.length} sources.`);
    }
    
    // Print summary statistics
    console.log('\nSummary Statistics:');
    console.log(`Total sources: ${stats.totalSources}`);
    console.log(`Sources with expert documents: ${stats.sourcesWithExpertDocs}`);
    console.log(`Documents needing reprocessing: ${stats.needsReprocessing}`);
    console.log(`Documents with reprocessing done: ${stats.reprocessingDone}`);
    console.log(`Documents with skip processing flag: ${stats.skipProcessing}`);
    console.log(`Documents with no processing status set: ${stats.notSet}`);
    
    // Output detailed results if requested
    if (options.outputPath) {
      const fs = require('fs');
      const path = require('path');
      
      try {
        // Format the output
        let output: string;
        if (format === 'json') {
          output = JSON.stringify(results, null, 2);
        } else {
          // Simple table format
          output = 'Source ID,Source Name,Expert Doc ID,Processing Status,Processing Reason,Document Type\n';
          for (const result of results) {
            output += `${result.sourceId},${result.sourceName},${result.expertDocId || 'N/A'},${result.processingStatus || 'N/A'},${result.processingReason || 'N/A'},${result.documentType || 'N/A'}\n`;
          }
        }
        
        // Write to file
        if (!dryRun) {
          fs.writeFileSync(path.resolve(options.outputPath), output);
          console.log(`\nDetailed results written to: ${options.outputPath}`);
        } else {
          console.log(`\n[DRY RUN] Would write detailed results to: ${options.outputPath}`);
        }
      } catch (error) {
        console.error(`Error writing output file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: stats.totalSources,
          summary: `Checked reprocessing status: ${stats.needsReprocessing} need reprocessing, ${stats.reprocessingDone} done, ${stats.skipProcessing} skipped, ${stats.notSet} not set`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return stats;
  } catch (error) {
    console.error(`Error checking reprocessing status: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.failTracking(trackingId, `Command failed: ${error instanceof Error ? error.message : String(error)}`);
      } catch (trackingError) {
        console.warn(`Warning: Unable to record command failure: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }
  }
}

// Set up CLI
if (require.main === module) {
  const program = new Command();

  program
    .name('check-reprocessing-status')
    .description('Check the reprocessing status of expert documents')
    .option('-l, --limit <number>', 'Maximum number of sources to check', '100')
    .option('-f, --filter <string>', 'Filter sources by name')
    .option('-e, --expert <string>', 'Filter sources by expert name')
    .option('-v, --verbose', 'Show detailed output')
    .option('-b, --batch-size <number>', 'Number of records to process in each batch', '50')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .option('-o, --output <path>', 'Output file path for the report')
    .option('--dry-run', 'Show what would be done without writing output file')
    .action((options) => {
      checkReprocessingStatus({
        limit: parseInt(options.limit),
        filter: options.filter,
        expert: options.expert,
        verbose: options.verbose,
        batchSize: parseInt(options.batchSize),
        format: options.format,
        outputPath: options.output,
        dryRun: options.dryRun
      });
    });

  program.parse(process.argv);
}