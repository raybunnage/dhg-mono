/**
 * Write unclassified sources_google IDs to a markdown file
 * 
 * Extracts the source IDs from sources_google that need classification,
 * excluding already classified files and unsupported document types by default.
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
  includeUnsupported?: boolean;
}

// List of unsupported document type IDs
const UNSUPPORTED_DOCUMENT_TYPE_IDS = [
  '6ece37e7-840d-4a0c-864d-9f1f971b1d7e', // m4a audio
  'e9d3e473-5315-4837-9f5f-61f150cbd137', // Code Documentation Markdown
  '4edfb133-ffeb-4b9c-bfd4-79ee9a9d73af', // mp3 audio
  'd2206940-e4f3-476e-9245-0e1eb12fd195', // aac audio
  '8ce8fbbc-b397-4061-a80f-81402515503b', // m3u file
  'fe697fc5-933c-41c9-9b11-85e0defa86ed', // wav audio
  'db6518ad-765c-4a02-a684-9c2e49d77cf5', // png image
  '68b95822-2746-4ce1-ad35-34e5b0297177', // jpg image
  '3e7c880c-d821-4d01-8cc5-3547bdd2e347', // video mpeg
  'd70a258e-262b-4bb3-95e3-f826ee9b918b', // video quicktime
  '91fa92a3-d606-493b-832d-9ba1fa83dc9f', // video microsoft avi
  '28ab55b9-b408-486f-b1c3-8f0f0a174ad4', // m4v
  '2c1d3bdc-b429-4194-bec2-7e4bbb165dbf', // conf file
  '53f42e7d-78bd-4bde-8106-dc12a4835695', // Document Processing Script
  '4fdbd8be-fe5a-4341-934d-2b6bd43be7be', // CI CD Pipeline Script
  'a1dddf8e-1264-4ec0-a5af-52eafb536ee3', // Deployment Script
  '561a86b0-7064-4c20-a40e-2ec6905c4a42', // Database Management Script
  'f7e83857-8bb8-4b18-9d8f-16d5cb783650', // Environment Setup Script
  'b26a68ed-a0d1-415d-8271-cba875bfe3ce', // xlsx document
  '920893fc-f0be-4211-85b4-fc29882ade97', // google sheet
  'e29b5194-7ba0-4a3c-a7db-92b0d8adca6a', // Unknown Type
  '9dbe32ff-5e82-4586-be63-1445e5bcc548', // unknown document type
];

// List of unsupported MIME types
const UNSUPPORTED_MIME_TYPES = [
  'application/vnd.google-apps.audio',
  'application/vnd.google-apps.video',
  'application/vnd.google-apps.drawing',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.map',
  'application/vnd.google-apps.presentation',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml'
];

/**
 * Write unclassified sources_google IDs to a markdown file
 */
export async function writeUnclassifiedIdsCommand(options: WriteUnclassifiedIdsOptions): Promise<void> {
  const {
    outputFile = 'docs/cli-pipeline/need_classification.md',
    limit = 0, // 0 means all
    fileExtensions,
    expertName,
    verbose = false,
    includeUnsupported = false
  } = options;

  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    Logger.info('Fetching already classified files...');
    
    // 1. Get a list of file_name values from document_classifications_view
    // These are files that have already been classified
    const { data: classifiedFiles, error: classifiedError } = await supabase
      .from('document_classifications_view')
      .select('file_name');
      
    if (classifiedError) {
      Logger.error(`Error fetching classified files: ${classifiedError.message}`);
      return;
    }
    
    // Create a set of already classified filenames for quick lookup
    const classifiedFilenamesSet = new Set(classifiedFiles?.map(row => row.file_name) || []);
    Logger.info(`Found ${classifiedFilenamesSet.size} already classified files.`);
    
    // 2. Fetch all sources from sources_google
    Logger.info('Fetching sources_google records...');
    
    // Set up our query
    let query = supabase
      .from('sources_google')
      .select('id, name, mime_type, document_type_id');
    
    // Filter out unsupported document types and MIME types if not explicitly included
    if (!includeUnsupported) {
      query = query
        .not('document_type_id', 'in', `(${UNSUPPORTED_DOCUMENT_TYPE_IDS.join(',')})`)
        .not('mime_type', 'in', `(${UNSUPPORTED_MIME_TYPES.map(type => `'${type}'`).join(',')})`);
    }
    
    // Apply limit if specified
    if (limit > 0) {
      query = query.limit(limit);
    }
    
    const { data: allSources, error: sourcesError } = await query;
    
    if (sourcesError) {
      Logger.error(`Error fetching sources: ${sourcesError.message}`);
      return;
    }
    
    Logger.info(`Found ${allSources?.length || 0} sources.`);
    
    // 3. Filter out sources where filename matches an already classified file
    const unclassifiedSources = allSources?.filter(source => 
      !classifiedFilenamesSet.has(source.name)
    ) || [];
    
    Logger.info(`Found ${unclassifiedSources.length} sources that need classification.`);
    
    // 4. Filter by extensions if provided
    let filteredSources = unclassifiedSources;
    
    if (fileExtensions && fileExtensions.length > 0) {
      Logger.info(`Filtering by file extensions: ${fileExtensions.join(', ')}`);
      
      const lowerExtensions = fileExtensions.map(ext => 
        (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase()
      );
      
      filteredSources = unclassifiedSources.filter(source => {
        const filename = source.name || '';
        if (!filename.includes('.')) return false;
        const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        return lowerExtensions.includes(extension);
      });
      
      Logger.info(`After extension filtering: ${filteredSources.length} sources remaining.`);
    }
    
    // 5. Filter by expert name if provided
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
    
    // 6. Sort sources by name for better readability
    filteredSources.sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    });
    
    // 7. Limit results to requested amount if needed
    if (limit > 0 && filteredSources.length > limit) {
      filteredSources = filteredSources.slice(0, limit);
      Logger.info(`Limited to ${limit} sources as requested.`);
    }
    
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
      const extension = filename.includes('.') 
        ? filename.substring(filename.lastIndexOf('.')).toLowerCase() 
        : 'unknown';
      
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