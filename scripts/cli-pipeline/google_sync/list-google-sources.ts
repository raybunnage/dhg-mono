#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as fs from 'fs';
import * as path from 'path';

const supabase = SupabaseClientService.getInstance().getClient();

/**
 * Lists Google Drive sources and their corresponding expert documents with detailed information.
 * Outputs a comprehensive report to a markdown file in the docs/cli-pipeline directory.
 * 
 * Report includes:
 * 1. Name of the sources_google file
 * 2. Document type
 * 3. Whether a matching expert_document exists
 * 4. Document type of the expert_document (if it exists)
 * 5. Preview of raw_content (50 chars)
 * 6. Whether JSON exists in processed_content
 * 7. Preview of processed_content (200 chars)
 */
async function listGoogleSources(options: { 
  limit?: number,
  filter?: string,
  expert?: string,
  output?: string, 
  sortBy?: string
}) {
  // Generate tracking ID
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'list-google-sources');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    console.log(`Generating report of Google sources and their expert documents...`);
    
    // Default options
    const limit = options.limit || 100;
    const filter = options.filter || '';
    const sortBy = options.sortBy || 'name'; 
    const outputFilePath = options.output || path.join(process.cwd(), 'docs', 'cli-pipeline', 'google-sources-list.md');
    
    // First, get the sources
    let query = supabase
      .from('sources_google')
      .select(`
        id,
        name,
        document_type_id,
        mime_type,
        path_depth
      `)
      .limit(limit);
    
    // Apply filters if provided
    if (filter) {
      query = query.ilike('name', `%${filter}%`);
    }
    
    // Filter out mp4, m4a, and folder files
    query = query.not('mime_type', 'ilike', '%video/mp4%')
                 .not('mime_type', 'eq', 'audio/x-m4a')
                 .not('mime_type', 'ilike', '%application/vnd.google-apps.folder%');
    
    // Apply expert filter if provided
    if (options.expert) {
      const { data: expert, error: expertError } = await supabase
        .from('experts')
        .select('id')
        .eq('expert_name', options.expert)
        .single();
      
      if (expertError) {
        console.error(`Error finding expert with name ${options.expert}: ${expertError.message}`);
        return;
      }
      
      if (expert) {
        const { data: expertSources, error: sourcesError } = await supabase
          .from('sources_google_experts')
          .select('source_id')
          .eq('expert_id', expert.id);
        
        if (sourcesError) {
          console.error(`Error fetching sources for expert: ${sourcesError.message}`);
          return;
        }
        
        if (expertSources && expertSources.length > 0) {
          const sourceIds = expertSources.map(es => es.source_id);
          query = query.in('id', sourceIds);
        } else {
          console.log(`No sources found for expert: ${options.expert}`);
          return;
        }
      }
    }
    
    // Apply sorting
    if (sortBy === 'name') {
      query = query.order('name', { ascending: true });
    } else if (sortBy === 'updated') {
      query = query.order('updated_at', { ascending: false });
    } else if (sortBy === 'type') {
      query = query.order('document_type_id', { ascending: true });
    }
    
    // Execute the query
    const { data: sources, error } = await query as { 
      data: GoogleSource[] | null;
      error: any;
    };
    
    if (error) {
      console.error(`Error fetching sources: ${error.message}`);
      return;
    }
    
    if (!sources || sources.length === 0) {
      console.log('No sources found matching the criteria.');
      return;
    }
    
    console.log(`Found ${sources.length} sources.`);
    
    // Get all the document types to map IDs to names
    const { data: documentTypes, error: docTypesError } = await supabase
      .from('document_types')
      .select('id, document_type');
      
    if (docTypesError) {
      console.error(`Error fetching document types: ${docTypesError.message}`);
      return;
    }
    
    // Create a map for quick lookups
    const documentTypeMap = new Map();
    if (documentTypes) {
      for (const dt of documentTypes) {
        documentTypeMap.set(dt.id, dt.document_type);
      }
    }
    
    // Get all expert documents for the sources
    const sourceIds = sources.map(s => s.id);
    const { data: expertDocs, error: expertDocsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_type_id, raw_content, processed_content')
      .in('source_id', sourceIds);
      
    if (expertDocsError) {
      console.error(`Error fetching expert documents: ${expertDocsError.message}`);
      return;
    }
    
    // Create a map of source_id to expert_document for quick lookups
    const expertDocsMap = new Map<string, ExpertDocument[]>();
    if (expertDocs) {
      for (const doc of expertDocs) {
        if (!expertDocsMap.has(doc.source_id)) {
          expertDocsMap.set(doc.source_id, []);
        }
        expertDocsMap.get(doc.source_id)?.push(doc);
      }
    }
    
    // Generate the markdown report
    let report = `# Google Sources and Expert Documents Report\n\n`;
    report += `This report excludes MP4 videos, M4A audio files, and folders.\n\n`;
    report += `Report generated on: ${new Date().toISOString()}\n\n`;
    report += `Total sources found: ${sources.length}\n\n`;
    
    if (filter) {
      report += `Filter: "${filter}"\n\n`;
    }
    
    if (options.expert) {
      report += `Expert: ${options.expert}\n\n`;
    }
    
    report += `## Sources List\n\n`;
    report += `| Source Name | Document Type | Has Expert Doc | Expert Doc Type | Raw Content Preview | Has JSON | Processed Content Preview |\n`;
    report += `|-------------|---------------|----------------|-----------------|---------------------|----------|---------------------------|\n`;
    
    for (const source of sources) {
      const sourceName = source.name || 'Unnamed';
      const documentType = source.document_type_id ? documentTypeMap.get(source.document_type_id) || 'Unknown' : 'None';
      
      // Check for expert document
      const expertDocsForSource = expertDocsMap.get(source.id) || [];
      const hasExpertDoc = expertDocsForSource.length > 0;
      const expertDoc = hasExpertDoc ? expertDocsForSource[0] : null;
      
      // Get expert document details
      const expertDocType = expertDoc?.document_type_id ? documentTypeMap.get(expertDoc.document_type_id) || 'Unknown' : 'N/A';
      
      // Preview of raw content (first 50 chars)
      let rawContentPreview = 'None';
      if (expertDoc?.raw_content) {
        rawContentPreview = expertDoc.raw_content.substring(0, 50).replace(/\\n/g, ' ').replace(/\\r/g, '');
        if (expertDoc.raw_content.length > 50) {
          rawContentPreview += '...';
        }
      }
      
      // Check if processed_content is JSON
      let hasJson = false;
      let processedContentPreview = 'None';
      
      if (expertDoc?.processed_content) {
        try {
          // Since it's already parsed from the database, we can check if it's an object
          if (typeof expertDoc.processed_content === 'object') {
            hasJson = true;
            // Convert back to string for preview
            const jsonStr = JSON.stringify(expertDoc.processed_content);
            processedContentPreview = jsonStr.substring(0, 200);
            if (jsonStr.length > 200) {
              processedContentPreview += '...';
            }
          } else if (typeof expertDoc.processed_content === 'string') {
            try {
              // Try to parse it as JSON if it's a string
              JSON.parse(expertDoc.processed_content);
              hasJson = true;
              processedContentPreview = expertDoc.processed_content.substring(0, 200);
              if (expertDoc.processed_content.length > 200) {
                processedContentPreview += '...';
              }
            } catch (e) {
              // Not valid JSON
              processedContentPreview = expertDoc.processed_content.substring(0, 200);
              if (expertDoc.processed_content.length > 200) {
                processedContentPreview += '...';
              }
            }
          }
        } catch (e) {
          // Not valid JSON or error in processing
          processedContentPreview = 'Error processing content';
        }
      }
      
      // Escape any pipe characters in the data to avoid breaking the markdown table
      const safeSourceName = sourceName.replace(/\|/g, '\\|');
      const safeDocumentType = documentType.replace(/\|/g, '\\|');
      const safeExpertDocType = expertDocType.replace(/\|/g, '\\|');
      const safeRawContent = rawContentPreview.replace(/\|/g, '\\|');
      const safeProcessedContent = processedContentPreview.replace(/\|/g, '\\|');
      
      // Add row to the table
      report += `| ${safeSourceName} | ${safeDocumentType} | ${hasExpertDoc ? 'Yes' : 'No'} | ${safeExpertDocType} | ${safeRawContent} | ${hasJson ? 'Yes' : 'No'} | ${safeProcessedContent} |\n`;
    }
    
    // Add summary information
    const sourcesWithExpertDocs = sourceIds.filter(id => expertDocsMap.has(id)).length;
    const totalExpertDocs = expertDocs?.length || 0;
    
    report += `\n## Summary\n\n`;
    report += `- Total sources: ${sources.length}\n`;
    report += `- Sources with expert documents: ${sourcesWithExpertDocs}\n`;
    report += `- Total expert documents: ${totalExpertDocs}\n`;
    
    // Write the report to the output file
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, report);
    
    console.log(`Report generated successfully and saved to: ${outputFilePath}`);
    
    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: sources.length,
        summary: `Listed ${sources.length} Google sources and their expert documents`
      });
    }
  } catch (error) {
    console.error(`Error generating report: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.failTracking(trackingId, 
        `Error generating report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Type definition to help with TypeScript
type GoogleSource = {
  id: string;
  name: string;
  document_type_id: string | null;
  mime_type: string | null;
  path_depth: number | null;
};

type ExpertDocument = {
  id: string;
  source_id: string;
  document_type_id: string | null;
  raw_content: string | null;
  processed_content: any;
};

// Set up CLI command
const program = new Command();

program
  .name('list-google-sources')
  .description('Lists Google Drive sources and their corresponding expert documents with detailed information (excludes MP4 videos, M4A audio files, and folders)')
  .option('-l, --limit <number>', 'Maximum number of sources to list', '100')
  .option('-f, --filter <string>', 'Filter sources by name')
  .option('-e, --expert <string>', 'Filter sources by expert name')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('-s, --sort-by <field>', 'Sort results by field (name, updated, type)', 'name')
  .action((options) => {
    listGoogleSources({
      limit: parseInt(options.limit),
      filter: options.filter,
      expert: options.expert,
      output: options.output,
      sortBy: options.sortBy
    });
  });

program.parse(process.argv);