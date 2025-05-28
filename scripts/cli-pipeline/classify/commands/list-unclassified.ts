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
      .eq('entity_type', 'google_expert_documents');
      
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
      .from('google_expert_documents')
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
    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    let allUnclassifiedDocs: any[] = [];
    
    // Process up to the limit, or all if no limit is specified
    const maxToProcess = limit > 0 ? Math.min(unclassifiedIds.length, limit) : unclassifiedIds.length;
    
    Logger.info(`Fetching details for ${maxToProcess} unclassified documents (processing in batches of ${BATCH_SIZE})...`);
    
    for (let i = 0; i < maxToProcess; i += BATCH_SIZE) {
      const idsToFetch = unclassifiedIds.slice(i, i + BATCH_SIZE);
      Logger.info(`Fetching batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(maxToProcess/BATCH_SIZE)}...`);
      
      const { data: batchDocs, error: batchError } = await supabase
        .from('google_expert_documents')
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
    
    const unclassifiedDocs = allUnclassifiedDocs;
    
    if (!unclassifiedDocs || unclassifiedDocs.length === 0) {
      Logger.info('No unclassified documents found with the given criteria.');
      return;
    }
    
    // 4. Get source information for these documents in batches
    const sourceIds = unclassifiedDocs.map(doc => doc.source_id).filter(id => id);
    const sourceMap: Record<string, any> = {};
    
    // Process in batches to avoid query size limits
    const SOURCES_BATCH_SIZE = 30;
    Logger.info(`Fetching source information for ${sourceIds.length} documents in batches of ${SOURCES_BATCH_SIZE}...`);
    
    for (let i = 0; i < sourceIds.length; i += SOURCES_BATCH_SIZE) {
      const batchIds = sourceIds.slice(i, i + SOURCES_BATCH_SIZE);
      Logger.info(`Fetching sources batch ${Math.floor(i/SOURCES_BATCH_SIZE) + 1} of ${Math.ceil(sourceIds.length/SOURCES_BATCH_SIZE)}...`);
      
      const { data: sources, error: sourcesError } = await supabase
        .from('google_sources')
        .select('id, name, mime_type')
        .in('id', batchIds);
        
      if (sourcesError) {
        Logger.error(`Error fetching sources batch ${Math.floor(i/SOURCES_BATCH_SIZE) + 1}: ${sourcesError.message}`);
        continue; // Try the next batch
      }
      
      // Add to our source map
      sources?.forEach(source => {
        sourceMap[source.id] = source;
      });
    }
    
    // 5. Display the results in a table format
    console.log('\nUnclassified Documents with Processed Content:');
    console.log('=================================================');
    console.log(`${'Source ID'.padEnd(40)} | ${'Source Name'.padEnd(90)} | ${'Title'.padEnd(50)}`);
    console.log(`${'-'.repeat(40)} | ${'-'.repeat(90)} | ${'-'.repeat(50)}`);
    
    for (const doc of unclassifiedDocs) {
      const source = sourceMap[doc.source_id];
      const sourceId = doc.source_id || 'Unknown ID';
      const sourceName = source?.name || 'Unknown';
      const title = doc.title || 'No title';
      
      console.log(`${sourceId.substring(0, 40).padEnd(40)} | ${sourceName.substring(0, 90).padEnd(90)} | ${title.substring(0, 50).padEnd(50)}`);
      
      // If verbose mode, also display processed content
      if (verbose && withContent) {
        // We need to fetch the processed content
        const { data: docWithContent, error: docError } = await supabase
          .from('google_expert_documents')
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