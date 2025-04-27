/**
 * Write unclassified sources_google IDs to a markdown file
 * 
 * Extracts the source IDs from list-unclassified results and saves them
 * to a specified markdown file for future reference.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface WriteUnclassifiedIdsOptions {
  outputFile?: string;
  limit?: number;
  fileExtensions?: string[];
  expertName?: string;
  verbose?: boolean;
}

/**
 * Write unclassified sources_google IDs to a markdown file
 */
export async function writeUnclassifiedIdsCommand(options: WriteUnclassifiedIdsOptions): Promise<void> {
  const {
    outputFile = 'docs/cli-pipeline/need_classification.md',
    limit = 0, // 0 means all
    fileExtensions,
    expertName,
    verbose = false
  } = options;

  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    Logger.info('Finding unclassified expert documents...');
    
    // 1. Get the list of entity_ids that have already been classified
    Logger.info('Fetching classified document IDs...');
    const { data: classified, error: classifiedError } = await supabase
      .from('table_classifications')
      .select('entity_id')
      .eq('entity_type', 'expert_documents');
      
    if (classifiedError) {
      Logger.error(`Error fetching classified documents: ${classifiedError.message}`);
      return;
    }
    
    // Get unique entity_ids that have been classified
    const classifiedSet = new Set(classified?.map(item => item.entity_id) || []);
    const classifiedIds = Array.from(classifiedSet);
    Logger.info(`Found ${classifiedIds.length} already classified expert_document IDs.`);
    
    // 2. Find expert_documents that are not in the classified list and have processed content
    Logger.info('Finding unclassified documents with processed content...');
    
    // First get all expert_documents with processed content
    const { data: allDocsWithContent, error: contentError } = await supabase
      .from('expert_documents')
      .select('id')
      .not('processed_content', 'is', null)
      .not('source_id', 'is', null);
      
    if (contentError) {
      Logger.error(`Error fetching documents with content: ${contentError.message}`);
      return;
    }
    
    // Now filter out the ones that are already classified
    const allDocIds = allDocsWithContent?.map(doc => doc.id) || [];
    const unclassifiedIds = allDocIds.filter(id => !classifiedIds.includes(id));
    
    Logger.info(`Found ${allDocIds.length} documents with processed content.`);
    Logger.info(`Found ${unclassifiedIds.length} unclassified documents with processed content.`);
    
    if (unclassifiedIds.length === 0) {
      Logger.info('No unclassified documents found with processed content.');
      return;
    }
    
    // 3. Get details for the unclassified documents with their source_ids
    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    let allUnclassifiedDocs: any[] = [];
    
    // Process up to the limit, or all if no limit is specified
    const maxToProcess = limit > 0 ? Math.min(unclassifiedIds.length, limit) : unclassifiedIds.length;
    
    Logger.info(`Fetching details for ${maxToProcess} unclassified documents (processing in batches of ${BATCH_SIZE})...`);
    
    for (let i = 0; i < Math.min(unclassifiedIds.length, maxToProcess); i += BATCH_SIZE) {
      const idsToFetch = unclassifiedIds.slice(i, Math.min(i + BATCH_SIZE, maxToProcess));
      Logger.info(`Fetching batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(maxToProcess/BATCH_SIZE)}...`);
      
      const { data: batchDocs, error: batchError } = await supabase
        .from('expert_documents')
        .select('id, source_id, title')
        .in('id', idsToFetch);
        
      if (batchError) {
        Logger.error(`Error fetching batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batchError.message}`);
        continue; // Try the next batch
      }
      
      if (batchDocs && batchDocs.length > 0) {
        allUnclassifiedDocs = [...allUnclassifiedDocs, ...batchDocs];
      }
    }
    
    Logger.info(`Successfully fetched ${allUnclassifiedDocs.length} unclassified documents`);
    
    // 4. Get source information for these documents
    const sourceIds = allUnclassifiedDocs.map(doc => doc.source_id).filter(Boolean);
    const uniqueSourceIds = [...new Set(sourceIds)]; // Remove duplicates
    
    Logger.info(`Found ${uniqueSourceIds.length} unique source IDs`);
    
    // Get source details in batches
    let allSources: any[] = [];
    
    for (let i = 0; i < uniqueSourceIds.length; i += BATCH_SIZE) {
      const sourceIdsBatch = uniqueSourceIds.slice(i, i + BATCH_SIZE);
      Logger.info(`Fetching sources batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(uniqueSourceIds.length/BATCH_SIZE)}...`);
      
      const { data: sources, error: sourcesError } = await supabase
        .from('sources_google')
        .select('id, name, mime_type')
        .in('id', sourceIdsBatch);
        
      if (sourcesError) {
        Logger.error(`Error fetching sources batch: ${sourcesError.message}`);
        continue;
      }
      
      if (sources && sources.length > 0) {
        allSources = [...allSources, ...sources];
      }
    }
    
    // Create a lookup map for sources
    const sourcesMap: Record<string, any> = {};
    allSources.forEach(source => {
      sourcesMap[source.id] = source;
    });
    
    // 5. Filter by extensions if provided
    let filteredSources = allSources;
    
    if (fileExtensions && fileExtensions.length > 0) {
      Logger.info(`Filtering by file extensions: ${fileExtensions.join(', ')}`);
      
      const lowerExtensions = fileExtensions.map(ext => 
        (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase()
      );
      
      filteredSources = allSources.filter(source => {
        const filename = source.name || '';
        const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        return lowerExtensions.includes(extension);
      });
      
      Logger.info(`After extension filtering: ${filteredSources.length} sources remaining.`);
    }
    
    // 6. Filter by expert name if provided
    if (expertName) {
      Logger.info(`Filtering by expert name: ${expertName}`);
      
      // Get the expert ID for the given name
      const { data: expertData, error: expertError } = await supabase
        .from('experts')
        .select('id')
        .eq('expert_name', expertName)
        .single();
      
      if (expertError || !expertData) {
        Logger.error(`Expert not found with name: ${expertName}`);
        return;
      }
      
      // Get sources for this expert
      const { data: expertSources, error: sourcesError } = await supabase
        .from('sources_google_experts')
        .select('source_id')
        .eq('expert_id', expertData.id);
      
      if (sourcesError) {
        Logger.error(`Error getting sources for expert: ${sourcesError.message}`);
        return;
      }
      
      const expertSourceIds = expertSources?.map(source => source.source_id) || [];
      
      // Filter sources by the expert source IDs
      filteredSources = filteredSources.filter(source => 
        expertSourceIds.includes(source.id)
      );
      
      Logger.info(`After expert filtering: ${filteredSources.length} sources remaining.`);
    }
    
    // 7. Sort sources by name for better readability
    filteredSources.sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    });
    
    // 8. Write the results to the output file
    // Make sure the directory exists
    const dirPath = path.dirname(outputFile);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // Create markdown content
    let markdown = `# Sources Needing Classification\n\n`;
    markdown += `Generated on ${new Date().toISOString()}\n\n`;
    markdown += `## Source IDs\n\n`;
    markdown += `These source IDs need classification. The recommended approach is:\n\n`;
    markdown += `\`\`\`bash\n`;
    markdown += `# Run for a single source\n`;
    markdown += `./scripts/cli-pipeline/classify/classify-cli.sh classify-source -i SOURCE_ID\n\n`;
    markdown += `# Or run batch classification\n`;
    markdown += `./scripts/cli-pipeline/classify/classify-cli.sh classify-subjects -l 10\n`;
    markdown += `\`\`\`\n\n`;
    
    markdown += `## Source IDs by File Extension\n\n`;
    
    // Group by extension
    const sourcesByExtension: Record<string, any[]> = {};
    
    filteredSources.forEach(source => {
      const filename = source.name || '';
      const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase() || 'unknown';
      
      if (!sourcesByExtension[extension]) {
        sourcesByExtension[extension] = [];
      }
      
      sourcesByExtension[extension].push(source);
    });
    
    // Add sources by extension
    Object.entries(sourcesByExtension).forEach(([extension, sources]) => {
      markdown += `### ${extension} Files (${sources.length})\n\n`;
      markdown += `\`\`\`\n`;
      
      sources.forEach(source => {
        markdown += `${source.id} # ${source.name}\n`;
      });
      
      markdown += `\`\`\`\n\n`;
    });
    
    // Also add all sources in a single list
    markdown += `## All Sources (${filteredSources.length})\n\n`;
    markdown += `\`\`\`\n`;
    
    filteredSources.forEach(source => {
      markdown += `${source.id} # ${source.name}\n`;
    });
    
    markdown += `\`\`\`\n`;
    
    // Write the file
    fs.writeFileSync(outputFile, markdown);
    
    Logger.info(`Successfully wrote ${filteredSources.length} source IDs to ${outputFile}`);
    
  } catch (error) {
    Logger.error(`Error writing unclassified IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}