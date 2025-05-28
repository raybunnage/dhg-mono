/**
 * Check MP4 Titles Command
 * 
 * Checks MP4 files in sources_google and their corresponding expert_documents records
 * to find those without titles
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

interface CheckMp4TitlesOptions {
  limit?: number;
  expertName?: string;
  verbose?: boolean;
}

/**
 * Main command function to check MP4 files without titles
 */
export async function checkMp4TitlesCommand(options: CheckMp4TitlesOptions = {}): Promise<void> {
  const {
    limit = 500,
    expertName,
    verbose = false
  } = options;

  try {
    Logger.info('Checking MP4 files for missing titles in expert_documents...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First, find MP4 files in sources_google
    Logger.info(`Finding MP4 files in sources_google...`);
    
    // Get MP4 files from sources_google
    let sourceQuery = supabase
      .from('sources_google')
      .select('id, name, mime_type')
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false)
      .limit(limit);
      
    // Filter by expert name if provided
    if (expertName) {
      Logger.info(`Filtering by expert name: ${expertName}`);
      
      // First, get the expert ID for the given name
      const { data: expertData, error: expertError } = await supabase
        .from('expert_profiles')
        .select('id')
        .eq('expert_name', expertName)
        .single();
      
      if (expertError || !expertData) {
        Logger.error(`Expert not found with name: ${expertName}`);
        return;
      }
      
      // Get sources for this expert
      const { data: expertSources, error: sourcesError } = await supabase
        .from('google_sources_experts')
        .select('source_id')
        .eq('expert_id', expertData.id);
      
      if (sourcesError) {
        Logger.error(`Error getting sources for expert: ${sourcesError.message}`);
        return;
      }
      
      const expertSourceIds = expertSources?.map(source => source.source_id) || [];
      if (expertSourceIds.length === 0) {
        Logger.error(`No sources found for expert: ${expertName}`);
        return;
      }
      
      // Add to the query
      sourceQuery = sourceQuery.in('id', expertSourceIds);
    }
    
    // Execute the sources query
    const { data: sources, error: sourcesError } = await sourceQuery;
    
    if (sourcesError) {
      Logger.error(`Error fetching MP4 sources: ${sourcesError.message}`);
      return;
    }
    
    if (!sources || sources.length === 0) {
      Logger.info('No MP4 sources found with matching criteria.');
      return;
    }
    
    Logger.info(`Found ${sources.length} MP4 sources.`);
    
    // Now get the expert_documents for these sources
    const sourceIds = sources.map(source => source.id);
    
    // Create a map of sources for easier lookup
    const sourceMap: Record<string, any> = {};
    sources.forEach(source => {
      sourceMap[source.id] = source;
    });
    
    // Query for expert documents regardless of processed content
    const { data: expertDocs, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_type_id, title, processed_content')
      .in('source_id', sourceIds);
      
    if (docsError) {
      Logger.error(`Error fetching expert documents: ${docsError.message}`);
      return;
    }
    
    Logger.info(`Found ${expertDocs ? expertDocs.length : 0} expert documents for these sources.`);
    
    // Get document types for display
    const { data: documentTypes, error: docTypesError } = await supabase
      .from('document_types')
      .select('id, document_type');
      
    if (docTypesError) {
      Logger.error(`Error fetching document types: ${docTypesError.message}`);
      return;
    }
    
    // Create a map of document types for lookup
    const docTypeMap: Record<string, string> = {};
    if (documentTypes) {
      documentTypes.forEach(dt => {
        docTypeMap[dt.id] = dt.document_type;
      });
    }
    
    // Array to store MP4 files without titles in expert_documents
    const missingTitles: Array<{
      sourceName: string;
      sourceId: string;
      documentType: string;
      contentPreview: string;
      expertDocId: string;
      title: string | null;
    }> = [];
    
    // Track MP4 files without corresponding expert_documents
    const missingExpertDocs: Array<{
      sourceName: string;
      sourceId: string;
    }> = [];
    
    // Process each source
    for (const sourceId of sourceIds) {
      const source = sourceMap[sourceId];
      
      // Find matching expert document
      const matchingDocs = expertDocs?.filter(doc => doc.source_id === sourceId) || [];
      
      if (matchingDocs.length === 0) {
        // No expert document for this source
        missingExpertDocs.push({
          sourceName: source.name,
          sourceId: source.id
        });
        continue;
      }
      
      // Check each matching document for missing title
      for (const doc of matchingDocs) {
        if (!doc.title || doc.title.trim() === '') {
          // Extract a preview of the content if available
          let contentPreview = 'No content available';
          if (doc.processed_content) {
            let content = '';
            if (typeof doc.processed_content === 'string') {
              content = doc.processed_content;
            } else if (doc.processed_content.content) {
              content = typeof doc.processed_content.content === 'string' 
                ? doc.processed_content.content 
                : JSON.stringify(doc.processed_content.content);
            } else if (doc.processed_content.text) {
              content = typeof doc.processed_content.text === 'string'
                ? doc.processed_content.text
                : JSON.stringify(doc.processed_content.text);
            } else {
              content = JSON.stringify(doc.processed_content);
            }
            
            // Limit the preview length
            contentPreview = content.substring(0, 40) + (content.length > 40 ? '...' : '');
          }
          
          missingTitles.push({
            sourceName: source.name,
            sourceId: source.id,
            documentType: docTypeMap[doc.document_type_id] || 'Unknown type',
            contentPreview,
            expertDocId: doc.id,
            title: doc.title
          });
        }
      }
    }
    
    // Print summary
    Logger.info('\n=== SUMMARY ===');
    Logger.info(`Total MP4 files checked: ${sources.length}`);
    Logger.info(`MP4 files without expert_documents: ${missingExpertDocs.length}`);
    Logger.info(`MP4 files with expert_documents but missing titles: ${missingTitles.length}`);
    
    // Print detailed results
    if (missingTitles.length > 0) {
      Logger.info('\n=== MP4 FILES WITH MISSING TITLES ===');
      console.log('| Source Name'.padEnd(52) + '| Document Type'.padEnd(22) + '| Content Preview'.padEnd(32) + '| Title'.padEnd(22) + '|');
      console.log('|' + '-'.repeat(50) + '|' + '-'.repeat(20) + '|' + '-'.repeat(30) + '|' + '-'.repeat(20) + '|');
      
      for (const item of missingTitles) {
        const sourceName = item.sourceName.length > 49 
          ? item.sourceName.substring(0, 46) + '...' 
          : item.sourceName;
        
        const contentPreview = item.contentPreview.length > 29
          ? item.contentPreview.substring(0, 26) + '...'
          : item.contentPreview;
        
        console.log(
          '| ' + sourceName.padEnd(50) + 
          '| ' + item.documentType.padEnd(20) + 
          '| ' + contentPreview.padEnd(30) + 
          '| ' + (item.title || 'null').padEnd(20) + '|'
        );
      }
    }
    
    if (verbose && missingExpertDocs.length > 0) {
      Logger.info('\n=== MP4 FILES WITHOUT EXPERT_DOCUMENTS ===');
      for (const item of missingExpertDocs) {
        console.log(`- ${item.sourceName}`);
      }
    }
    
  } catch (error) {
    Logger.error(`Error in check MP4 titles command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}