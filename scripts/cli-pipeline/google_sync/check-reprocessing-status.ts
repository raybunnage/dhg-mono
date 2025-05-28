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
    // Test Supabase connection first
    console.log('Testing Supabase connection...');
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    
    console.log('✅ Supabase connection test successful');
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
      expertDocumentType: string | null;
      sourcesGoogleDocumentType: string | null;
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
        .from('expert_profiles')
        .select('id')
        .eq('expert_name', options.expert)
        .maybeSingle();
      
      if (expertError) {
        console.error(`Error fetching expert: ${expertError.message}`);
      } else if (expertData) {
        // Get google_sources_experts with this expert_id
        const { data: sourceExperts, error: sourceExpertsError } = await supabaseClient
          .from('google_sources_experts')
          .select('source_id')
          .eq('expert_id', expertData.id);
        
        if (sourceExpertsError) {
          console.error(`Error fetching google_sources_experts: ${sourceExpertsError.message}`);
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
      
      // FIXED: Add debugging about the query we're performing
      console.log(`Looking for expert documents for batch ${i+1}-${Math.min(i+batchSize, sources.length)} of ${sources.length} sources`);
      
      // Debugging: For the first batch, also do a direct query to see if any have needs_reprocessing status
      if (i === 0) {
        const { data: directCheck, error: directCheckError } = await supabaseClient
          .from('expert_documents')
          .select('id, source_id, reprocessing_status')
          .eq('reprocessing_status', 'needs_reprocessing')
          .limit(5);
          
        if (directCheckError) {
          console.error('Error in direct check query:', directCheckError.message);
        } else {
          console.log(`Direct query found ${directCheck ? directCheck.length : 0} documents with needs_reprocessing status`);
          if (directCheck && directCheck.length > 0) {
            console.log('Sample documents:');
            directCheck.forEach(doc => {
              console.log(`- Document ${doc.id}: status=${doc.reprocessing_status}`);
            });
          }
        }
      }
      
      const { data: expertDocs, error: expertDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id, source_id, document_type_id, reprocessing_status, processing_skip_reason')
        .in('source_id', sourceIds);
      
      if (expertDocsError) {
        console.error(`Error fetching expert documents for batch ${i}-${i+batchSize}: ${expertDocsError.message}`);
        continue;
      }
      
      if (!expertDocs || expertDocs.length === 0) {
        console.log(`No expert documents found for batch ${i}-${i+batchSize}.`);
        
        // Add results for sources without expert docs
        for (const source of batchSources) {
          // Get source_google document type name from separate query
          let sourcesGoogleDocumentTypeName: string | null = null;
          if (source.document_type_id) {
            const { data: docType, error: docTypeError } = await supabaseClient
              .from('document_types')
              .select('name')
              .eq('id', source.document_type_id)
              .maybeSingle();
              
            if (!docTypeError && docType) {
              sourcesGoogleDocumentTypeName = docType.name;
            }
          }
          
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            expertDocId: null,
            processingStatus: null,
            processingReason: null,
            expertDocumentType: null,
            sourcesGoogleDocumentType: sourcesGoogleDocumentTypeName
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
          
          // FIXED: Explicitly check for the exact string values in reprocessing_status
          // This ensures we properly identify documents that need reprocessing
          const processingStatus = expertDoc.reprocessing_status || 'not_set';
          const processingReason = expertDoc.processing_skip_reason;
          
          // Debug log the actual value to help diagnose issues
          if (verbose) {
            console.log(`Document processing status for ${expertDoc.id}: '${processingStatus}' (type: ${typeof processingStatus})`);
          }
          
          // Update stats based on document processing status and reason
          // Using triple equals to ensure exact string comparison
          if (processingStatus === 'needs_reprocessing') {
            stats.needsReprocessing++;
          } else if (processingStatus === 'reprocessing_done') {
            stats.reprocessingDone++;
          } else if (processingStatus === 'skip_processing') {
            stats.skipProcessing++;
          } else if (processingStatus === 'not_set' || processingStatus === null) {
            stats.notSet++;
          }
          
          // Get document type name if available
          let documentTypeName: string | null = null;
          if (expertDoc.document_type_id) {
            const { data: docType, error: docTypeError } = await supabaseClient
              .from('document_types')
              .select('name')
              .eq('id', expertDoc.document_type_id)
              .maybeSingle();
            
            if (!docTypeError && docType) {
              documentTypeName = docType.name;
            }
          }
          
          // Get source_google document type name from separate query
          let sourcesGoogleDocumentTypeName: string | null = null;
          if (source.document_type_id) {
            const { data: docType, error: docTypeError } = await supabaseClient
              .from('document_types')
              .select('name')
              .eq('id', source.document_type_id)
              .maybeSingle();
              
            if (!docTypeError && docType) {
              sourcesGoogleDocumentTypeName = docType.name;
            }
          }

          // Add to results
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            expertDocId: expertDoc.id,
            processingStatus,
            processingReason,
            expertDocumentType: documentTypeName,
            sourcesGoogleDocumentType: sourcesGoogleDocumentTypeName
          });
          
          if (verbose) {
            console.log(`Source: ${source.name} (${source.id})`);
            console.log(`  Expert Document: ${expertDoc.id}`);
            console.log(`  Document Type: ${documentTypeName || 'Unknown'}`);
            console.log(`  Processing Status: ${processingStatus}`);
            console.log(`  Processing Reason: ${processingReason || 'None'}`);
            console.log('');
          }
        } else {
          // Get source_google document type name from separate query
          let sourcesGoogleDocumentTypeName: string | null = null;
          if (source.document_type_id) {
            const { data: docType, error: docTypeError } = await supabaseClient
              .from('document_types')
              .select('name')
              .eq('id', source.document_type_id)
              .maybeSingle();
              
            if (!docTypeError && docType) {
              sourcesGoogleDocumentTypeName = docType.name;
            }
          }

          // Add to results for sources without expert docs
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            expertDocId: null,
            processingStatus: null,
            processingReason: null,
            expertDocumentType: null,
            sourcesGoogleDocumentType: sourcesGoogleDocumentTypeName
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
    
    // Show sources needing reprocessing in a table format
    if (stats.needsReprocessing > 0) {
      console.log('\nSources Needing Reprocessing:');
      
      // FIXED: More lenient filtering to handle potential whitespace or case issues
      const needsReprocessingDocs = results.filter(r => {
        const status = String(r.processingStatus || '').trim().toLowerCase();
        return status.includes('needs_reprocessing');
      });
      
      console.log(`Found ${needsReprocessingDocs.length} documents with needs_reprocessing status`);
      
      console.table(needsReprocessingDocs
        .map(r => ({
          'Source Name': r.sourceName,
          'Sources Google Doc Type': r.sourcesGoogleDocumentType || 'None',
          'Expert Doc Type': r.expertDocumentType || 'None',
          'Processing Reason': r.processingReason,
          'Processing Status': r.processingStatus // Added for debugging
        }))
      );
    }
    
    // Show sources that will be skipped during processing
    if (stats.skipProcessing > 0) {
      console.log('\nSources Skipping Processing:');
      console.table(results.filter(r => r.processingStatus === 'skip_processing')
        .map(r => ({
          'Source Name': r.sourceName,
          'Sources Google Doc Type': r.sourcesGoogleDocumentType || 'None',
          'Expert Doc Type': r.expertDocumentType || 'None',
          'Processing Status': r.processingStatus,
          'Processing Reason': r.processingReason,
          'Source ID': r.sourceId,
          'Expert Doc ID': r.expertDocId
        }))
      );
    }
    
    // Show breakdown of processing reasons if any documents need processing
    if (stats.needsReprocessing > 0 || stats.skipProcessing > 0) {
      console.log('\nProcessing Reasons Breakdown:');
      
      // Group by processing reason
      const reasonCounts = new Map<string, number>();
      for (const result of results) {
        if (result.processingReason) {
          const count = reasonCounts.get(result.processingReason) || 0;
          reasonCounts.set(result.processingReason, count + 1);
        }
      }
      
      // Display reasons sorted by count (descending)
      const sortedReasons = Array.from(reasonCounts.entries())
        .sort((a, b) => b[1] - a[1]);
      
      for (const [reason, count] of sortedReasons) {
        console.log(`  ${reason}: ${count} documents`);
      }
    }
    
    // Output detailed results if requested
    if (options.outputPath) {
      const fs = require('fs');
      const path = require('path');
      
      try {
        // FIXED: For JSON output, directly query for needs_reprocessing documents
        // This ensures we have documents to process even if the main query doesn't find them
        if (format === 'json') {
          console.log('Using direct query to find documents with needs_reprocessing status for output file...');
          // Get documents needing reprocessing directly from the database
          console.log('Searching for documents that need reprocessing...');
          
          const { data: directDocs, error: directError } = await supabaseClient
            .from('expert_documents')
            .select('id, source_id, document_type_id, reprocessing_status')
            .eq('reprocessing_status', 'needs_reprocessing')
            .limit(options.limit || 10);
            
          if (directError) {
            console.error('Error in direct reprocessing query:', directError.message);
          } else if (directDocs && directDocs.length > 0) {
            // Direct query returns the data directly
            let docs = directDocs;
            
            // Debug log all returned documents
            console.log("Documents found:");
            console.log(JSON.stringify(docs, null, 2));
            
            console.log(`Direct query found ${docs.length} documents with needs_reprocessing status for output`);
            
            // For each document, get the source info
            const directResults = [];
            for (const doc of docs) {
              const { data: source } = await supabaseClient
                .from('sources_google')
                .select('id, name, document_type_id, mime_type')
                .eq('id', doc.source_id)
                .single();
                
              if (source) {
                console.log(`Found document to reprocess: ${source.name} (${source.mime_type})`);
                // Get document type name if available
                let documentTypeName: string | null = null;
                if (doc.document_type_id) {
                  const { data: docType } = await supabaseClient
                    .from('document_types')
                    .select('name')
                    .eq('id', doc.document_type_id)
                    .maybeSingle();
                  
                  if (docType) {
                    documentTypeName = docType.name;
                  }
                }
                
                // Get source document type name
                let sourcesGoogleDocumentTypeName: string | null = null;
                if (source.document_type_id) {
                  const { data: docType } = await supabaseClient
                    .from('document_types')
                    .select('name')
                    .eq('id', source.document_type_id)
                    .maybeSingle();
                    
                  if (docType) {
                    sourcesGoogleDocumentTypeName = docType.name;
                  }
                }
                
                directResults.push({
                  sourceId: source.id,
                  sourceName: source.name,
                  expertDocId: doc.id,
                  processingStatus: 'needs_reprocessing', // Hard-code this to ensure consistency
                  processingReason: null,
                  expertDocumentType: documentTypeName,
                  sourcesGoogleDocumentType: sourcesGoogleDocumentTypeName
                });
              }
            }
            
            if (directResults.length > 0) {
              console.log(`Successfully prepared ${directResults.length} documents for output`);
              const output = JSON.stringify(directResults, null, 2);
              
              // Write to file
              if (!dryRun) {
                fs.writeFileSync(path.resolve(options.outputPath), output);
                console.log(`\nDetailed results written to: ${options.outputPath}`);
              } else {
                console.log(`\n[DRY RUN] Would write detailed results to: ${options.outputPath}`);
              }
              
              // Success - early return not needed as stats are still returned
            } else {
              // Fall back to regular output if no direct results found
              console.log('No direct results found, falling back to regular output');
              const output = JSON.stringify(results, null, 2);
              fs.writeFileSync(path.resolve(options.outputPath), output);
              console.log(`\nDetailed results written to: ${options.outputPath}`);
            }
          } else {
            // Fall back to regular output if direct query fails
            console.log('Falling back to regular output since direct query found no documents');
            const output = JSON.stringify(results, null, 2);
            fs.writeFileSync(path.resolve(options.outputPath), output);
            console.log(`\nDetailed results written to: ${options.outputPath}`);
          }
        } else {
          // Simple table format
          let output = 'Source ID,Source Name,Expert Doc ID,Processing Status,Processing Reason,Expert Document Type,Source Google Document Type\n';
          for (const result of results) {
            // Escape commas in fields for proper CSV format
            const escapedSourceName = result.sourceName.replace(/,/g, ' ');
            const escapedReason = result.processingReason ? result.processingReason.replace(/,/g, ' ') : 'N/A';
            const escapedExpertDocType = result.expertDocumentType ? result.expertDocumentType.replace(/,/g, ' ') : 'N/A';
            const escapedSourceDocType = result.sourcesGoogleDocumentType ? result.sourcesGoogleDocumentType.replace(/,/g, ' ') : 'N/A';
            
            output += `${result.sourceId},${escapedSourceName},${result.expertDocId || 'N/A'},${result.processingStatus || 'N/A'},${escapedReason},${escapedExpertDocType},${escapedSourceDocType}\n`;
          }
          
          // Write to file
          if (!dryRun) {
            fs.writeFileSync(path.resolve(options.outputPath), output);
            console.log(`\nDetailed results written to: ${options.outputPath}`);
          } else {
            console.log(`\n[DRY RUN] Would write detailed results to: ${options.outputPath}`);
          }
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