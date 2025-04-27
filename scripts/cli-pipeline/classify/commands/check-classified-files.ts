/**
 * Check Classified Files Command
 * 
 * Examines the sources listed in the need_classification.md file and checks if they
 * already have classifications in the database.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface CheckClassifiedFilesOptions {
  inputFile?: string;
  outputFile?: string;
  verbose?: boolean;
}

/**
 * Parse source IDs from the need_classification.md file
 */
function parseSourceIdsFromFile(filePath: string): string[] {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const sourceIds: string[] = [];
    
    // Extract source IDs using regex
    // Looking for UUID pattern at start of lines followed by # and a filename
    const regex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\s+#\s+(.+))?/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      sourceIds.push(match[1]);
    }
    
    return sourceIds;
  } catch (error) {
    Logger.error(`Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

/**
 * Check for classifications of specific source IDs
 */
export async function checkClassifiedFilesCommand(options: CheckClassifiedFilesOptions): Promise<void> {
  const {
    inputFile = 'docs/cli-pipeline/need_classification.md',
    outputFile,
    verbose = false
  } = options;

  try {
    Logger.info(`Analyzing sources in ${inputFile} for existing classifications...`);
    
    // 1. Parse source IDs from the file
    const sourceIds = parseSourceIdsFromFile(inputFile);
    
    if (sourceIds.length === 0) {
      Logger.error('No source IDs found in the input file.');
      return;
    }
    
    Logger.info(`Found ${sourceIds.length} source IDs in ${inputFile}`);
    
    // 2. Get files from sources_google for better display
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Process in batches to avoid query size limitations
    const BATCH_SIZE = 100;
    let sourcesInfo: Record<string, {name: string, mime_type: string}> = {};
    
    Logger.info('Fetching details for sources (processing in batches)...');
    
    for (let i = 0; i < sourceIds.length; i += BATCH_SIZE) {
      const batchIds = sourceIds.slice(i, i + BATCH_SIZE);
      
      const { data: sources, error: sourcesError } = await supabase
        .from('sources_google')
        .select('id, name, mime_type')
        .in('id', batchIds);
        
      if (sourcesError) {
        Logger.error(`Error fetching sources batch ${Math.floor(i/BATCH_SIZE) + 1}: ${sourcesError.message}`);
        continue;
      }
      
      if (sources) {
        sources.forEach(source => {
          sourcesInfo[source.id] = {
            name: source.name,
            mime_type: source.mime_type
          };
        });
      }
    }
    
    Logger.info(`Retrieved information for ${Object.keys(sourcesInfo).length} sources`);
    
    // 3. Check for existing classifications for these source IDs in both tables
    Logger.info('Checking for existing classifications in table_classifications...');
    
    // Track progress for long-running operations
    let progress = 0;
    let alreadyClassifiedCount = 0;
    const alreadyClassifiedSources: {id: string, entity_type: string, name: string}[] = [];
    
    // Process in batches
    for (let i = 0; i < sourceIds.length; i += BATCH_SIZE) {
      const batchIds = sourceIds.slice(i, i + BATCH_SIZE);
      progress += batchIds.length;
      
      if (i % (BATCH_SIZE * 5) === 0) {
        Logger.info(`Checking classifications - progress: ${progress}/${sourceIds.length}`);
      }
      
      // First check sources_google classifications
      const { data: sourceClassifications, error: sourceClassError } = await supabase
        .from('table_classifications')
        .select('entity_id, entity_type')
        .eq('entity_type', 'sources_google')
        .in('entity_id', batchIds);
        
      if (sourceClassError) {
        Logger.error(`Error checking source classifications batch ${Math.floor(i/BATCH_SIZE) + 1}: ${sourceClassError.message}`);
        continue;
      }
      
      // Next check expert_documents classifications by getting expert docs for these sources
      const { data: expertDocs, error: docsError } = await supabase
        .from('expert_documents')
        .select('id, source_id')
        .in('source_id', batchIds);
        
      if (docsError) {
        Logger.error(`Error fetching expert documents batch ${Math.floor(i/BATCH_SIZE) + 1}: ${docsError.message}`);
        continue;
      }
      
      // Get the doc IDs to check
      const docIds = (expertDocs || []).map(doc => doc.id);
      
      // Skip the classification check if there are no docs
      if (docIds.length === 0) {
        continue;
      }
      
      // Check for classifications of these expert docs
      const { data: docClassifications, error: docClassError } = await supabase
        .from('table_classifications')
        .select('entity_id, entity_type')
        .eq('entity_type', 'expert_documents')
        .in('entity_id', docIds);
        
      if (docClassError) {
        Logger.error(`Error checking document classifications batch ${Math.floor(i/BATCH_SIZE) + 1}: ${docClassError.message}`);
        continue;
      }
      
      // Combine the results and track classified sources
      const sourceClassIds = new Set(sourceClassifications?.map(c => c.entity_id) || []);
      
      // Create a map of doc ID to source ID for lookups
      const docToSource: Record<string, string> = {};
      expertDocs?.forEach(doc => {
        docToSource[doc.id] = doc.source_id;
      });
      
      // Track the sources that are already classified (either directly or via expert doc)
      for (const sourceId of batchIds) {
        if (sourceClassIds.has(sourceId)) {
          // Source is directly classified
          alreadyClassifiedCount++;
          alreadyClassifiedSources.push({
            id: sourceId,
            entity_type: 'sources_google',
            name: sourcesInfo[sourceId]?.name || 'Unknown'
          });
        } else {
          // Check if any expert doc for this source is classified
          const docsForSource = expertDocs?.filter(doc => doc.source_id === sourceId) || [];
          const docIds = docsForSource.map(doc => doc.id);
          
          const classifiedDocIds = docClassifications?.filter(c => docIds.includes(c.entity_id)).map(c => c.entity_id) || [];
          
          if (classifiedDocIds.length > 0) {
            alreadyClassifiedCount++;
            alreadyClassifiedSources.push({
              id: sourceId,
              entity_type: 'expert_documents',
              name: sourcesInfo[sourceId]?.name || 'Unknown'
            });
          }
        }
      }
    }
    
    Logger.info(`Analysis complete. Found ${alreadyClassifiedCount} sources that are already classified.`);
    
    if (alreadyClassifiedSources.length > 0) {
      Logger.info(`The following sources in ${inputFile} already have classifications:`);
      
      // Group by entity_type for better display
      const byEntityType: Record<string, {id: string, name: string}[]> = {};
      
      alreadyClassifiedSources.forEach(source => {
        if (!byEntityType[source.entity_type]) {
          byEntityType[source.entity_type] = [];
        }
        byEntityType[source.entity_type].push({
          id: source.id,
          name: source.name
        });
      });
      
      for (const [entityType, sources] of Object.entries(byEntityType)) {
        Logger.info(`\nClassified in ${entityType} (${sources.length} sources):`);
        
        sources.slice(0, 20).forEach(source => {
          Logger.info(`- ${source.id} # ${source.name}`);
        });
        
        if (sources.length > 20) {
          Logger.info(`... and ${sources.length - 20} more`);
        }
      }
      
      // Write the results to a file for inspection
      const outputPath = outputFile || path.join(path.dirname(inputFile), 'already_classified.md');
      
      let markdown = `# Already Classified Sources\n\n`;
      markdown += `These sources appear in \`${inputFile}\` but already have classifications in the database.\n\n`;
      
      for (const [entityType, sources] of Object.entries(byEntityType)) {
        markdown += `## Classified in ${entityType} (${sources.length} sources)\n\n`;
        markdown += `\`\`\`\n`;
        
        sources.forEach(source => {
          markdown += `${source.id} # ${source.name}\n`;
        });
        
        markdown += `\`\`\`\n\n`;
      }
      
      fs.writeFileSync(outputPath, markdown);
      Logger.info(`\nDetailed results written to: ${outputPath}`);
    } else {
      Logger.info('No classified sources found in the input file. All entries need classification.');
    }
  } catch (error) {
    Logger.error(`Error checking classified files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}