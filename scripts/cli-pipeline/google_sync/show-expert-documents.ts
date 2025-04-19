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
  totalExpertDocs: number;
  expertDocsWithDocType: number;
  expertDocsWithoutDocType: number;
  orphanedExpertDocs: number;
  orphanedExpertDocsByType: {
    [key: string]: number;
  };
  byDocumentType: {
    [key: string]: number;
  };
  expertDocsByDocType: {
    [key: string]: number;
  };
  byMimeType: {
    [key: string]: {
      total: number;
      withDocType: number;
      withoutDocType: number;
      withExpertDocs: number;
    }
  };
  sourcesByDocumentType: {
    [key: string]: number;
  };
  unclassifiedMimeTypes: {
    [key: string]: number;
  };
  expertDocsByMimeType: {
    [key: string]: number;
  };
  // File type summary
  fileTypeSummary: {
    [mimeType: string]: {
      total: number;
      withExpertDocs: number;
      withoutExpertDocs: number;
      percentageWithExpertDocs: number;
    }
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

function formatMarkdownTable(stats: DocumentStats, records: ExpertDocument[]): string {
  let markdown = `# Expert Documents Report\n\n`;
  
  // Document Type Distribution by Source
  markdown += `## Document Type Distribution in sources_google\n\n`;
  markdown += `| Document Type | Count | Percentage |\n`;
  markdown += `|--------------|-------|------------|\n`;
  
  // Sort document types by count (descending) for sources
  const sortedSourceTypes = Object.entries(stats.sourcesByDocumentType)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  
  for (const entry of sortedSourceTypes) {
    const docType = entry[0];
    const count = entry[1];
    const percentage = Math.round((count / stats.sourcesWithDocType) * 1000) / 10;
    // Ensure no UUID contaminates the document type or percentage
    const cleanDocType = docType.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '');
    markdown += `| ${cleanDocType} | ${count} | ${percentage}% |\n`;
  }
  
  // Unclassified MIME Types
  markdown += `\n## Unclassified MIME Types\n\n`;
  markdown += `| MIME Type | Count | Percentage of Unclassified |\n`;
  markdown += `|-----------|-------|-------------------------|\n`;
  
  // Sort unclassified mime types by count (descending)
  const sortedUnclassifiedMimeTypes = Object.entries(stats.unclassifiedMimeTypes)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  
  for (const entry of sortedUnclassifiedMimeTypes) {
    const mimeType = entry[0];
    const count = entry[1];
    const percentage = Math.round((count / stats.sourcesWithNoDocType) * 1000) / 10;
    markdown += `| ${mimeType} | ${count} | ${percentage}% |\n`;
  }
  
  // Sources Google Summary
  markdown += `\n## Sources Google Summary\n\n`;
  markdown += `| Status | Count | Percentage |\n`;
  markdown += `|--------|-------|------------|\n`;
  markdown += `| Total sources_google records (not deleted) | ${stats.totalSourcesGoogle} | 100% |\n`;
  markdown += `| Total folders | ${stats.totalFolders} | ${Math.round(stats.totalFolders / stats.totalSourcesGoogle * 1000) / 10}% |\n`;
  markdown += `| Total files (not folders) | ${stats.totalFiles} | ${Math.round(stats.totalFiles / stats.totalSourcesGoogle * 1000) / 10}% |\n`;
  
  // Document Types Breakdown
  markdown += `\n## Document Type Status\n\n`;
  markdown += `| Status | Count | Percentage of Total |\n`;
  markdown += `|--------|-------|--------------------|\n`;
  markdown += `| Sources with document type | ${stats.sourcesWithDocType} | ${Math.round(stats.sourcesWithDocType / stats.totalSourcesGoogle * 1000) / 10}% |\n`;
  markdown += `| Sources without document type | ${stats.sourcesWithNoDocType} | ${Math.round(stats.sourcesWithNoDocType / stats.totalSourcesGoogle * 1000) / 10}% |\n`;
  
  // Expert Documents Breakdown
  markdown += `\n## Expert Documents Status\n\n`;
  markdown += `| Status | Count | Percentage of Files |\n`;
  markdown += `|--------|-------|--------------------|\n`;
  markdown += `| Sources with expert documents | ${stats.sourcesWithExpertDocs} | ${Math.round(stats.sourcesWithExpertDocs / stats.totalFiles * 1000) / 10}% |\n`;
  markdown += `| Sources with document type but no expert documents | ${stats.sourcesWithDocTypeButNoExpertDocs} | ${Math.round(stats.sourcesWithDocTypeButNoExpertDocs / stats.totalFiles * 1000) / 10}% |\n`;
  markdown += `| Files with no expert documents | ${stats.filesWithNoExpertDocs} | ${Math.round(stats.filesWithNoExpertDocs / stats.totalFiles * 1000) / 10}% |\n`;
  
  // Summary Calculation
  const total = stats.sourcesWithExpertDocs + stats.sourcesWithDocTypeButNoExpertDocs + (stats.filesWithNoExpertDocs - stats.sourcesWithDocTypeButNoExpertDocs);
  if (total !== stats.totalFiles) {
    markdown += `\n> Note: There might be some overlap in the counts above\n\n`;
  }
  
  // MIME Type Breakdown
  markdown += `\n## MIME Type Breakdown\n\n`;
  markdown += `| MIME Type | Total Files | With Document Type | Without Document Type | With Expert Docs | % Classified |\n`;
  markdown += `|-----------|-------------|-------------------|----------------------|-----------------|-------------|\n`;
  
  // Sort mime types by total count (descending)
  const sortedMimeTypes = Object.entries(stats.byMimeType)
    .sort((a, b) => b[1].total - a[1].total);
  
  sortedMimeTypes.forEach(([mimeType, counts]) => {
    const percentClassified = counts.total > 0 
      ? Math.round((counts.withDocType / counts.total) * 100) 
      : 0;
    markdown += `| ${mimeType} | ${counts.total} | ${counts.withDocType} | ${counts.withoutDocType} | ${counts.withExpertDocs || 0} | ${percentClassified}% |\n`;
  });
  
  // File Type Summary - Shows every file type with expert_document coverage
  markdown += `\n## File Type Summary\n\n`;
  markdown += `| MIME Type | Total Files | With Expert Docs | Without Expert Docs | Coverage % |\n`;
  markdown += `|-----------|-------------|-----------------|-------------------|------------|\n`;
  
  // Sort file types by total count (descending)
  const sortedFileTypes = Object.entries(stats.fileTypeSummary)
    .sort((a: [string, any], b: [string, any]) => b[1].total - a[1].total);
    
  for (const entry of sortedFileTypes) {
    const mimeType = entry[0];
    const summary = entry[1];
    markdown += `| ${mimeType} | ${summary.total} | ${summary.withExpertDocs} | ${summary.withoutExpertDocs} | ${summary.percentageWithExpertDocs}% |\n`;
  }
  
  // Expert Documents direct document type analysis
  markdown += `\n## Expert Documents - Direct Document Type Analysis\n\n`;
  markdown += `| Status | Count | Percentage |\n`;
  markdown += `|--------|-------|------------|\n`;
  markdown += `| Total Expert Documents | ${stats.totalExpertDocs} | 100% |\n`;
  markdown += `| Expert Documents with Document Type | ${stats.expertDocsWithDocType} | ${Math.round(stats.expertDocsWithDocType / stats.totalExpertDocs * 1000) / 10}% |\n`;
  markdown += `| Expert Documents without Document Type | ${stats.expertDocsWithoutDocType} | ${Math.round(stats.expertDocsWithoutDocType / stats.totalExpertDocs * 1000) / 10}% |\n`;
  markdown += `| Orphaned Expert Documents (no sources_google) | ${stats.orphanedExpertDocs} | ${Math.round(stats.orphanedExpertDocs / stats.totalExpertDocs * 1000) / 10}% |\n`;
  
  // Orphaned Expert Documents by Document Type
  if (stats.orphanedExpertDocs > 0) {
    markdown += `\n## Orphaned Expert Documents by Document Type\n\n`;
    markdown += `| Document Type | Count | Percentage of Orphaned |\n`;
    markdown += `|--------------|-------|------------------------|\n`;
    
    // Sort orphaned docs by document type count (descending)
    const sortedOrphanedTypes = Object.entries(stats.orphanedExpertDocsByType)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      
    for (const entry of sortedOrphanedTypes) {
      const docType = entry[0];
      const count = entry[1];
      const percentage = Math.round((count / stats.orphanedExpertDocs) * 1000) / 10;
      markdown += `| ${docType} | ${count} | ${percentage}% |\n`;
    }
  }
  
  // Expert Document types by MIME Type
  markdown += `\n## Expert Documents by MIME Type\n\n`;
  markdown += `| MIME Type | Count | Percentage |\n`;
  markdown += `|-----------|-------|------------|\n`;
  
  // Sort expert docs by MIME type
  const sortedExpertMimeTypes = Object.entries(stats.expertDocsByMimeType)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  
  for (const entry of sortedExpertMimeTypes) {
    const mimeType = entry[0];
    const count = entry[1];
    const percentage = Math.round((count / stats.totalExpertDocs) * 1000) / 10;
    markdown += `| ${mimeType} | ${count} | ${percentage}% |\n`;
  }
  
  // Expert documents by direct document type
  markdown += `\n## Expert Documents by Direct Document Type\n\n`;
  markdown += `| Document Type | Count | Percentage |\n`;
  markdown += `|--------------|-------|------------|\n`;
  
  // Sort expert doc types by count (descending)
  const sortedExpertDocTypes = Object.entries(stats.expertDocsByDocType)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  
  for (const entry of sortedExpertDocTypes) {
    const docType = entry[0];
    const count = entry[1];
    const percentage = Math.round((count / stats.totalExpertDocs) * 1000) / 10;
    const cleanDocType = docType.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '');
    markdown += `| ${cleanDocType} | ${count} | ${percentage}% |\n`;
  }
  
  // Expert documents by source's document type (original way)
  markdown += `\n## Expert Documents by Source's Document Type\n\n`;
  markdown += `| Document Type | Count | Percentage |\n`;
  markdown += `|--------------|-------|------------|\n`;
  
  // Sort document types by count (descending)
  const sortedTypes = Object.entries(stats.byDocumentType)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
  
  for (const entry of sortedTypes) {
    const docType = entry[0];
    const count = entry[1];
    const percentage = Math.round((count / stats.totalExpertDocs) * 1000) / 10;
    // Ensure no UUID contaminates the document type or percentage
    const cleanDocType = docType.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '');
    markdown += `| ${cleanDocType} | ${count} | ${percentage}% |\n`;
  }
  
  return markdown;
}

