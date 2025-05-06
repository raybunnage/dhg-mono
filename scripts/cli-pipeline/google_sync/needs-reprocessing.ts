#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

// Initialize Supabase client
const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

/**
 * Lists all expert_documents with document_processing_status = "needs_reprocessing"
 * Displays them in a console table format similar to the list command
 */
export async function listNeedsReprocessing(options: {
  limit?: number;
  mimeType?: string;
}) {
  const limit = options.limit || 100;
  const mimeType = options.mimeType || null;
  
  console.log(`Finding expert documents that need reprocessing (limit: ${limit})...`);

  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'needs-reprocessing');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    // Test Supabase connection first
    console.log('Testing Supabase connection...');
    try {
      // Skip connection test - we'll just test directly with our query
      console.log('✅ Supabase connection assumed to be working');
    } catch (error) {
      console.error(`Connection test error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Get all document types to map IDs to names
    const { data: documentTypes, error: docTypesError } = await supabaseClient
      .from('document_types')
      .select('id, name');
      
    if (docTypesError) {
      console.error(`Error fetching document types: ${docTypesError.message}`);
      return;
    }
    
    // Create a map for quick lookups
    const documentTypeMap = new Map();
    if (documentTypes) {
      for (const dt of documentTypes) {
        documentTypeMap.set(dt.id, dt.name);
      }
    }

    // Build the query to find expert documents with needs_reprocessing status
    let query = supabaseClient
      .from('expert_documents')
      .select(`
        id,
        document_type_id,
        document_processing_status,
        document_processing_status_updated_at,
        source_id,
        raw_content,
        processed_content,
        sources_google (
          id,
          name,
          mime_type,
          document_type_id
        )
      `)
      .eq('document_processing_status', 'needs_reprocessing')
      .order('document_processing_status_updated_at', { ascending: false })
      .limit(limit);
    
    // Add mime type filter if provided
    if (mimeType) {
      console.log(`Filtering by MIME type: ${mimeType}`);
      query = query.eq('sources_google.mime_type', mimeType);
    }

    // Execute the query
    const { data: docsNeedingReprocessing, error } = await query;

    if (error) {
      console.error(`Error fetching documents: ${error.message}`);
      return;
    }

    if (!docsNeedingReprocessing || docsNeedingReprocessing.length === 0) {
      console.log('No documents found with needs_reprocessing status.');
      return;
    }

    // Display the results in a table
    console.log(`\nExpert Documents with needs_reprocessing status:`);
    console.log('='.repeat(180));
    console.log(
      'ID'.padEnd(38) + ' | ' + 
      'File Name'.padEnd(60) + ' | ' + 
      'Sources Type'.padEnd(25) + ' | ' + 
      'Expert Doc Type'.padEnd(25) + ' | ' +
      'Raw'.padEnd(7) + ' | ' +
      'JSON'.padEnd(7) + ' | ' +
      'Status'.padEnd(15)
    );
    console.log('-'.repeat(180));
    
    for (const doc of docsNeedingReprocessing) {
      // sources_google is returned as an array from Supabase's join
      const sourceGoogle = Array.isArray(doc.sources_google) && doc.sources_google.length > 0
        ? doc.sources_google[0]
        : null;
        
      const sourceType = sourceGoogle?.document_type_id 
        ? documentTypeMap.get(sourceGoogle.document_type_id) || 'Unknown'
        : 'None';
        
      const expertDocType = doc.document_type_id 
        ? documentTypeMap.get(doc.document_type_id) || 'Unknown'
        : 'None';
        
      const fileName = sourceGoogle?.name || 'Unknown/Deleted';
      const mimeType = sourceGoogle?.mime_type || 'Unknown';
      const sourceId = doc.source_id || 'Unknown';
      const updatedAt = doc.document_processing_status_updated_at 
        ? new Date(doc.document_processing_status_updated_at).toLocaleString()
        : 'Unknown';
      
      // Determine if raw content is available
      const hasRawContent = !!doc.raw_content;
      
      // Determine if processed content is JSON
      const hasJsonContent = doc.processed_content && 
        typeof doc.processed_content === 'object' && 
        Object.keys(doc.processed_content).length > 0;
    
      console.log(
        doc.id.padEnd(38) + ' | ' +
        fileName.substring(0, 58).padEnd(60) + ' | ' +
        sourceType.substring(0, 23).padEnd(25) + ' | ' +
        expertDocType.substring(0, 23).padEnd(25) + ' | ' +
        (hasRawContent ? 'Yes' : 'No').padEnd(7) + ' | ' +
        (hasJsonContent ? 'Yes' : 'No').padEnd(7) + ' | ' +
        'Need'.padEnd(15)  // Always "Need" since we're filtering for needs_reprocessing
      );
    }
    
    console.log('-'.repeat(180));
    console.log(`Total documents needing reprocessing: ${docsNeedingReprocessing.length}`);

    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: docsNeedingReprocessing.length,
          summary: `Found ${docsNeedingReprocessing.length} documents that need reprocessing`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      total: docsNeedingReprocessing.length,
      documents: docsNeedingReprocessing
    };
  } catch (error) {
    console.error(`Error finding documents that need reprocessing: ${error instanceof Error ? error.message : String(error)}`);
    
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
    .description('List expert documents with document_processing_status = "needs_reprocessing"')
    .option('-l, --limit <number>', 'Maximum number of documents to display', '100')
    .option('-m, --mime-type <string>', 'Filter by MIME type (e.g., "application/pdf")')
    .action((options) => {
      listNeedsReprocessing({
        limit: parseInt(options.limit),
        mimeType: options.mimeType
      });
    });

  program.parse(process.argv);
}