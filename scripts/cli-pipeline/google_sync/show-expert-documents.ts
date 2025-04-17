#!/usr/bin/env ts-node
import { SupabaseClientService } from "../../../packages/shared/services/supabase-client";
import { commandTrackingService } from "../../../packages/shared/services/tracking-service/command-tracking-service";
import * as fs from 'fs';

// Define a type for document type record
interface DocumentType {
  id: string;
  document_type: string;
}

interface ExpertDocument {
  id: string;
  document_type_id: string;
  raw_content: string | null;
  processed_content: any;
  source_id: string;
  mime_type?: string | null;
  sources_google?: any;
}

interface DocumentStats {
  totalSourcesGoogle: number;
  totalFolders: number;
  totalFiles: number;
  sourcesWithDocType: number;
  sourcesWithExpertDocs: number;
  sourcesWithDocTypeButNoExpertDocs: number;
  sourcesWithNoDocType: number;
  filesWithNoExpertDocs: number;
  byDocumentType: {
    [key: string]: number;
  };
}

/**
 * Extracts a number of sentences from content, handling both string and object types
 */
function getContentSentences(content: any, sentenceCount = 2): string {
  if (!content) return "Not available";
  
  try {
    let textContent = '';
    
    if (typeof content === 'string') {
      textContent = content;
    } else if (typeof content === 'object') {
      textContent = JSON.stringify(content);
    } else {
      textContent = String(content);
    }
    
    // Simple sentence splitter (handles periods followed by spaces or line breaks)
    const sentences = textContent.split(/\.\s+|\.\n+|\.\r\n+/);
    
    // Get first n sentences, add back the periods
    const selectedSentences = sentences
      .slice(0, sentenceCount)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .join('. ');
    
    return selectedSentences.length > 0 ? selectedSentences + '.' : "Content available but no clear sentences found.";
  } catch (error) {
    return "Error extracting content sentences";
  }
}

function formatMarkdownTable(stats: DocumentStats): string {
  let markdown = `# Expert Documents Report\n\n`;
  
  // Summary table
  markdown += `## Summary\n\n`;
  markdown += `| Status | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total sources_google records (not deleted) | ${stats.totalSourcesGoogle} |\n`;
  markdown += `| Total folders | ${stats.totalFolders} |\n`;
  markdown += `| Total files (not folders) | ${stats.totalSourcesGoogle - stats.totalFolders} |\n`;
  markdown += `| Sources with Expert Documents | ${stats.totalWithExpertDocs} |\n`;
  markdown += `| Sources with Document Types but no Expert Documents | ${stats.totalWithoutExpertDocs} |\n`;
  markdown += `| **Total Sources with Document Types** | **${stats.totalWithExpertDocs + stats.totalWithoutExpertDocs}** |\n\n`;
  
  // Document types table
  markdown += `## Expert Documents by Document Type\n\n`;
  markdown += `| Document Type | Count |\n`;
  markdown += `|--------------|-------|\n`;
  
  // Sort document types by count (descending)
  const sortedTypes = Object.entries(stats.byDocumentType)
    .sort((a, b) => b[1] - a[1]);
  
  sortedTypes.forEach(([docType, count]) => {
    markdown += `| ${docType} | ${count} |\n`;
  });
  
  return markdown;
}

