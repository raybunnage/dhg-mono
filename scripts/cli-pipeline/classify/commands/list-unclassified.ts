/**
 * List Unclassified Documents Command
 * 
 * Lists expert_documents with processed content that still need classification
 * by finding documents whose IDs are not in the table_classifications table.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

interface ListUnclassifiedOptions {
  limit?: number;
  withContent?: boolean;
  verbose?: boolean;
}

/**
 * Lists expert documents that haven't been classified yet
 */
export async function listUnclassifiedCommand(options: ListUnclassifiedOptions): Promise<void> {
  const {
    limit = 100, 
    withContent = true,
    verbose = false
  } = options;

  try {
    Logger.info('Finding unclassified expert documents...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
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
    
    // Get unique entity_ids
    const classifiedIds = [...new Set(classified?.map(item => item.entity_id) || [])];
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
    
    // 3. Get details for the unclassified documents
    const fetchLimit = Math.min(unclassifiedIds.length, limit);
    const idsToFetch = unclassifiedIds.slice(0, fetchLimit);
    
    Logger.info(`Fetching details for ${fetchLimit} unclassified documents...`);
    const { data: unclassifiedDocs, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, title')
      .in('id', idsToFetch);
      
    if (docsError) {
      Logger.error(`Error fetching document details: ${docsError.message}`);
      return;
    }
    
    if (!unclassifiedDocs || unclassifiedDocs.length === 0) {
      Logger.info('No unclassified documents found with the given criteria.');
      return;
    }
    
    // 4. Get source information for these documents
    const sourceIds = unclassifiedDocs.map(doc => doc.source_id).filter(id => id);
    
    Logger.info(`Fetching source information for ${sourceIds.length} documents...`);
    const { data: sources, error: sourcesError } = await supabase
      .from('sources_google')
      .select('id, name, mime_type')
      .in('id', sourceIds);
      
    if (sourcesError) {
      Logger.error(`Error fetching sources: ${sourcesError.message}`);
      return;
    }
    
    // Create a map of source info by ID
    const sourceMap: Record<string, any> = {};
    sources?.forEach(source => {
      sourceMap[source.id] = source;
    });
    
    // 5. Display the results in a table format
    console.log('\nUnclassified Documents with Processed Content:');
    console.log('=================================================');
    console.log(`${'ID'.padEnd(10)} | ${'Source Name'.padEnd(60)} | ${'MIME Type'.padEnd(40)} | ${'Title'.padEnd(30)}`);
    console.log(`${'-'.repeat(10)} | ${'-'.repeat(60)} | ${'-'.repeat(40)} | ${'-'.repeat(30)}`);
    
    for (const doc of unclassifiedDocs) {
      const source = sourceMap[doc.source_id];
      const docId = doc.id.substring(0, 8);
      const sourceName = source?.name || 'Unknown';
      const mimeType = source?.mime_type || 'Unknown';
      const title = doc.title || 'No title';
      
      console.log(`${docId.padEnd(10)} | ${sourceName.substring(0, 60).padEnd(60)} | ${mimeType.padEnd(40)} | ${title.substring(0, 30).padEnd(30)}`);
      
      // If verbose mode, also display processed content
      if (verbose && withContent) {
        // We need to fetch the processed content
        const { data: docWithContent, error: docError } = await supabase
          .from('expert_documents')
          .select('processed_content')
          .eq('id', doc.id)
          .single();
          
        if (!docError && docWithContent) {
          let content;
          if (typeof docWithContent.processed_content === 'string') {
            content = docWithContent.processed_content;
          } else if (docWithContent.processed_content?.content) {
            content = typeof docWithContent.processed_content.content === 'string'
              ? docWithContent.processed_content.content
              : JSON.stringify(docWithContent.processed_content.content);
          } else if (docWithContent.processed_content?.text) {
            content = typeof docWithContent.processed_content.text === 'string'
              ? docWithContent.processed_content.text
              : JSON.stringify(docWithContent.processed_content.text);
          } else {
            content = JSON.stringify(docWithContent.processed_content);
          }
          
          const truncatedContent = content.substring(0, 300) + (content.length > 300 ? '...' : '');
          console.log(`\nContent Preview: ${truncatedContent}\n`);
          console.log('-'.repeat(140));
        }
      }
    }
    
    Logger.info(`Displayed ${unclassifiedDocs.length} unclassified documents.`);
    
  } catch (error) {
    Logger.error(`Error in list-unclassified command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}