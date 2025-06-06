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
 * 7. The pipeline_status field instead of reprocessing_status
 */
async function listPipelineStatus(options: { 
  limit?: number,
  filter?: string,
  expert?: string,
  output?: string, 
  sortBy?: string,
  console?: boolean,
  status?: string,
  excludeProcessed?: boolean,
  isNewFile?: boolean
}) {
  // Generate tracking ID
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'list-pipeline-status');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    console.log(`Generating report of Google sources with pipeline status...`);
    
    // Default options
    const limit = options.limit || 1000;
    const filter = options.filter || '';
    const sortBy = options.sortBy || 'name'; 
    const outputFilePath = options.output || path.join(process.cwd(), 'docs', 'cli-pipeline', 'google-sources-pipeline-status.md');
    
    // First, get the sources
    let query = supabase
      .from('google_sources')
      .select(`
        id,
        name,
        document_type_id,
        mime_type,
        path_depth,
        updated_at,
        created_at
      `)
      .limit(limit);
      
    // If isNewFile option is set, filter by recent creation date
    if (options.isNewFile) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      query = query.gt('created_at', sevenDaysAgo.toISOString());
    }
    
    // Apply filters if provided
    if (filter) {
      query = query.ilike('name', `%${filter}%`);
    }
    
    // Only include specific file types: .txt, .docx, .pptx, and .pdf
    query = query.or(
      'mime_type.eq.text/plain,mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document,mime_type.eq.application/vnd.openxmlformats-officedocument.presentationml.presentation,mime_type.eq.application/pdf'
    );
    
    // Apply expert filter if provided
    if (options.expert) {
      const { data: expert, error: expertError } = await supabase
        .from('expert_profiles')
        .select('id')
        .eq('expert_name', options.expert)
        .single();
      
      if (expertError) {
        console.error(`Error finding expert with name ${options.expert}: ${expertError.message}`);
        return;
      }
      
      if (expert) {
        const { data: expertSources, error: sourcesError } = await supabase
          .from('google_sources_experts')
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
    
    // Get all expert documents for the sources
    // Process in batches to avoid Request Entity Too Large errors
    const sourceIds = sources.map(s => s.id);
    const batchSize = 50; // Process in smaller batches
    let allExpertDocs: ExpertDocument[] = [];
    
    // Process in batches
    for (let i = 0; i < sourceIds.length; i += batchSize) {
      const batchIds = sourceIds.slice(i, i + batchSize);
      console.log(`Fetching expert documents batch ${i/batchSize + 1} of ${Math.ceil(sourceIds.length/batchSize)}...`);
      
      // Build the query to get all expert documents for these sources
      let expertQuery = supabase
        .from('google_expert_documents')
        .select('id, source_id, document_type_id, raw_content, processed_content, pipeline_status, classification_metadata')
        .in('source_id', batchIds);
      
      // Note: We're not filtering in the database query anymore to ensure we get relationship data
      // We'll filter the results after fetching to show only matching status records in the UI
      
      // Apply isNewFile filter if specified
      if (options.isNewFile) {
        // Use a much wider time window to find recently added files
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        // Instead of filtering expert_documents by created_at, 
        // We'll pass all IDs but display information about when they were created
        // in the sources_google table, which is what we can see in our output
      }
      
      const { data: batchExpertDocs, error: batchError } = await expertQuery;
      
      if (batchError) {
        console.error(`Error fetching expert documents batch ${i/batchSize + 1}: ${batchError.message}`);
        return;
      }
      
      if (batchExpertDocs) {
        allExpertDocs = [...allExpertDocs, ...batchExpertDocs];
      }
    }
    
    console.log(`Fetched ${allExpertDocs.length} expert documents in total.`);
    const expertDocs = allExpertDocs;
    
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
    let report = `# Google Sources and Expert Documents Pipeline Status Report\n\n`;
    report += `This report excludes MP4 videos, M4A audio files, and folders.\n\n`;
    report += `Report generated on: ${new Date().toISOString()}\n\n`;
    report += `Total sources found: ${sources.length}\n\n`;
    
    if (filter) {
      report += `Filter: "${filter}"\n\n`;
    }
    
    if (options.expert) {
      report += `Expert: ${options.expert}\n\n`;
    }
    
    if (options.status) {
      report += `Pipeline Status: ${options.status}\n\n`;
    }
    
    if (options.excludeProcessed) {
      report += `Excluded files with pipeline_status = "processed"\n\n`;
    }
    
    report += `## Sources List\n\n`;
    report += `| Source Name | Document Type | Has Expert Doc | Expert Doc Type | Raw Content Preview | Has JSON | Pipeline Status |\n`;
    report += `|-------------|---------------|----------------|-----------------|---------------------|----------|----------------|\n`;
    
    // Apply the same filtering logic for markdown output as we do for console
    let filteredSourcesForMarkdown = [...sources];
    
    // First, filter out sources without expert documents if needed for filtering
    const needsExpertDocsForMarkdown = options.status || options.excludeProcessed;
    
    if (needsExpertDocsForMarkdown) {
      // Filter out sources that have no expert documents
      filteredSourcesForMarkdown = filteredSourcesForMarkdown.filter(source => 
        (expertDocsMap.get(source.id) || []).length > 0
      );
    }
    
    // Apply status filter if specified
    if (options.status) {
      const statusValue = options.status;
      
      // Filter to only keep sources with expert docs matching the status
      filteredSourcesForMarkdown = filteredSourcesForMarkdown.filter(source => {
        const expertDocsForSource = expertDocsMap.get(source.id) || [];
        return expertDocsForSource.some(doc => doc.pipeline_status === statusValue);
      });
    }
    
    // Apply exclude-processed filter if specified
    if (options.excludeProcessed) {
      // Filter to exclude sources with expert docs that have pipeline_status = "processed"
      filteredSourcesForMarkdown = filteredSourcesForMarkdown.filter(source => {
        const expertDocsForSource = expertDocsMap.get(source.id) || [];
        // Keep only sources where NO expert doc has pipeline_status = "processed"
        return !expertDocsForSource.some(doc => doc.pipeline_status === "processed");
      });
    }
    
    for (const source of filteredSourcesForMarkdown) {
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
            // Convert back to string for preview - shorter preview to avoid markdown table issues
            const jsonStr = JSON.stringify(expertDoc.processed_content);
            processedContentPreview = jsonStr.substring(0, 40);
            if (jsonStr.length > 40) {
              processedContentPreview += '...';
            }
          } else if (typeof expertDoc.processed_content === 'string') {
            try {
              // Try to parse it as JSON if it's a string
              JSON.parse(expertDoc.processed_content);
              hasJson = true;
              processedContentPreview = expertDoc.processed_content.substring(0, 40);
              if (expertDoc.processed_content.length > 40) {
                processedContentPreview += '...';
              }
            } catch (e) {
              // Not valid JSON
              processedContentPreview = expertDoc.processed_content.substring(0, 40);
              if (expertDoc.processed_content.length > 40) {
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
      const safePipelineStatus = expertDoc?.pipeline_status ? expertDoc.pipeline_status.replace(/\|/g, '\\|') : 'N/A';
      
      // Add row to the table
      report += `| ${safeSourceName} | ${safeDocumentType} | ${hasExpertDoc ? 'Yes' : 'No'} | ${safeExpertDocType} | ${safeRawContent} | ${hasJson ? 'Yes' : 'No'} | ${safePipelineStatus} |\n`;
    }
    
    // Add summary information
    const sourcesWithExpertDocs = sourceIds.filter(id => expertDocsMap.has(id)).length;
    const totalExpertDocs = expertDocs?.length || 0;
    
    report += `\n## Summary\n\n`;
    report += `- Total sources: ${sources.length}\n`;
    report += `- Sources after filtering: ${filteredSourcesForMarkdown.length}\n`;
    report += `- Sources with expert documents: ${sourcesWithExpertDocs}\n`;
    report += `- Total expert documents: ${totalExpertDocs}\n`;
    
    // Output the results based on the format option
    if (options.console) {
      // Display results in console table format
      const title = options.isNewFile ? 
        '\nGoogle Drive Sources - Newly Added Files (created within last 7 days):' :
        '\nGoogle Drive Sources and Expert Documents Pipeline Status:';
        
      console.log(title);
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
      
      // Filter sources to only include those with expert documents that match the filters
      let filteredSources = [...sources];
      
      // First, filter out sources without expert documents if needed for filtering
      const needsExpertDocs = options.status || options.excludeProcessed;
      
      if (needsExpertDocs) {
        // Step 1: Filter out sources that have no expert documents
        filteredSources = filteredSources.filter(source => 
          (expertDocsMap.get(source.id) || []).length > 0
        );
      }
      
      // Apply status filter if specified
      if (options.status) {
        const statusValue = options.status;
        
        // Filter to only keep sources with expert docs matching the status
        filteredSources = filteredSources.filter(source => {
          const expertDocsForSource = expertDocsMap.get(source.id) || [];
          return expertDocsForSource.some(doc => doc.pipeline_status === statusValue);
        });
        
        console.log(`\nApplying status filter: pipeline_status = "${statusValue}"`);
        console.log(`Found ${filteredSources.length} sources with expert documents matching this status`);
      }
      
      // Apply exclude-processed filter if specified
      if (options.excludeProcessed) {
        // Filter to exclude sources with expert docs that have pipeline_status = "processed"
        filteredSources = filteredSources.filter(source => {
          const expertDocsForSource = expertDocsMap.get(source.id) || [];
          // Keep only sources where NO expert doc has pipeline_status = "processed"
          return !expertDocsForSource.some(doc => doc.pipeline_status === "processed");
        });
        
        console.log(`\nExcluding sources with pipeline_status = "processed"`);
        console.log(`Found ${filteredSources.length} sources without processed status`);
      }
      
      // Sort sources by document type for console display
      const sortedSources = filteredSources.sort((a, b) => {
        const docTypeA = a.document_type_id ? documentTypeMap.get(a.document_type_id) || 'Unknown' : 'None';
        const docTypeB = b.document_type_id ? documentTypeMap.get(b.document_type_id) || 'Unknown' : 'None';
        return docTypeA.localeCompare(docTypeB);
      });
      
      sortedSources.forEach(source => {
        const sourceName = source.name || 'Unnamed';
        const documentType = source.document_type_id ? documentTypeMap.get(source.document_type_id) || 'Unknown' : 'None';
        
        // Check for expert document
        const expertDocsForSource = expertDocsMap.get(source.id) || [];
        const hasExpertDoc = expertDocsForSource.length > 0;
        const expertDoc = hasExpertDoc ? expertDocsForSource[0] : null;
        
        // Get expert document details
        const expertDocType = expertDoc?.document_type_id ? documentTypeMap.get(expertDoc.document_type_id) || 'Unknown' : 'N/A';
        
        // Preview of raw content (first 18 chars)
        let rawContentPreview = 'None';
        if (expertDoc?.raw_content) {
          rawContentPreview = expertDoc.raw_content.substring(0, 18).replace(/\\n/g, ' ').replace(/\\r/g, '');
          if (expertDoc.raw_content.length > 18) {
            rawContentPreview += '...';
          }
        }
        
        // Check if processed_content is JSON
        let hasJson = false;
        
        if (expertDoc?.processed_content) {
          try {
            // Since it's already parsed from the database, we can check if it's an object
            if (typeof expertDoc.processed_content === 'object') {
              hasJson = true;
            } else if (typeof expertDoc.processed_content === 'string') {
              try {
                // Try to parse it as JSON if it's a string
                JSON.parse(expertDoc.processed_content);
                hasJson = true;
              } catch (e) {
                // Not valid JSON
              }
            }
          } catch (e) {
            // Not valid JSON or error in processing
          }
        }
        
        // Get pipeline status
        let pipelineStatus = 'N/A';
        if (expertDoc?.pipeline_status) {
          pipelineStatus = expertDoc.pipeline_status;
        }
        
        console.log(
          source.id.padEnd(38) + ' | ' +
          sourceName.substring(0, 58).padEnd(60) + ' | ' +
          documentType.substring(0, 23).padEnd(25) + ' | ' +
          expertDocType.substring(0, 23).padEnd(25) + ' | ' +
          (expertDoc?.raw_content ? 'Yes' : 'No').padEnd(7) + ' | ' +
          (hasJson ? 'Yes' : 'No').padEnd(7) + ' | ' +
          pipelineStatus.padEnd(15)
        );
      });
      
      console.log('-'.repeat(180));
      console.log(`Total sources: ${sources.length}`);
      console.log(`Sources after filtering: ${filteredSources.length}`);
      console.log(`Sources with expert documents: ${sourcesWithExpertDocs}`);
      console.log(`Total expert documents: ${totalExpertDocs}`);
    } else {
      // Write the report to the output file
      fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
      fs.writeFileSync(outputFilePath, report);
      
      console.log(`Report generated successfully and saved to: ${outputFilePath}`);
    }
    
    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: sources.length,
        summary: `Listed ${sources.length} Google sources with pipeline status`
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
  updated_at: string | null;
};

type ExpertDocument = {
  id: string;
  source_id: string;
  document_type_id: string | null;
  raw_content: string | null;
  processed_content: any;
  pipeline_status: string | null;
  classification_metadata?: any;
};

// Set up CLI command
const program = new Command();

program
  .name('list-pipeline-status')
  .description('Lists Google Drive sources with their pipeline status (excludes MP4 videos, M4A audio files, and folders)')
  .option('-l, --limit <number>', 'Maximum number of sources to list', '1000')
  .option('-f, --filter <string>', 'Filter sources by name')
  .option('-e, --expert <string>', 'Filter sources by expert name')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('-s, --sort-by <field>', 'Sort results by field (name, updated, type)', 'name')
  .option('-c, --console', 'Display results in console table format instead of generating markdown')
  .option('-p, --status <string>', 'Filter by pipeline status (e.g., "completed", "in_progress", "pending")')
  .option('--exclude-processed', 'Exclude files with pipeline_status = "processed"')
  .option('--isNewFile', 'Show only newly added files where metadata has isNewFile=true')
  .action((options) => {
    listPipelineStatus({
      limit: parseInt(options.limit),
      filter: options.filter,
      expert: options.expert,
      output: options.output,
      sortBy: options.sortBy,
      console: options.console,
      status: options.status,
      excludeProcessed: options.excludeProcessed,
      isNewFile: options.isNewFile
    });
  });

program.parse(process.argv);