async function saveStatsToMarkdown(
  stats: DocumentStats, 
  samples: ExpertDocument[], 
  allRecords: ExpertDocument[],
  documentTypesList: DocumentType[]
): Promise<string> {
  try {
    const markdownPath = './docs/cli-pipeline/expert-documents-report.md';
    let markdown = formatMarkdownTable(stats, allRecords);
    
    // Add sample documents section
    markdown += `\n## Sample Expert Documents\n\n`;
    
    for (let i = 0; i < samples.length; i++) {
      const doc = samples[i];
      const docType = doc.sources_google?.document_type_name || 'Unknown';
      const fileName = doc.sources_google?.name || 'Unknown file';
      
      markdown += `### ${i + 1}. ${fileName} (${docType})\n\n`;
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
    }
    
    // Add orphaned expert documents section if any exist
    if (stats.orphanedExpertDocs > 0) {
      markdown += `\n## Orphaned Expert Documents (without sources_google records)\n\n`;
      
      // Find orphaned documents
      const orphanedDocs = allRecords.filter(doc => !doc.sources_google);
      
      // Show samples of orphaned documents (up to 10)
      const orphanSamples = orphanedDocs.slice(0, 10);
      
      for (let i = 0; i < orphanSamples.length; i++) {
        const doc = orphanSamples[i];
        const typeId = doc.document_type_id;
        const typeName = typeId ? (documentTypesList.find((dt: DocumentType) => dt.id === typeId)?.document_type || typeId) : 'No Document Type';
        const docType = `${i + 1}. Document Type: ${typeName}`;
        
        markdown += `### ${docType}\n\n`;
        markdown += `- ID: \`${doc.id}\`\n`;
        markdown += `- Source ID (invalid/deleted): \`${doc.source_id}\`\n`;
        markdown += `- MIME Type: ${doc.mime_type || 'Not specified'}\n`;
        
        // Raw content section
        markdown += `\n**Raw Content Preview:**\n\n`;
        markdown += `> ${getContentSentences(doc.raw_content, 2)}\n\n`;
        
        // Processed content section
        markdown += `**Processed Content Preview:**\n\n`;
        markdown += `> ${getContentSentences(doc.processed_content, 2)}\n\n`;
        
        // Separator
        markdown += `---\n\n`;
      }
      
      if (orphanedDocs.length > 10) {
        markdown += `\n*${orphanedDocs.length - 10} more orphaned expert documents not shown*\n\n`;
      }
    }
    
    fs.writeFileSync(markdownPath, markdown);
    return markdownPath;
  } catch (error) {
    console.error("Failed to save markdown report:", error);
    return "";
  }
}

