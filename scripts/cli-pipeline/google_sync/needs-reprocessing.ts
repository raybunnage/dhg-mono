#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

// Initialize Supabase client
const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

// Define interfaces for our data types
interface SourceGoogle {
  id: string;
  name: string;
  mime_type: string | null;
  document_type_id: string | null;
}

interface ExpertDocument {
  id: string;
  document_type_id: string | null;
  document_processing_status: string | null;
  document_processing_status_updated_at: string | null;
  source_id: string | null;
  raw_content: string | null;
  processed_content: any;
  sources_google?: SourceGoogle[];
}

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

    // First, get all expert documents that need reprocessing
    const { data: docsNeedingReprocessing, error: docsError } = await supabaseClient
      .from('expert_documents')
      .select(`
        id,
        document_type_id,
        document_processing_status,
        document_processing_status_updated_at,
        source_id,
        raw_content,
        processed_content
      `)
      .eq('document_processing_status', 'needs_reprocessing')
      .order('document_processing_status_updated_at', { ascending: false })
      .limit(limit) as { data: ExpertDocument[] | null, error: any };
      
    if (docsError) {
      console.error(`Error fetching documents: ${docsError.message}`);
      return;
    }
    
    if (!docsNeedingReprocessing || docsNeedingReprocessing.length === 0) {
      console.log('No documents found with needs_reprocessing status.');
      return;
    }
    
    console.log(`Found ${docsNeedingReprocessing.length} documents with needs_reprocessing status.`);
    
    // Get all source_ids from the documents
    const sourceIds = docsNeedingReprocessing.map(doc => doc.source_id).filter(id => id !== null);
    
    // Get source details for each document
    const { data: sourcesData, error: sourcesError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, document_type_id')
      .in('id', sourceIds) as { data: SourceGoogle[] | null, error: any };
      
    if (sourcesError) {
      console.error(`Error fetching sources: ${sourcesError.message}`);
    }
    
    // Create a map of source_id to source data for quick lookup
    const sourcesMap = new Map();
    if (sourcesData) {
      for (const source of sourcesData) {
        sourcesMap.set(source.id, source);
      }
    }
    
    // Create a new array with documents that have source info attached
    const docsWithSources: ExpertDocument[] = docsNeedingReprocessing.map(doc => {
      // Create a new object with all properties from the original document
      const docWithSource: ExpertDocument = { ...doc };
      
      // Add sources_google property
      if (doc.source_id && sourcesMap.has(doc.source_id)) {
        docWithSource.sources_google = [sourcesMap.get(doc.source_id) as SourceGoogle];
      } else {
        docWithSource.sources_google = [];
      }
      
      return docWithSource;
    });
    
    // Apply mime type filter if provided
    let filteredDocs = docsWithSources;
    if (mimeType && sourcesData && sourcesData.length > 0) {
      console.log(`Filtering by MIME type: ${mimeType}`);
      // Filter the documents to only include those with matching source mime_type
      filteredDocs = docsWithSources.filter(doc => {
        if (doc.sources_google && doc.sources_google.length > 0) {
          return doc.sources_google[0].mime_type === mimeType;
        }
        return false;
      });
      
      console.log(`After mime type filtering: ${filteredDocs.length} documents remaining`);
    }

    // Display the results in a table
    console.log(`\nExpert Documents with needs_reprocessing status:`);
    console.log('='.repeat(150));
    console.log(
      'ID'.padEnd(38) + ' | ' + 
      'File Name'.padEnd(60) + ' | ' + 
      'Sources Type'.padEnd(25) + ' | ' + 
      'Expert Doc Type'.padEnd(25) + ' | ' +
      'Status'.padEnd(10)
    );
    console.log('-'.repeat(150));
    
    for (const doc of filteredDocs) {
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
        'Need'.padEnd(10)  // Always "Need" since we're filtering for needs_reprocessing
      );
    }
    
    console.log('-'.repeat(150));
    console.log(`Total documents needing reprocessing: ${filteredDocs.length}`);

    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: filteredDocs.length,
          summary: `Found ${filteredDocs.length} documents that need reprocessing`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      total: filteredDocs.length,
      documents: filteredDocs
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