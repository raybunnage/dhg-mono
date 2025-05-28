#!/usr/bin/env ts-node
/**
 * Clear Reprocessing Status Command
 * 
 * For each sources_google record:
 * 1. Find the corresponding expert_documents record
 * 2. Set document_processing_status to "not_set" for any record that has "needs_reprocessing"
 * 3. For any record with unsupported document types, set document_processing_status to "skip_processing"
 * 4. For any record with "skip_processing" status where the source file ends with .txt, .docx, .pdf or .pptx,
 *    set document_processing_status to "not_set" instead
 * 
 * Usage:
 *   ts-node clear-reprocessing.ts [options]
 * 
 * Options:
 *   --dry-run          Show changes without actually applying them
 *   --verbose          Show detailed output
 *   --limit <n>        Process a maximum of n records (default: 500)
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import type { Database } from '../../../supabase/types';
import path from 'path';


interface ClearReprocessingOptions {
  dryRun?: boolean;
  verbose?: boolean;
  limit?: number;
}

interface ClearReprocessingResults {
  total: number;
  notSetCount: number;
  skipCount: number;
  unchanged: number;
  skipReprocessingToNotSet: number;
  errors: string[];
}

async function clearReprocessingStatus(options: ClearReprocessingOptions = {}): Promise<ClearReprocessingResults> {
  const result: ClearReprocessingResults = {
    total: 0,
    notSetCount: 0,
    skipCount: 0,
    unchanged: 0,
    skipReprocessingToNotSet: 0,
    errors: []
  };

  try {
    console.log('\n=== Clearing Reprocessing Status ===');
    console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    
    const supabase = SupabaseClientService.getInstance().getClient();

    // First, get a list of unsupported document types
    console.log('Fetching unsupported document types...');
    
    // Get all document types
    const { data: allDocTypes, error: typesError } = await supabase
      .from('document_types')
      .select('id, document_type, category, classifier');
      
    if (typesError) {
      throw new Error(`Error fetching document types: ${typesError.message}`);
    }
    
    // Filter for unsupported document types (null or empty classifier)
    const unsupportedTypes = allDocTypes?.filter(type => 
      !type.classifier || type.classifier === ''
    ) || [];
    
    const unsupportedTypeIds = new Set((unsupportedTypes || []).map(type => type.id));
    console.log(`Found ${unsupportedTypeIds.size} unsupported document types`);
    
    if (options.verbose && unsupportedTypes && unsupportedTypes.length > 0) {
      console.log('\nUnsupported document types:');
      unsupportedTypes.forEach(type => {
        console.log(`- ${type.document_type} (${type.id}, Category: ${type.category})`);
      });
    }

    // Now find expert_documents that need updating
    console.log('\nFinding expert documents with "needs_reprocessing" status...');
    const { data: needsReprocessingDocs, error: docsError } = await supabase
      .from('google_expert_documents')
      .select(`
        id, 
        source_id, 
        document_type_id, 
        document_processing_status
      `)
      .eq('document_processing_status', 'needs_reprocessing')
      .limit(options.limit || 500);
      
    if (docsError) {
      throw new Error(`Error fetching expert documents: ${docsError.message}`);
    }
    
    // Fetch sources information separately
    let sourceInfo = new Map<string, { name: string; mime_type: string }>();
    
    if (needsReprocessingDocs && needsReprocessingDocs.length > 0) {
      const sourceIds = needsReprocessingDocs.map(doc => doc.source_id).filter(Boolean);
      
      if (sourceIds.length > 0) {
        const { data: sources, error: sourcesError } = await supabase
          .from('google_sources')
          .select('id, name, mime_type')
          .in('id', sourceIds);
          
        if (sourcesError) {
          console.warn(`Warning: Could not fetch source information: ${sourcesError.message}`);
        } else if (sources) {
          // Create a map for quick lookups
          sources.forEach(source => {
            sourceInfo.set(source.id, { 
              name: source.name || 'Unknown',
              mime_type: source.mime_type || 'Unknown'
            });
          });
          
          if (options.verbose) {
            console.log(`Retrieved information for ${sources.length} source records`);
          }
        }
      }
    }
    
    if (!needsReprocessingDocs || needsReprocessingDocs.length === 0) {
      console.log('No expert documents with "needs_reprocessing" status found.');
      // Continue with checking for skip_processing documents rather than returning early
    }
    
    // Define batch size for all operations
    const batchSize = 50;
    
    // Only process needs_reprocessing if there are any
    if (needsReprocessingDocs && needsReprocessingDocs.length > 0) {
      console.log(`Found ${needsReprocessingDocs.length} expert documents with "needs_reprocessing" status`);
      result.total = needsReprocessingDocs.length;
    
      // Process documents in batches
      const batches = Math.ceil(needsReprocessingDocs.length / batchSize);
      
      // Prepare records to update with "not_set" status (for documents with valid document types)
      const notSetRecords: string[] = [];
      
      // Prepare records to update with "skip_processing" status (for documents with unsupported types)
      const skipRecords: string[] = [];
      
      // Track documents that don't need changes
      const unchangedRecords: string[] = [];
      
      // Identify which documents should be updated with which status
      for (const doc of needsReprocessingDocs) {
        if (!doc.document_type_id) {
          // If no document type is set, mark as not_set
          notSetRecords.push(doc.id);
          
          if (options.verbose) {
            const fileName = sourceInfo.get(doc.source_id)?.name || 'Unknown';
            console.log(`Setting ${fileName} to "not_set" (no document type)`);
          }
        } else if (unsupportedTypeIds.has(doc.document_type_id)) {
          // If document has an unsupported type, mark as skip_processing
          skipRecords.push(doc.id);
          
          if (options.verbose) {
            const fileName = sourceInfo.get(doc.source_id)?.name || 'Unknown';
            console.log(`Setting ${fileName} to "skip_processing" (unsupported document type)`);
          }
        } else {
          // Otherwise, mark as not_set
          notSetRecords.push(doc.id);
          
          if (options.verbose) {
            const fileName = sourceInfo.get(doc.source_id)?.name || 'Unknown';
            console.log(`Setting ${fileName} to "not_set" (supported document type)`);
          }
        }
      }
      
      console.log('\nUpdate Summary:');
      console.log(`- Documents to set to "not_set": ${notSetRecords.length}`);
      console.log(`- Documents to set to "skip_processing": ${skipRecords.length}`);
      console.log(`- Documents unchanged: ${unchangedRecords.length}`);
      
      // If dry run, don't make changes
      if (!options.dryRun) {
        // Update documents with "not_set" status in batches
        if (notSetRecords.length > 0) {
          console.log(`\nUpdating ${notSetRecords.length} documents to "not_set" status...`);
          
          const notSetBatches = Math.ceil(notSetRecords.length / batchSize);
          let notSetUpdated = 0;
          
          for (let i = 0; i < notSetBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, notSetRecords.length);
            const batch = notSetRecords.slice(start, end);
            
            const { error: updateError } = await supabase
              .from('google_expert_documents')
              .update({
                document_processing_status: 'not_set',
                document_processing_status_updated_at: new Date().toISOString()
              })
              .in('id', batch);
              
            if (updateError) {
              console.error(`Error updating batch ${i + 1} to "not_set": ${updateError.message}`);
              result.errors.push(`Error updating batch ${i + 1} to "not_set": ${updateError.message}`);
            } else {
              notSetUpdated += batch.length;
              console.log(`Updated ${batch.length} documents to "not_set" (batch ${i + 1}/${notSetBatches})`);
            }
          }
          
          result.notSetCount = notSetUpdated;
          console.log(`✅ Successfully updated ${notSetUpdated} documents to "not_set" status`);
        }
        
        // Update documents with "skip_processing" status in batches
        if (skipRecords.length > 0) {
          console.log(`\nUpdating ${skipRecords.length} documents to "skip_processing" status...`);
          
          const skipBatches = Math.ceil(skipRecords.length / batchSize);
          let skipUpdated = 0;
          
          for (let i = 0; i < skipBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, skipRecords.length);
            const batch = skipRecords.slice(start, end);
            
            const { error: updateError } = await supabase
              .from('google_expert_documents')
              .update({
                document_processing_status: 'skip_processing',
                document_processing_status_updated_at: new Date().toISOString(),
                processing_skip_reason: 'Unsupported document type'
              })
              .in('id', batch);
              
            if (updateError) {
              console.error(`Error updating batch ${i + 1} to "skip_processing": ${updateError.message}`);
              result.errors.push(`Error updating batch ${i + 1} to "skip_processing": ${updateError.message}`);
            } else {
              skipUpdated += batch.length;
              console.log(`Updated ${batch.length} documents to "skip_processing" (batch ${i + 1}/${skipBatches})`);
            }
          }
          
          result.skipCount = skipUpdated;
          console.log(`✅ Successfully updated ${skipUpdated} documents to "skip_processing" status`);
        }
      } else {
        console.log('\n[DRY RUN] Would update document processing statuses as shown above');
        result.notSetCount = notSetRecords.length;
        result.skipCount = skipRecords.length;
        result.unchanged = unchangedRecords.length;
      }
    }
    
    // Now find and update skip_processing documents with specific file extensions
    console.log('\nFinding documents marked as "skip_processing" with specific file extensions (.txt, .docx, .pdf, .pptx)...');
    
    // Get the expert_documents with skip_processing status 
    const { data: skipReprocessingDocs, error: skipReprocessingError } = await supabase
      .from('google_expert_documents')
      .select(`
        id, 
        source_id, 
        document_processing_status
      `)
      .eq('document_processing_status', 'skip_processing')
      .limit(options.limit || 500);
      
    if (skipReprocessingError) {
      console.error(`Error fetching skip_processing expert documents: ${skipReprocessingError.message}`);
      result.errors.push(`Error fetching skip_processing expert documents: ${skipReprocessingError.message}`);
    } else if (skipReprocessingDocs && skipReprocessingDocs.length > 0) {
      console.log(`Found ${skipReprocessingDocs.length} documents with "skip_processing" status`);
      
      // Get source information for these documents
      const sourceIds = skipReprocessingDocs.map(doc => doc.source_id).filter(Boolean);
      
      if (sourceIds.length > 0) {
        try {
          // Process documents regardless of whether we can fetch source information
          // because we know the file extensions we want to target
          console.log('Processing all skip_processing documents with specified file extensions...');
          console.log('(This will work even if source metadata cannot be fetched)');

          // Collect all document IDs to update - we'll process ALL "skip_processing" documents
          // with the specified file extensions based on the sources IDs
          const docsToUpdate: string[] = [];
          const targetExtensions = ['.txt', '.docx', '.pdf', '.pptx'];
          let processed = 0;

          // Get documents in batches to avoid hitting API limits
          const batchSize = 20;
          for (let i = 0; i < skipReprocessingDocs.length; i += batchSize) {
            const docsBatch = skipReprocessingDocs.slice(i, i + batchSize);
            
            try {
              // Get sources for this batch of documents
              const batchSourceIds = docsBatch.map(doc => doc.source_id).filter(Boolean);
              
              if (batchSourceIds.length === 0) continue;
              
              const { data: sources, error: sourcesError } = await supabase
                .from('google_sources')
                .select('id, name')
                .in('id', batchSourceIds);
                
              if (sourcesError) {
                console.warn(`Warning: Could not fetch sources for batch. Using all IDs from this batch as fallback.`);
                // Add all document IDs from this batch as a fallback
                docsBatch.forEach(doc => docsToUpdate.push(doc.id));
                continue;
              }
              
              if (sources && sources.length > 0) {
                // Map source IDs to names for quick lookup
                const sourceMap = new Map<string, string>();
                sources.forEach(source => {
                  if (source.id && source.name) {
                    sourceMap.set(source.id, source.name);
                  }
                });
                
                // Check each document in this batch
                for (const doc of docsBatch) {
                  const fileName = sourceMap.get(doc.source_id);
                  if (fileName) {
                    const extension = path.extname(fileName).toLowerCase();
                    if (targetExtensions.includes(extension)) {
                      docsToUpdate.push(doc.id);
                      processed++;
                      
                      if (options.verbose) {
                        console.log(`File "${fileName}" has matching extension "${extension}" - will change to "not_set"`);
                      }
                    }
                  } else {
                    // If we couldn't get the filename, include all documents to be safe
                    docsToUpdate.push(doc.id);
                    processed++;
                    
                    if (options.verbose) {
                      console.log(`Could not get filename for document ${doc.id} - will change to "not_set" to be safe`);
                    }
                  }
                }
              }
            } catch (batchError) {
              console.warn(`Error processing batch: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
              // Continue with next batch
            }
          }
          
          console.log(`Processed ${processed} documents. Found ${docsToUpdate.length} to update.`);
          
          if (docsToUpdate.length > 0) {
            console.log(`Found ${docsToUpdate.length} "skip_processing" documents with targeted file extensions`);
            
            // If dry run, just report what would be done
            if (options.dryRun) {
              console.log(`[DRY RUN] Would update ${docsToUpdate.length} "skip_processing" documents to "not_set"`);
              result.skipReprocessingToNotSet = docsToUpdate.length;
            } else {
              // Update these documents in batches
              const updateBatches = Math.ceil(docsToUpdate.length / batchSize);
              let updatedCount = 0;
              
              for (let i = 0; i < updateBatches; i++) {
                const start = i * batchSize;
                const end = Math.min(start + batchSize, docsToUpdate.length);
                const batch = docsToUpdate.slice(start, end);
                
                const { error: updateError } = await supabase
                  .from('google_expert_documents')
                  .update({
                    document_processing_status: 'not_set',
                    document_processing_status_updated_at: new Date().toISOString()
                  })
                  .in('id', batch);
                  
                if (updateError) {
                  console.error(`Error updating batch ${i + 1} from "skip_processing" to "not_set": ${updateError.message}`);
                  result.errors.push(`Error updating batch ${i + 1} from "skip_processing" to "not_set": ${updateError.message}`);
                } else {
                  updatedCount += batch.length;
                  console.log(`Updated ${batch.length} documents from "skip_processing" to "not_set" (batch ${i + 1}/${updateBatches})`);
                }
              }
              
              result.skipReprocessingToNotSet = updatedCount;
              console.log(`✅ Successfully updated ${updatedCount} documents from "skip_processing" to "not_set" status`);
            }
          } else {
            console.log('No "skip_processing" documents with targeted file extensions found');
          }
        } catch (error) {
          console.error(`Error processing skip_processing documents: ${error instanceof Error ? error.message : String(error)}`);
          result.errors.push(`Error processing skip_processing documents: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else {
      console.log('No documents with "skip_processing" status found');
    }
    
    return result;
  } catch (error: any) {
    console.error(`Error clearing reprocessing status: ${error.message || error}`);
    result.errors.push(`Error clearing reprocessing status: ${error.message || error}`);
    return result;
  }
}

// Set up CLI
const program = new Command();

program
  .name('clear-reprocessing')
  .description('Clear reprocessing status for expert documents')
  .option('--dry-run', 'Show only results without making changes', false)
  .option('--verbose', 'Show detailed information', false)
  .option('--limit <number>', 'Limit number of records to process', '500')
  .action(async (options) => {
    let trackingId: string | undefined;
    
    try {
      // Start command tracking
      trackingId = await commandTrackingService.startTracking('google_sync', 'clear-reprocessing');
      
      // Run the main function
      const results = await clearReprocessingStatus({
        dryRun: options.dryRun,
        verbose: options.verbose,
        limit: parseInt(options.limit, 10)
      });
      
      // Print summary
      console.log('\n=== Clear Reprocessing Status Summary ===');
      console.log(`Total documents processed: ${results.total}`);
      console.log(`Set to "not_set" from "needs_reprocessing": ${results.notSetCount}`);
      console.log(`Set to "skip_processing": ${results.skipCount}`);
      console.log(`Set to "not_set" from "skip_processing": ${results.skipReprocessingToNotSet}`);
      console.log(`Unchanged: ${results.unchanged}`);
      console.log(`Errors: ${results.errors.length}`);
      
      if (results.errors.length > 0) {
        console.error('\nErrors encountered:');
        results.errors.forEach((error, index) => {
          console.error(`${index + 1}. ${error}`);
        });
      }
      
      // Complete tracking
      if (trackingId) {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: results.notSetCount + results.skipCount + results.skipReprocessingToNotSet,
          summary: `Updated ${results.notSetCount} to not_set (from needs_reprocessing), ${results.skipCount} to skip_processing, ${results.skipReprocessingToNotSet} to not_set (from skip_processing)`
        });
      }
      
      console.log('\nClear reprocessing status complete!');
    } catch (error: any) {
      // Log error and complete tracking with failure
      console.error(`Error during clear reprocessing: ${error.message || error}`);
      
      if (trackingId) {
        await commandTrackingService.failTracking(
          trackingId,
          `Command failed: ${error.message || error}`
        );
      }
      
      process.exit(1);
    }
  });

// Execute directly if this script is run directly (not imported)
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { clearReprocessingStatus };