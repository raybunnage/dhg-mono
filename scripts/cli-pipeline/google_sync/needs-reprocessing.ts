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
const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

// Supported file extensions that we want to process
const supportedExtensions = ['.docx', '.txt', '.pdf', '.pptx'];

/**
 * Processes sources_google records to set document_processing_status on their 
 * corresponding expert_documents records based on specific criteria:
 * 
 * 1. For files with supported extensions (.docx, .txt, .pdf, .pptx):
 *    a. If processed_content has JSON and expert_document has status "skip_processing", change to "reprocessing_done"
 *    b. If processed_content has JSON and expert_document has status "not_set", change to "reprocessing_done"
 *    c. If processed_content has no JSON, set expert_document status to "needs_reprocessing"
 * 
 * 2. Only process files with supported extensions
 */
export async function findAndUpdateNeedsReprocessing(options: {
  limit?: number;
  verbose?: boolean;
  dryRun?: boolean;
  batchSize?: number;
}) {
  const limit = options.limit || 1000;
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;
  const batchSize = options.batchSize || 50;
  
  console.log(`Processing sources_google and expert_documents records to update document processing status (limit: ${limit})...`);
  console.log(`${dryRun ? 'DRY RUN MODE - No changes will be made' : 'LIVE MODE - Changes will be applied'}`);

  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'needs-reprocessing');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  let statsUpdated = 0;
  let statsSkipped = 0;
  let statsNeedsReprocessing = 0;
  let statsReprocessingDone = 0;
  let statsErrors = 0;

  try {
    // Test Supabase connection first
    console.log('Testing Supabase connection...');
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    
    console.log('✅ Supabase connection test successful');

    // Process records in batches
    let processed = 0;
    let hasMore = true;
    let lastId: string | null = null;

    // First get all sources_google records
    while (hasMore && processed < limit) {
      // Build query for this batch
      let query = supabaseClient
        .from('sources_google')
        .select('id, name')
        .order('id')
        .limit(batchSize);

      // Apply pagination using lastId
      if (lastId) {
        query = query.gt('id', lastId);
      }

      // Execute query
      const { data: sourcesGoogleBatch, error: batchError } = await query;

      if (batchError) {
        console.error(`Error fetching batch: ${batchError.message}`);
        statsErrors++;
        continue;
      }

      if (!sourcesGoogleBatch || sourcesGoogleBatch.length === 0) {
        hasMore = false;
        break;
      }

      // Update lastId for next iteration
      lastId = sourcesGoogleBatch[sourcesGoogleBatch.length - 1].id;

      console.log(`Processing batch of ${sourcesGoogleBatch.length} sources_google records...`);
      
      // Filter for files with supported extensions
      const supportedFiles = sourcesGoogleBatch.filter(source => {
        if (!source.name) return false;
        const lcName = source.name.toLowerCase();
        return supportedExtensions.some(ext => lcName.endsWith(ext));
      });

      if (verbose) {
        console.log(`Found ${supportedFiles.length} files with supported extensions in this batch`);
      }

      // Process each file with supported extension
      for (const source of supportedFiles) {
        try {
          // Get the corresponding expert_document record with processed_content field
          const { data: expertDocs, error: expertDocsError } = await supabaseClient
            .from('expert_documents')
            .select('id, document_processing_status, processed_content')
            .eq('source_id', source.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (expertDocsError) {
            console.error(`Error fetching expert_document for source ${source.id}: ${expertDocsError.message}`);
            statsErrors++;
            continue;
          }

          if (!expertDocs || expertDocs.length === 0) {
            if (verbose) {
              console.log(`No expert_document found for source ${source.id} (${source.name})`);
            }
            statsSkipped++;
            continue;
          }

          const expertDoc = expertDocs[0];
          const currentStatus = expertDoc.document_processing_status;
          let newStatus = currentStatus;
          
          // Check if processed_content has JSON
          const hasJsonContent = expertDoc.processed_content && 
            typeof expertDoc.processed_content === 'object' && 
            Object.keys(expertDoc.processed_content).length > 0;

          // Apply the business rules
          if (hasJsonContent) {
            // If has JSON content and status is skip_processing or not_set, change to reprocessing_done
            if (currentStatus === 'skip_processing' || currentStatus === 'not_set') {
              newStatus = 'reprocessing_done';
            }
          } else {
            // If no JSON content, set to needs_reprocessing
            newStatus = 'needs_reprocessing';
          }

          // Only update if status changed
          if (newStatus !== currentStatus) {
            if (verbose || newStatus === 'needs_reprocessing') {
              console.log(`${dryRun ? '[DRY RUN]' : ''} Updating ${source.name} (${source.id}) from ${currentStatus || 'null'} to ${newStatus}`);
            }

            if (!dryRun) {
              const { error: updateError } = await supabaseClient
                .from('expert_documents')
                .update({ 
                  document_processing_status: newStatus,
                  document_processing_status_updated_at: new Date().toISOString()
                })
                .eq('id', expertDoc.id);

              if (updateError) {
                console.error(`Error updating expert_document ${expertDoc.id}: ${updateError.message}`);
                statsErrors++;
                continue;
              }
            }

            statsUpdated++;
            if (newStatus === 'needs_reprocessing') {
              statsNeedsReprocessing++;
            } else if (newStatus === 'reprocessing_done') {
              statsReprocessingDone++;
            }
          } else {
            if (verbose) {
              console.log(`Skipping ${source.name} (${source.id}) - status already ${currentStatus || 'null'}`);
            }
            statsSkipped++;
          }
        } catch (error) {
          console.error(`Error processing source ${source.id}: ${error instanceof Error ? error.message : String(error)}`);
          statsErrors++;
        }
      }

      processed += sourcesGoogleBatch.length;
      
      console.log(`Processed ${processed} sources, found ${supportedFiles.length} supported files. Updated: ${statsUpdated} (needs_reprocessing: ${statsNeedsReprocessing}, reprocessing_done: ${statsReprocessingDone})`);
      
      // Add a small delay between batches to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Display summary
    console.log('\nProcessing Summary:');
    console.log(`Total records processed: ${processed}`);
    console.log(`Records updated: ${statsUpdated}`);
    console.log(`  → Set to needs_reprocessing: ${statsNeedsReprocessing}`);
    console.log(`  → Set to reprocessing_done: ${statsReprocessingDone}`);
    console.log(`Records skipped (no change needed): ${statsSkipped}`);
    console.log(`Errors encountered: ${statsErrors}`);

    if (dryRun) {
      console.log('\n⚠️ DRY RUN - No changes were made to the database');
    }

    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: statsUpdated,
          summary: `Updated ${statsUpdated} documents (${statsNeedsReprocessing} needs_reprocessing, ${statsReprocessingDone} reprocessing_done)`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      processed,
      updated: statsUpdated,
      needsReprocessing: statsNeedsReprocessing,
      reprocessingDone: statsReprocessingDone,
      skipped: statsSkipped,
      errors: statsErrors
    };
  } catch (error) {
    console.error(`Error processing sources_google records: ${error instanceof Error ? error.message : String(error)}`);
    
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
    .name('needs-reprocessing')
    .description('Process sources_google records to update document processing status for supported file types')
    .option('-l, --limit <number>', 'Maximum number of sources_google records to process', '1000')
    .option('-b, --batch-size <number>', 'Number of records to process in each batch', '50')
    .option('-v, --verbose', 'Show detailed output for each record')
    .option('--dry-run', 'Show what would be done without making changes')
    .action((options) => {
      findAndUpdateNeedsReprocessing({
        limit: parseInt(options.limit),
        batchSize: parseInt(options.batchSize),
        verbose: options.verbose,
        dryRun: options.dryRun
      });
    });

  program.parse(process.argv);
}