async function saveStatsToMarkdown(stats: DocumentStats, samples: ExpertDocument[]): Promise<string> {
  try {
    const markdownPath = './expert-documents-report.md';
    let markdown = formatMarkdownTable(stats);
    
    // Add sample documents section
    markdown += `\n## Sample Expert Documents\n\n`;
    
    samples.forEach((doc, index) => {
      const docType = doc.sources_google?.document_type_name || 'Unknown';
      const fileName = doc.sources_google?.name || 'Unknown file';
      
      markdown += `### ${index + 1}. ${fileName} (${docType})\n\n`;
      markdown += `- ID: \`${doc.id}\`\n`;
      markdown += `- MIME Type: ${doc.mime_type || 'Not specified'}\n`;
      markdown += `- Source ID: \`${doc.source_id}\`\n`;
      
      // Raw content section
      markdown += `\n**Raw Content Preview:**\n\n`;
      markdown += `> ${getContentSentences(doc.raw_content, 2)}\n\n`;
      
      // Processed content section
      markdown += `**Processed Content Preview:**\n\n`;
      markdown += `> ${getContentSentences(doc.processed_content, 2)}\n\n`;
      
      // Separator
      markdown += `---\n\n`;
    });
    
    fs.writeFileSync(markdownPath, markdown);
    return markdownPath;
  } catch (error) {
    console.error("Failed to save markdown report:", error);
    return "";
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
    
    // Get all expert documents (no limit)
    const { data: expertDocs, error: expertsError } = await supabase
      .from('expert_documents')
      .select(`
        id,
        document_type_id,
        raw_content,
        processed_content,
        source_id,
        content_type
      `);
      
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
    const { data: sourcesGoogle, error: sourcesError } = await supabase
      .from('sources_google')
      .select('id, name, document_type_id, mime_type')
      .in('id', sourceIds);
      
    if (sourcesError) {
      throw new Error(`Error fetching sources_google: ${sourcesError.message}`);
    }

    // Detailed statistics about sources_google records
    let totalSourcesGoogleCount = 0;
    let totalFoldersCount = 0;
    let totalFilesCount = 0;
    let sourcesWithDocTypeCount = 0;
    let sourcesWithExpertDocsCount = 0;
    let sourcesWithDocTypeButNoExpertDocsCount = 0;
    let sourcesWithNoDocTypeCount = 0;
    
    try {
      // Get total count of non-deleted sources_google records
      const { count: totalCount, error: totalCountError } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);
      
      if (totalCountError) {
        console.warn("Error counting total sources_google:", totalCountError.message);
      } else if (totalCount !== null) {
        totalSourcesGoogleCount = totalCount;
      }
      
      // Get count of folders (mime_type = 'application/vnd.google-apps.folder')
      const { count: foldersCount, error: foldersCountError } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('mime_type', 'application/vnd.google-apps.folder');
      
      if (foldersCountError) {
        console.warn("Error counting folders:", foldersCountError.message);
      } else if (foldersCount !== null) {
        totalFoldersCount = foldersCount;
        totalFilesCount = totalSourcesGoogleCount - totalFoldersCount;
      }
      
      // Get count of sources with document types
      const { count: withDocTypesCount, error: docTypesError } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .not('document_type_id', 'is', null)
        .eq('is_deleted', false);
      
      if (docTypesError) {
        console.warn("Error counting sources with document types:", docTypesError.message);
      } else if (withDocTypesCount !== null) {
        sourcesWithDocTypeCount = withDocTypesCount;
      }
      
      // Create a set of unique source IDs with expert documents
      const sourcesWithExpertDocs = new Set(sourceIds);
      sourcesWithExpertDocsCount = sourcesWithExpertDocs.size;
      
      // Calculate sources with document type but no expert docs
      sourcesWithDocTypeButNoExpertDocsCount = sourcesWithDocTypeCount - sourcesWithExpertDocsCount;
      
      // Ensure we don't have negative numbers (would indicate a data issue)
      if (sourcesWithDocTypeButNoExpertDocsCount < 0) {
        console.warn("Warning: Calculation resulted in negative count for sources with doc type but no expert docs, setting to 0");
        sourcesWithDocTypeButNoExpertDocsCount = 0;
      }
      
      // Calculate sources with no document type
      sourcesWithNoDocTypeCount = totalSourcesGoogleCount - sourcesWithDocTypeCount;
      
    } catch (error) {
      console.warn("Couldn't get complete statistics:", error instanceof Error ? error.message : String(error));
    }
      
    // Create a map for quick lookup
    const sourcesMap = new Map();
    if (sourcesGoogle) {
      sourcesGoogle.forEach(source => {
        sourcesMap.set(source.id, {
          ...source,
          document_type_name: documentTypeMap.get(source.document_type_id) || 'Unknown'
        });
      });
    }
    
    // Combine the data and add mime_type
    const records = expertDocs.map(doc => ({
      ...doc,
      mime_type: sourcesMap.get(doc.source_id)?.mime_type || null,
      sources_google: sourcesMap.get(doc.source_id) || null
    }));
    
    // Calculate statistics by document type
    const stats: DocumentStats = {
      totalWithExpertDocs: sourcesGoogle?.length || 0,
      totalWithoutExpertDocs: withoutExpertDocsCount || 0,
      totalSourcesGoogle: totalSourcesGoogleCount,
      totalFolders: totalFoldersCount,
      byDocumentType: {}
    };
    
    // Count by document type
    records.forEach(record => {
      const docType = record.sources_google?.document_type_name || 'Unknown';
      stats.byDocumentType[docType] = (stats.byDocumentType[docType] || 0) + 1;
    });
    
    // Display summary statistics
    console.log("\nEXPERT DOCUMENTS SUMMARY");
    console.log("=======================");
    console.log(`Total sources_google records (not deleted): ${stats.totalSourcesGoogle}`);
    console.log(`Total folders: ${stats.totalFolders}`);
    console.log(`Total sources with expert documents: ${stats.totalWithExpertDocs}`);
    console.log(`Total sources with document types but no expert documents: ${stats.totalWithoutExpertDocs}`);
    console.log("\nEXPERT DOCUMENTS BY DOCUMENT TYPE");
    console.log("=================================");
    
    Object.entries(stats.byDocumentType)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .forEach(([docType, count]) => {
        console.log(`${docType}: ${count}`);
      });
    
    // Display a sample of records (first 10)
    const sampleSize = Math.min(10, records.length);
    const samples = records.slice(0, sampleSize);
    
    console.log(`\nSHOWING SAMPLE OF ${sampleSize} OUT OF ${records.length} EXPERT DOCUMENTS\n`);
    
    // Display the sample results
    samples.forEach((record: ExpertDocument, index: number) => {
      const sourceRecord = record.sources_google;
      
      console.log(`\n[${index + 1}] Expert Document Record:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Document Type: ${documentTypeMap.get(record.document_type_id) || 'Not specified'}`);
      console.log(`  MIME Type: ${record.mime_type || 'Not specified'}`);
      
      // Display sentences from content
      console.log(`  Raw Content: ${getContentSentences(record.raw_content)}`);
      console.log(`  Processed Content: ${getContentSentences(record.processed_content)}`);
      
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
    
    // Save statistics to markdown file
    const markdownPath = await saveStatsToMarkdown(stats, samples);
    if (markdownPath) {
      console.log(`\nDetailed report saved to: ${markdownPath}`);
    }
    
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: records.length,
      summary: `Successfully analyzed ${records.length} expert_documents with ${stats.totalWithoutExpertDocs} sources missing expert documents`
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