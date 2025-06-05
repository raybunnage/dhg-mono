#!/usr/bin/env ts-node
/**
 * Source Info Command
 * 
 * Gets detailed information about a sources_google record and its related expert_documents
 * 
 * Usage:
 *   ts-node source-info.ts <source_id_or_prefix>
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

interface SourceInfoOptions {
  format?: string;
}

async function checkSourceAndDocument(sourceId: string): Promise<void> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get source information
    console.log(`Checking source with ID: ${sourceId}`);
    const { data: source, error: sourceError } = await supabase
      .from("sources_google")
      .select("id, name, mime_type, document_type_id")
      .eq("id", sourceId)
      .single();
      
    if (sourceError) {
      console.error(`Error fetching source: ${sourceError.message}`);
      return;
    }
    
    if (!source) {
      console.log(`No source found with ID: ${sourceId}`);
      return;
    }
    
    console.log("\nSource Information:");
    console.log(`ID: ${source.id}`);
    console.log(`Name: ${source.name || "N/A"}`);
    console.log(`MIME Type: ${source.mime_type || "N/A"}`);
    
    // Get document type information if available
    if (source.document_type_id) {
      const { data: docType, error: docTypeError } = await supabase
        .from("document_types")
        .select("id, name, category")
        .eq("id", source.document_type_id)
        .single();
        
      if (docTypeError) {
        console.error(`Error fetching document type: ${docTypeError.message}`);
      } else if (docType) {
        console.log("\nSource Document Type:");
        console.log(`ID: ${docType.id}`);
        console.log(`Type: ${docType.name}`);
        console.log(`Category: ${docType.category || "N/A"}`);
      }
    } else {
      console.log("\nNo document type associated with this source");
    }
    
    // Get related expert_documents
    console.log("\nFetching related expert_documents...");
    const { data: expertDocs, error: expertDocsError } = await supabase
      .from("expert_documents")
      .select(`
        id, 
        document_type_id,
        document_processing_status,
        document_processing_status_updated_at,
        processing_skip_reason
      `)
      .eq("source_id", sourceId);
      
    if (expertDocsError) {
      console.error(`Error fetching expert documents: ${expertDocsError.message}`);
      return;
    }
    
    if (!expertDocs || expertDocs.length === 0) {
      console.log(`No expert_documents found for source ID: ${sourceId}`);
      return;
    }
    
    console.log(`\nFound ${expertDocs.length} related expert_documents:`);
    
    for (const doc of expertDocs) {
      console.log("\n-----------------------------------");
      console.log(`Expert Document ID: ${doc.id}`);
      
      // Expert information - note: the expert_documents table doesn't seem to have a direct link to experts
      // This would require a join or additional query if needed
      
      console.log(`Processing Status: ${doc.document_processing_status || "N/A"}`);
      
      // Show status update timestamp if available
      if (doc.document_processing_status_updated_at) {
        const date = new Date(doc.document_processing_status_updated_at);
        console.log(`Status Updated: ${date.toLocaleString()}`);
      }
      
      // Show skip reason if available
      if (doc.processing_skip_reason) {
        console.log(`Skip Reason: ${doc.processing_skip_reason}`);
      }
      
      if (doc.document_type_id) {
        const { data: docType, error: docTypeError } = await supabase
          .from("document_types")
          .select("id, name, category")
          .eq("id", doc.document_type_id)
          .single();
          
        if (docTypeError) {
          console.error(`Error fetching document type: ${docTypeError.message}`);
        } else if (docType) {
          console.log(`Document Type: ${docType.name} (${docType.category || "N/A"})`);
        }
      } else {
        console.log("Document Type: None");
      }
    }
    
  } catch (error: any) {
    console.error(`Error: ${error.message || error}`);
  }
}

async function findSourceByIdPrefix(idPrefix: string): Promise<void> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log(`Looking for sources with ID: ${idPrefix}`);
    
    // Try to find a source by ID, supporting partial ID search
    let sourceId: string | null = null;
    
    // First, try with the full ID directly
    try {
      const { data, error } = await supabase
        .from("sources_google")
        .select("id")
        .eq("id", idPrefix)
        .maybeSingle();
        
      if (!error && data) {
        sourceId = data.id;
        console.log(`Found exact match for ID: ${sourceId}`);
      }
    } catch (e) {
      console.log("No exact match found, will try to list sample sources");
    }
    
    // If we found a source, check it
    if (sourceId) {
      await checkSourceAndDocument(sourceId);
      return;
    }
    
    // If no source was found or there was an error, list some sample sources
    console.log("\nListing some sample sources from the database:");
    const { data: sampleSources, error: sampleError } = await supabase
      .from("sources_google")
      .select("id, name")
      .limit(10);
      
    if (sampleError) {
      console.error(`Error fetching sample sources: ${sampleError.message}`);
      return;
    }
    
    if (!sampleSources || sampleSources.length === 0) {
      console.log("No sources found in the database.");
      return;
    }
    
    console.log("\nHere are some sample sources you can check:");
    console.log("-------------------------------------------------");
    sampleSources.forEach((source, index) => {
      console.log(`${index + 1}. ID: ${source.id}`);
      console.log(`   Name: ${source.name || 'Unknown'}`);
      console.log("-------------------------------------------------");
    });
    
    console.log("\nTo check a specific source, use the full ID:");
    console.log(`./google-sync-cli.sh source-info [source-id]`);
    
  } catch (error: any) {
    console.error(`Error in findSourceByIdPrefix: ${error.message || error}`);
  }
}

async function getSourceInfo(sourceId: string, options: SourceInfoOptions): Promise<void> {
  let trackingId: string | undefined;
  
  try {
    // Start command tracking
    trackingId = await commandTrackingService.startTracking('google_sync', 'source-info');
    
    await findSourceByIdPrefix(sourceId);
    
    // Complete tracking
    if (trackingId) {
      await commandTrackingService.completeTracking(trackingId, {
        summary: `Retrieved information for source ID prefix: ${sourceId}`
      });
    }
  } catch (error: any) {
    console.error(`Error in getSourceInfo: ${error.message || error}`);
    
    // Fail tracking
    if (trackingId) {
      await commandTrackingService.failTracking(
        trackingId,
        `Command failed: ${error.message || error}`
      );
    }
  }
}

// Set up CLI
const program = new Command();

program
  .name('source-info')
  .description('Get detailed information about a sources_google record and related expert_documents')
  .argument('<source-id>', 'Source ID or ID prefix to look up')
  .option('--format <format>', 'Output format (text or json)', 'text')
  .action(async (sourceId, options) => {
    await getSourceInfo(sourceId, options);
  });

// Execute directly if this script is run directly (not imported)
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { getSourceInfo };