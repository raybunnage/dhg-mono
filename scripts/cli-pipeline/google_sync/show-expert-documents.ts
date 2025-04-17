#!/usr/bin/env ts-node
import { SupabaseClientService } from "../../../packages/shared/services/supabase-client";
import { commandTrackingService } from "../../../packages/shared/services/tracking-service/command-tracking-service";

// Define a type for document type record
interface DocumentType {
  id: string;
  document_type: string;
}

/**
 * Extracts a snippet from content, handling both string and object types
 */
function getContentSnippet(content: any, maxLength = 150): string {
  if (!content) return "Not available";
  
  try {
    const textContent = typeof content === 'string' 
      ? content 
      : JSON.stringify(content);
    
    // Remove extra whitespace and make it a single line
    const normalized = textContent
      .replace(/\s+/g, ' ')
      .trim();
    
    if (normalized.length <= maxLength) {
      return normalized;
    }
    
    return `${normalized.substring(0, maxLength)}...`;
  } catch (error) {
    return "Error extracting content";
  }
}

async function showExpertDocuments() {
  const trackingId = await commandTrackingService.startTracking('google_sync', 'show-expert-documents');

  try {
    // Initialize Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log("Fetching sources_google with associated expert_documents...");
    
    // First get all document types in one query to use as lookup
    const { data: documentTypes, error: docTypeError } = await supabase
      .from('document_types')
      .select('id, document_type');
    
    if (docTypeError) {
      throw new Error(`Error fetching document types: ${docTypeError.message}`);
    }
    
    // Create a lookup map for document types
    const documentTypeMap = new Map<string, string>();
    if (documentTypes) {
      documentTypes.forEach((dt: DocumentType) => {
        documentTypeMap.set(dt.id, dt.document_type);
      });
    }
    
    // Let's try a different approach: get expert_documents and then separately get sources_google
    const { data: expertDocs, error: expertsError } = await supabase
      .from('expert_documents')
      .select(`
        id,
        document_type_id,
        raw_content,
        processed_content,
        source_id
      `)
      .limit(20);
      
    if (expertsError) {
      throw new Error(`Error fetching expert_documents: ${expertsError.message}`);
    }
    
    if (!expertDocs || expertDocs.length === 0) {
      console.log("No expert_documents found");
      await commandTrackingService.completeTracking(trackingId, {
        summary: "No expert_documents found"
      });
      return;
    }
    
    // Get the source IDs for lookup
    const sourceIds = expertDocs.map(doc => doc.source_id).filter(Boolean);
    
    // Get the associated sources_google records
    const { data: sourcesGoogle, error } = await supabase
      .from('sources_google')
      .select('id, name, document_type_id')
      .in('id', sourceIds);
      
    // Create a map for quick lookup
    const sourcesMap = new Map();
    if (sourcesGoogle) {
      sourcesGoogle.forEach(source => {
        sourcesMap.set(source.id, source);
      });
    }
    
    // Combine the data
    const records = expertDocs.map(doc => ({
      ...doc,
      sources_google: sourcesMap.get(doc.source_id) || null
    }));
    
    if (error) {
      throw new Error(`Error fetching records: ${error.message}`);
    }
    
    if (!records || records.length === 0) {
      console.log("No matching records found");
      await commandTrackingService.completeTracking(trackingId, {
        summary: "No matching records found"
      });
      return;
    }
    
    console.log(`Found ${records.length} expert_documents with sources_google associations\n`);
    
    // Display the results using the document type lookup map
    records.forEach((record: any, index: number) => {
      const sourceRecord = record.sources_google;
      
      console.log(`\n[${index + 1}] Expert Document Record:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Document Type: ${documentTypeMap.get(record.document_type_id) || 'Not specified'}`);
      
      // Display snippets of content
      console.log(`  Raw Content: ${getContentSnippet(record.raw_content)}`);
      console.log(`  Processed Content: ${getContentSnippet(record.processed_content)}`);
      
      if (sourceRecord) {
        console.log(`\n  Associated Sources Google Record:`);
        console.log(`    ID: ${sourceRecord.id}`);
        console.log(`    Name: ${sourceRecord.name}`);
        console.log(`    Document Type: ${documentTypeMap.get(sourceRecord.document_type_id) || 'Not specified'}`);
      } else {
        console.log(`\n  No Sources Google record found for this expert document.`);
      }
      
      console.log("\n" + "-".repeat(80));
    });
    
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: records.length,
      summary: `Successfully displayed ${records.length} expert_documents with their associated sources_google records`
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    await commandTrackingService.failTracking(
      trackingId,
      `Command failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// Execute the function
showExpertDocuments();