/**
 * Helper function to safely execute a Supabase query with retry capability
 */
async function safeQuery(queryFn: Function, description: string, maxRetries = 3): Promise<any> {
  let retryCount = 0;
  while (retryCount < maxRetries) {
    try {
      console.log(`Running query: ${description} (attempt ${retryCount + 1}/${maxRetries})...`);
      const result = await queryFn();
      
      if (result.error) {
        throw result.error;
      }
      
      console.log(`Query successful: ${description}`);
      return result;
    } catch (error) {
      retryCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Query attempt ${retryCount}/${maxRetries} failed: ${errorMessage}`);
      
      if (retryCount >= maxRetries) {
        console.error(`All retry attempts failed for: ${description}`);
        throw error;
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const delay = 1000 * Math.pow(2, retryCount - 1);
      console.log(`Waiting ${delay}ms before retrying...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Failed to execute query after ${maxRetries} attempts: ${description}`);
}

async function showExpertDocuments() {
  const trackingId = await commandTrackingService.startTracking('google_sync', 'show-expert-documents');

  try {
    // Initialize Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log("Fetching sources_google with associated expert_documents...");
    
    // First get all document types in one query to use as lookup with retry
    const documentTypesResult = await safeQuery(
      () => supabase.from('document_types').select('id, document_type'),
      'Fetch document types'
    );
    
    const documentTypes = documentTypesResult.data;
    console.log(`Successfully fetched ${documentTypes?.length || 0} document types`);
    
    // Create a lookup map for document types
    const documentTypeMap = new Map<string, string>();
    if (documentTypes) {
      documentTypes.forEach((dt: DocumentType) => {
        documentTypeMap.set(dt.id, dt.document_type);
      });
    }
    
    // Get all expert documents with retry
    const expertDocsResult = await safeQuery(
      () => supabase
        .from('expert_documents')
        .select(`
          id,
          document_type_id,
          raw_content,
          processed_content,
          source_id,
          content_type,
          processing_stats
        `)
        .limit(1000), // Add a reasonable limit to avoid timeouts
      'Fetch expert documents'
    );
    
    const expertDocs = expertDocsResult.data;
    console.log(`Successfully fetched ${expertDocs?.length || 0} expert documents`);
    
    if (!expertDocs || expertDocs.length === 0) {
      console.log("No expert_documents found");
      await commandTrackingService.completeTracking(trackingId, {
        summary: "No expert_documents found"
      });
      return;
    }
    
    // Get the source IDs for lookup
    const sourceIds = expertDocs.map((doc: any) => doc.source_id).filter(Boolean);
    
    // Get the associated sources_google records with retry
    console.log(`Fetching ${sourceIds.length} associated sources_google records...`);
    const sourcesGoogleResult = await safeQuery(
      () => supabase
        .from('sources_google')
        .select('id, name, document_type_id, mime_type')
        .in('id', sourceIds.slice(0, 100)), // Limit the IN clause to avoid errors with too many values
      'Fetch initial sources_google batch'
    );
    
    let sourcesGoogle = sourcesGoogleResult.data || [];
    console.log(`Successfully fetched ${sourcesGoogle.length} sources_google records`);
    
    // If we have more source IDs, fetch them in batches
    if (sourceIds.length > 100) {
      console.log(`Fetching remaining sources in batches...`);
      const batches = Math.ceil(sourceIds.length / 100);
      
      for (let i = 1; i < batches; i++) {
        const batchStart = i * 100;
        const batchEnd = Math.min((i + 1) * 100, sourceIds.length);
        const batchIds = sourceIds.slice(batchStart, batchEnd);
        
        try {
          const batchResult = await safeQuery(
            () => supabase
              .from('sources_google')
              .select('id, name, document_type_id, mime_type')
              .in('id', batchIds),
            `Fetch sources_google batch ${i+1}/${batches}`
          );
          
          const batchSources = batchResult.data || [];
          console.log(`Successfully fetched ${batchSources.length} additional sources`);
          sourcesGoogle = [...sourcesGoogle, ...batchSources];
        } catch (error) {
          console.warn(`Error fetching batch ${i+1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
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
      // Get total count of non-deleted sources_google records with retry
      console.log("Getting sources_google count statistics...");
      try {
        const totalCountResult = await safeQuery(
          () => supabase
            .from('sources_google')
            .select('*', { count: 'exact', head: true })
            .eq('is_deleted', false),
          'Count total sources_google records'
        );
      
        totalSourcesGoogleCount = totalCountResult.count || 0;
      } catch (error) {
        console.warn("Error counting total sources_google:", error instanceof Error ? error.message : String(error));
      }
      
      // Get count of folders (mime_type = 'application/vnd.google-apps.folder') with retry
      try {
        const foldersCountResult = await safeQuery(
          () => supabase
            .from('sources_google')
            .select('*', { count: 'exact', head: true })
            .eq('is_deleted', false)
            .eq('mime_type', 'application/vnd.google-apps.folder'),
          'Count folders'
        );
        
        totalFoldersCount = foldersCountResult.count || 0;
        totalFilesCount = totalSourcesGoogleCount - totalFoldersCount;
      } catch (error) {
        console.warn("Error counting folders:", error instanceof Error ? error.message : String(error));
      }
      
      // Get count of sources with document types with retry
      try {
        const withDocTypesResult = await safeQuery(
          () => supabase
            .from('sources_google')
            .select('*', { count: 'exact', head: true })
            .not('document_type_id', 'is', null)
            .eq('is_deleted', false),
          'Count sources with document types'
        );
        
        sourcesWithDocTypeCount = withDocTypesResult.count || 0;
      } catch (error) {
        console.warn("Error counting sources with document types:", error instanceof Error ? error.message : String(error));
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
      sourcesGoogle.forEach((source: any) => {
        sourcesMap.set(source.id, {
          ...source,
          document_type_name: documentTypeMap.get(source.document_type_id) || 'Unknown'
        });
      });
    }
    
    // Combine the data and add mime_type
    const records = expertDocs.map((doc: any) => ({
      ...doc,
      mime_type: sourcesMap.get(doc.source_id)?.mime_type || null,
      sources_google: sourcesMap.get(doc.source_id) || null
    }));
    
    // Calculate statistics by document type
    const stats: DocumentStats = {
      totalSourcesGoogle: totalSourcesGoogleCount,
      totalFolders: totalFoldersCount,
      totalFiles: totalFilesCount,
      sourcesWithDocType: sourcesWithDocTypeCount,
      sourcesWithExpertDocs: sourcesWithExpertDocsCount,
      sourcesWithDocTypeButNoExpertDocs: sourcesWithDocTypeButNoExpertDocsCount,
      sourcesWithNoDocType: sourcesWithNoDocTypeCount,
      filesWithNoExpertDocs: totalFilesCount - sourcesWithExpertDocsCount,
      totalExpertDocs: records.length,
      expertDocsWithDocType: 0, // Will calculate shortly
      expertDocsWithoutDocType: 0, // Will calculate shortly
      orphanedExpertDocs: 0, // Will calculate shortly
      orphanedExpertDocsByType: {}, // Will calculate shortly
      byDocumentType: {},
      expertDocsByDocType: {},
      byMimeType: {},
      sourcesByDocumentType: {},
      unclassifiedMimeTypes: {},
      expertDocsByMimeType: {},
      fileTypeSummary: {}
    };
    
    // Count by document type - both source-based and expert docs directly
    records.forEach((record: any) => {
      // Count by source document type (using sources_google)
      const sourceDocType = record.sources_google?.document_type_name || 'Unknown';
      stats.byDocumentType[sourceDocType] = (stats.byDocumentType[sourceDocType] || 0) + 1;
      
      // Count by expert document's own document_type_id (direct)
      const expertDocType = record.document_type_id ? documentTypeMap.get(record.document_type_id) || 'Unknown Document Type' : 'No Document Type';
      stats.expertDocsByDocType[expertDocType] = (stats.expertDocsByDocType[expertDocType] || 0) + 1;
      
      // Count by mime type
      const mimeType = record.mime_type || 'Unknown MIME Type';
      stats.expertDocsByMimeType[mimeType] = (stats.expertDocsByMimeType[mimeType] || 0) + 1;
      
      // Count expert docs with/without document type
      if (record.document_type_id) {
        stats.expertDocsWithDocType++;
      } else {
        stats.expertDocsWithoutDocType++;
      }
    });
    
    // Get mime_type statistics and check all sources_google files
    try {
      // Identify orphaned expert_documents (those without a sources_google entry)
      console.log("Identifying orphaned expert_documents...");
      const validSourceIds = new Set<string>();
      const orphanedDocs: ExpertDocument[] = [];
      
      // Create a map of source_id to expert_documents
      const expertDocsBySourceId = new Map<string, ExpertDocument[]>();
      records.forEach((record: ExpertDocument) => {
        if (record.source_id) {
          if (!expertDocsBySourceId.has(record.source_id)) {
            expertDocsBySourceId.set(record.source_id, []);
          }
          expertDocsBySourceId.get(record.source_id)?.push(record);
          
          // If this record has a valid sources_google entry, add to validSourceIds
          if (record.sources_google) {
            validSourceIds.add(record.source_id);
          } else {
            orphanedDocs.push(record);
          }
        }
      });
      
      // Count orphaned expert_documents
      stats.orphanedExpertDocs = orphanedDocs.length;
      console.log(`Found ${orphanedDocs.length} orphaned expert_documents (without sources_google records)`);
      
      // Count orphaned expert_documents by document type
      orphanedDocs.forEach(doc => {
        const docType = doc.document_type_id ? 
          (documentTypeMap.get(doc.document_type_id) || 'Unknown Document Type') : 
          'No Document Type';
        
        stats.orphanedExpertDocsByType[docType] = (stats.orphanedExpertDocsByType[docType] || 0) + 1;
      });
      
      // Get all sources_google files (not folders) to check for expert_documents
      console.log("Fetching all sources_google non-folder records for comprehensive analysis...");
      try {
        const allSourcesGoogleResult = await safeQuery(
          () => supabase
            .from('sources_google')
            .select('id, name, mime_type, document_type_id')
            .eq('is_deleted', false)
            .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
            .limit(10000), // Higher limit for more comprehensive analysis
          'Fetch all sources_google non-folder records'
        );
      
        const allSourcesGoogle = allSourcesGoogleResult.data;
        console.log(`Successfully fetched ${allSourcesGoogle?.length || 0} sources_google files (not folders)`);
        
        if (allSourcesGoogle) {
          // Process each record to build comprehensive file type statistics
          allSourcesGoogle.forEach((source: any) => {
            const mimeType = source.mime_type || 'unknown';
            const hasExpertDoc = expertDocsBySourceId.has(source.id);
            
            // Initialize mime_type entry if it doesn't exist
            if (!stats.byMimeType[mimeType]) {
              stats.byMimeType[mimeType] = {
                total: 0,
                withDocType: 0,
                withoutDocType: 0,
                withExpertDocs: 0
              };
            }
            
            // Initialize file type summary if it doesn't exist
            if (!stats.fileTypeSummary[mimeType]) {
              stats.fileTypeSummary[mimeType] = {
                total: 0,
                withExpertDocs: 0,
                withoutExpertDocs: 0,
                percentageWithExpertDocs: 0
              };
            }
            
            // Increment counts
            stats.byMimeType[mimeType].total++;
            stats.fileTypeSummary[mimeType].total++;
            
            if (hasExpertDoc) {
              stats.byMimeType[mimeType].withExpertDocs++;
              stats.fileTypeSummary[mimeType].withExpertDocs++;
            } else {
              stats.fileTypeSummary[mimeType].withoutExpertDocs++;
            }
            
            if (source.document_type_id) {
              stats.byMimeType[mimeType].withDocType++;
              
              // Count sources by document type
              const docTypeName = documentTypeMap.get(source.document_type_id) || 'Unknown';
              stats.sourcesByDocumentType[docTypeName] = (stats.sourcesByDocumentType[docTypeName] || 0) + 1;
            } else {
              stats.byMimeType[mimeType].withoutDocType++;
              
              // Count unclassified mime types
              stats.unclassifiedMimeTypes[mimeType] = (stats.unclassifiedMimeTypes[mimeType] || 0) + 1;
            }
          });
          
          // Calculate percentages for file type summary
          Object.keys(stats.fileTypeSummary).forEach(mimeType => {
            const summary = stats.fileTypeSummary[mimeType];
            summary.percentageWithExpertDocs = summary.total > 0 ? 
              Math.round((summary.withExpertDocs / summary.total) * 100) : 0;
          });
        }
      } catch (innerError) {
        console.warn("Error fetching sources_google for comprehensive analysis:", 
          innerError instanceof Error ? innerError.message : String(innerError));
      }
    } catch (error) {
      console.warn("Error analyzing sources_google and expert_documents:", 
        error instanceof Error ? error.message : String(error));
    }
    
    // Display document type distribution
    console.log("\nDOCUMENT TYPE DISTRIBUTION BY SOURCE");
    console.log("==================================");
    
    // Sort document types by count descending for sources
    const sortedSourceTypes = Object.entries(stats.sourcesByDocumentType)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      
    for (const entry of sortedSourceTypes) {
      const docType = entry[0];
      const count = entry[1];
      const percentage = Math.round((count / stats.sourcesWithDocType) * 1000) / 10;
      console.log(`${docType.padEnd(30)} | ${count.toString().padStart(5)} | ${percentage}%`);
    }
    
    // Display unclassified mime types
    console.log("\nUNCLASSIFIED MIME TYPES");
    console.log("======================");
    
    // Sort unclassified mime types by count descending
    const sortedUnclassifiedMimeTypes = Object.entries(stats.unclassifiedMimeTypes)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      
    for (const entry of sortedUnclassifiedMimeTypes) {
      const mimeType = entry[0];
      const count = entry[1];
      const percentage = Math.round((count / stats.sourcesWithNoDocType) * 1000) / 10;
      console.log(`${mimeType.padEnd(30)} | ${count.toString().padStart(5)} | ${percentage}%`);
    }
    
    // Display summary statistics
    console.log("\nSOURCES GOOGLE SUMMARY");
    console.log("=====================");
    console.log(`Total sources_google records (not deleted): ${stats.totalSourcesGoogle}`);
    console.log(`- Total folders: ${stats.totalFolders}`);
    console.log(`- Total files (not folders): ${stats.totalFiles}`);
    console.log("\nDOCUMENT TYPE BREAKDOWN");
    console.log("=====================");
    console.log(`Sources with document type: ${stats.sourcesWithDocType}`);
    console.log(`Sources without document type: ${stats.sourcesWithNoDocType}`);
    console.log("\nEXPERT DOCUMENTS BREAKDOWN");
    console.log("========================");
    console.log(`Sources with expert documents: ${stats.sourcesWithExpertDocs}`);
    console.log(`Sources with document type but no expert documents: ${stats.sourcesWithDocTypeButNoExpertDocs}`);
    console.log(`Files with no expert documents: ${stats.filesWithNoExpertDocs}`);
    
    // Display mime type breakdown
    console.log("\nMIME TYPE BREAKDOWN");
    console.log("==================");
    console.log("MIME Type | Total | With Doc Type | Without Doc Type | % Classified");
    console.log("---------|-------|--------------|-----------------|------------");
    
    // Sort mime types by total count descending
    const sortedMimeTypes = Object.entries(stats.byMimeType)
      .sort((a: [string, any], b: [string, any]) => b[1].total - a[1].total);
      
    for (const entry of sortedMimeTypes) {
      const mimeType = entry[0];
      const counts = entry[1];
      const percentClassified = counts.total > 0 
        ? Math.round((counts.withDocType / counts.total) * 100) 
        : 0;
      console.log(`${mimeType.padEnd(15)} | ${counts.total.toString().padStart(5)} | ${counts.withDocType.toString().padStart(12)} | ${counts.withoutDocType.toString().padStart(15)} | ${percentClassified}%`);
    }
    
    // Display expert document statistics
    console.log("\nEXPERT DOCUMENTS DIRECT ANALYSIS");
    console.log("===============================");
    console.log(`Total Expert Documents: ${stats.totalExpertDocs}`);
    console.log(`With Document Type: ${stats.expertDocsWithDocType} (${Math.round(stats.expertDocsWithDocType / stats.totalExpertDocs * 100)}%)`);
    console.log(`Without Document Type: ${stats.expertDocsWithoutDocType} (${Math.round(stats.expertDocsWithoutDocType / stats.totalExpertDocs * 100)}%)`);
    console.log(`Orphaned Expert Documents (no sources_google): ${stats.orphanedExpertDocs} (${Math.round(stats.orphanedExpertDocs / stats.totalExpertDocs * 100)}%)`);
    
    // Display file type summary - statistics for every file by MIME type
    console.log("\nFILE TYPE SUMMARY");
    console.log("================");
    console.log("MIME Type | Total Files | With Expert Docs | Without Expert Docs | Coverage %");
    console.log("---------|-------------|-----------------|-------------------|------------");
    
    // Sort file types by total count (descending)
    const fileTypeSummary = Object.entries(stats.fileTypeSummary)
      .sort((a: [string, any], b: [string, any]) => b[1].total - a[1].total);
    
    for (const entry of fileTypeSummary) {
      const mimeType = entry[0];
      const summary = entry[1];
      console.log(`${mimeType.padEnd(15)} | ${summary.total.toString().padStart(5)} | ${summary.withExpertDocs.toString().padStart(12)} | ${summary.withoutExpertDocs.toString().padStart(15)} | ${summary.percentageWithExpertDocs}%`);
    }
    
    // Display orphaned expert documents by document type if any exist
    if (stats.orphanedExpertDocs > 0) {
      console.log("\nORPHANED EXPERT DOCUMENTS BY DOCUMENT TYPE");
      console.log("========================================");
      
      // Sort orphaned documents by count (descending)
      const sortedOrphanedTypes = Object.entries(stats.orphanedExpertDocsByType)
        .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      
      for (const entry of sortedOrphanedTypes) {
        const docType = entry[0];
        const count = entry[1];
        const percentage = Math.round((count / stats.orphanedExpertDocs) * 100);
        console.log(`${docType.padEnd(40)} | ${count.toString().padStart(5)} | ${percentage}%`);
      }
      
      // Display sample content from orphaned documents
      console.log("\nSAMPLE CONTENT FROM ORPHANED EXPERT DOCUMENTS");
      console.log("===========================================");
      
      // Find orphaned documents
      const orphanedDocs = records.filter((doc: ExpertDocument) => !doc.sources_google);
      const orphanSamples = orphanedDocs.slice(0, 5); // Show just 5 samples
      
      for (let i = 0; i < orphanSamples.length; i++) {
        const doc = orphanSamples[i];
        const typeId = doc.document_type_id;
        const typeName = typeId ? (documentTypes?.find((dt: DocumentType) => dt.id === typeId)?.document_type || 'Unknown') : 'None';
        console.log(`\n[${i+1}] Document Type: ${typeName}`);
        console.log(`    ID: ${doc.id}`);
        console.log(`    Content Sample: ${getContentSentences(doc.raw_content || doc.processed_content, 1)}`);
      }
      
      if (orphanedDocs.length > 5) {
        console.log(`\n...and ${orphanedDocs.length - 5} more orphaned documents not shown`);
      }
    }
    
    // Display expert documents by MIME type
    console.log("\nEXPERT DOCUMENTS BY MIME TYPE");
    console.log("============================");
    
    const sortedExpertMimeTypes = Object.entries(stats.expertDocsByMimeType)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      
    for (const entry of sortedExpertMimeTypes.slice(0, 15)) { // Show top 15
      const mimeType = entry[0];
      const count = entry[1];
      const percentage = Math.round((count / stats.totalExpertDocs) * 100);
      console.log(`${mimeType.padEnd(40)} | ${count.toString().padStart(5)} | ${percentage}%`);
    }
    if (sortedExpertMimeTypes.length > 15) {
      console.log(`... and ${sortedExpertMimeTypes.length - 15} more MIME types`);
    }
    
    // Display expert documents by direct document type
    console.log("\nEXPERT DOCUMENTS BY DIRECT DOCUMENT TYPE");
    console.log("=====================================");
    
    const sortedExpertDocTypes = Object.entries(stats.expertDocsByDocType)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      
    for (const entry of sortedExpertDocTypes) {
      const docType = entry[0];
      const count = entry[1];
      const percentage = Math.round((count / stats.totalExpertDocs) * 100);
      console.log(`${docType.padEnd(40)} | ${count.toString().padStart(5)} | ${percentage}%`);
    }
    
    // Display expert documents by source's document type (original way)
    console.log("\nEXPERT DOCUMENTS BY SOURCE'S DOCUMENT TYPE");
    console.log("========================================");
    
    const sortedDocTypes = Object.entries(stats.byDocumentType)
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1]); // Sort by count descending
      
    for (const entry of sortedDocTypes) {
      const docType = entry[0];
      const count = entry[1];
      const percentage = Math.round((count / stats.totalExpertDocs) * 100);
      console.log(`${docType.padEnd(40)} | ${count.toString().padStart(5)} | ${percentage}%`);
    }
    
    // Display a sample of records (first 10)
    const sampleSize = Math.min(10, records.length);
    const samples = records.slice(0, sampleSize);
    
    console.log(`\nSHOWING SAMPLE OF ${sampleSize} OUT OF ${records.length} EXPERT DOCUMENTS\n`);
    
    // Display the sample results
    for (let index = 0; index < samples.length; index++) {
      const record = samples[index];
      const sourceRecord = record.sources_google;
      
      console.log(`\n[${index + 1}] Expert Document Record:`);
      console.log(`  ID: ${record.id}`);
      // Show both source and direct document types
      console.log(`  Document Type (direct): ${record.document_type_id ? documentTypeMap.get(record.document_type_id) || 'Unknown Type ID' : 'Not specified'}`);
      console.log(`  Document Type (source): ${record.sources_google?.document_type_id ? documentTypeMap.get(record.sources_google.document_type_id) || 'Unknown Type ID' : 'Not specified'}`);
      console.log(`  MIME Type: ${record.mime_type || 'Not specified'}`);
      
      // Display processing stats - especially for m4a files showing main_video_id
      if (record.processing_stats) {
        console.log(`  Processing Stats:`);
        try {
          if (typeof record.processing_stats === 'string') {
            const stats = JSON.parse(record.processing_stats);
            Object.entries(stats).forEach(([key, value]) => {
              console.log(`    - ${key}: ${JSON.stringify(value)}`);
            });
          } else {
            Object.entries(record.processing_stats).forEach(([key, value]) => {
              console.log(`    - ${key}: ${JSON.stringify(value)}`);
            });
          }
        } catch (error) {
          console.log(`    Error parsing processing_stats: ${record.processing_stats}`);
        }
      }
      
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
    }
    
    // Save statistics to markdown file
    const markdownPath = await saveStatsToMarkdown(stats, samples, records, documentTypes);
    if (markdownPath) {
      console.log(`\nDetailed report saved to: ${markdownPath}`);
    }
    
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: records.length,
      summary: `Successfully analyzed ${records.length} expert documents from ${stats.sourcesWithExpertDocs} sources. Found ${stats.filesWithNoExpertDocs} files without expert documents.`
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