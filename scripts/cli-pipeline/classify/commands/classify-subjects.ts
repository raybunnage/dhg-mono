/**
 * Subject Classification Command
 * 
 * Applies the subject-classification-prompt to expert documents with processed content
 * and categorizes them based on their content.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { promptService } from '../../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ClassifySubjectsOptions {
  limit?: number;
  fileExtensions?: string[];
  expertName?: string;
  verbose?: boolean;
  dryRun?: boolean;
  skipClassified?: boolean;
  entityType?: string;
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface SubjectClassificationResult {
  title: string;
  subject_ids: string[];
}

interface SourceGoogle {
  id: string;
  name: string;
  mime_type: string;
}

interface ExpertDocument {
  id: string;
  source_id: string;
  processed_content?: any;
  title?: string | null;
  sources_google: SourceGoogle[] | SourceGoogle | null;
}

// Result of processing a document
interface DocumentProcessResult {
  documentId: string;
  success: boolean;
  title?: string;
  subjectIds?: string[];
  error?: string;
}

/**
 * Classify subjects for expert documents with processed content
 */
/**
 * Process a batch of items with concurrency control
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processItem: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const runningPromises: Promise<void>[] = [];
  const itemsToProcess = [...items]; // Create a copy of the items array
  
  // Process items concurrently but limited to the concurrency setting
  while (itemsToProcess.length > 0 || runningPromises.length > 0) {
    // Fill up to concurrency limit
    while (runningPromises.length < concurrency && itemsToProcess.length > 0) {
      const item = itemsToProcess.shift()!;
      const promise = (async () => {
        const result = await processItem(item);
        results.push(result);
      })();
      runningPromises.push(promise);
    }
    
    // Wait for at least one promise to complete
    if (runningPromises.length > 0) {
      await Promise.race(runningPromises.map(p => p.catch(e => e)));
      // Check which promises are still pending - uses a different approach
      // since Promise.isPending is not standard
      const pendingPromises: Promise<void>[] = [];
      for (const promise of runningPromises) {
        // Create a flag to track if this promise is still pending
        let isResolved = false;
        
        // Set up a race between the promise and a flag-setter
        // This will only set the flag if the promise is already resolved
        await Promise.race([
          promise.then(() => { isResolved = true; }, () => { isResolved = true; }),
          Promise.resolve()
        ]);
        
        if (!isResolved) {
          pendingPromises.push(promise);
        }
      }
      
      // Replace the list with only pending promises
      runningPromises.length = 0;
      runningPromises.push(...pendingPromises);
    }
  }
  
  return results;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single document for classification
 */
async function processDocument(
  doc: ExpertDocument, 
  systemPrompt: string, 
  options: {
    entityType: string;
    dryRun: boolean;
    verbose: boolean;
    maxRetries: number;
    retryDelayMs: number;
  }
): Promise<DocumentProcessResult> {
  const { entityType, dryRun, verbose, maxRetries, retryDelayMs } = options;
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    if (!doc.processed_content) {
      return {
        documentId: doc.id,
        success: false,
        error: 'Document has no processed content'
      };
    }
    
    // Handle sources_google which could be an array or object
    const sourceInfo = Array.isArray(doc.sources_google) 
      ? (doc.sources_google.length > 0 ? doc.sources_google[0] : null)
      : doc.sources_google;
    
    const documentFileName = sourceInfo?.name || 'Unknown file';
    const mimeType = sourceInfo?.mime_type || 'Unknown type';
    
    Logger.info(`Processing document: ${documentFileName} (${mimeType})`);
    
    // Extract content from processed_content
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
      // Just stringify the whole object as a fallback
      content = JSON.stringify(doc.processed_content);
    }
    
    // Limit content length for processing
    const MAX_CONTENT_LENGTH = 16000;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH);
    }
    
    // Set up Claude service call
    const userMessage = `Please classify the following content:\n\n${content}`;
    
    if (verbose) {
      Logger.info(`Content length: ${content.length} characters`);
    }
    
    // Skip actual classification in dry run mode
    if (dryRun) {
      Logger.info(`[DRY RUN] Would classify document: ${doc.id}`);
      Logger.info(`Document source: ${documentFileName}`);
      Logger.info(`MIME type: ${mimeType}`);
      return {
        documentId: doc.id,
        success: true,
        title: 'DRY RUN - No title generated',
        subjectIds: ['dry-run-id-1', 'dry-run-id-2']
      };
    }
    
    // Classify the content using Claude with retry logic
    Logger.info(`Sending content to Claude for classification...`);
    
    let attempts = 0;
    let lastError: any = null;
    let classificationResult: SubjectClassificationResult | null = null;
    
    while (attempts < maxRetries) {
      attempts++;
      try {
        // We need to modify the prompt to include system instructions
        const combinedPrompt = `${systemPrompt}\n\n${userMessage}`;
        
        // Use Claude service (singleton pattern)
        const response = await claudeService.sendPrompt(combinedPrompt);
        
        // Parse the JSON response, handling potential markdown formatting
        let jsonStr = response;
        
        // Check if the response is wrapped in markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonStr = jsonMatch[1];
        }
        
        try {
          // Try to parse the JSON directly
          classificationResult = JSON.parse(jsonStr) as SubjectClassificationResult;
        } catch (jsonError) {
          // If that fails, try additional cleanup for better JSON handling
          
          // Some responses might have additional markdown formatting
          // Try stripping any remaining markdown artifacts
          const cleanedJsonStr = jsonStr
            .replace(/^```json\s*/, '') // Remove opening ```json
            .replace(/```\s*$/, '')     // Remove closing ```
            .replace(/^```\s*/, '')     // Remove any opening ``` without language
            .trim();
            
          // Try parsing again with the cleaned string
          classificationResult = JSON.parse(cleanedJsonStr) as SubjectClassificationResult;
        }
        
        if (!classificationResult || !classificationResult.subject_ids) {
          throw new Error(`Failed to get valid classification result for document ${doc.id}`);
        }
        
        // Successfully got classification, break the retry loop
        break;
      } catch (error) {
        lastError = error;
        Logger.warn(`Attempt ${attempts}/${maxRetries} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (attempts < maxRetries) {
          // Exponential backoff
          const backoffTime = retryDelayMs * Math.pow(2, attempts - 1);
          Logger.info(`Retrying in ${backoffTime}ms...`);
          await sleep(backoffTime);
        }
      }
    }
    
    // If we've exhausted all retries and still failed
    if (!classificationResult) {
      return {
        documentId: doc.id,
        success: false,
        error: `Failed after ${maxRetries} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
      };
    }
    
    Logger.info(`Classification successful: "${classificationResult.title}"`);
    Logger.info(`Subject IDs: ${classificationResult.subject_ids.join(', ')}`);
    
    // IMPORTANT: First check if this document already has ANY classifications
    // This is critical because our list of classified IDs may be stale - other processes might have classified this doc
    
    // Look up the source_id from expert_documents
    const sourceId = doc.source_id;
    
    if (!sourceId) {
      Logger.error(`Document ${doc.id} has no source_id, cannot verify source classifications`);
      return {
        documentId: doc.id,
        success: false,
        error: `Document has no source_id, cannot verify source classifications`
      };
    }
    
    // Get the filename from sources_google for better logging
    const { data: sourceData, error: sourceError } = await supabase
      .from('sources_google')
      .select('name')
      .eq('id', sourceId)
      .single();
      
    const sourceFileName = sourceData?.name || 'Unknown file';
    
    // First check if this specific document has classifications
    const { data: anyExistingClassifications, error: checkAnyError } = await supabase
      .from('table_classifications')
      .select('id')
      .eq('entity_id', doc.id)
      .eq('entity_type', entityType)
      .limit(1);
      
    if (checkAnyError) {
      Logger.error(`Error checking existing classifications for document: ${checkAnyError.message}`);
      return {
        documentId: doc.id,
        success: false,
        error: `Error checking existing classifications: ${checkAnyError.message}`
      };
    }
    
    // Next check if the SOURCE file has any classifications
    const { data: sourceClassifications, error: sourceClassError } = await supabase
      .from('table_classifications')
      .select('id')
      .eq('entity_id', sourceId)
      .eq('entity_type', 'sources_google')
      .limit(1);
      
    if (sourceClassError) {
      Logger.error(`Error checking source classifications: ${sourceClassError.message}`);
      return {
        documentId: doc.id,
        success: false,
        error: `Error checking source classifications: ${sourceClassError.message}`
      };
    }
    
    // If this document or its source already has ANY classifications at all, skip it completely
    if ((anyExistingClassifications && anyExistingClassifications.length > 0) || 
        (sourceClassifications && sourceClassifications.length > 0)) {
      Logger.info(`Document or source ${sourceFileName} (${doc.id}) already has classifications - skipping completely.`);
      return {
        documentId: doc.id,
        success: true,
        title: 'Already classified',
        subjectIds: []
      };
    }
    
    Logger.info(`Document and source have no existing classifications: ${sourceFileName} (${doc.id})`);
    
    
    // This document has no classifications yet - add all the new ones
    let insertedCount = 0;
    
    // First classify the expert_document
    for (const subjectId of classificationResult.subject_ids) {
      // Create a record in the table_classifications table
      const { error: insertError } = await supabase
        .from('table_classifications')
        .insert({
          id: uuidv4(),
          entity_id: doc.id,
          entity_type: entityType,
          subject_classification_id: subjectId,
          notes: `Automatically classified with title: ${classificationResult.title}`
        });
      
      if (insertError) {
        Logger.error(`Error storing classification for document: ${insertError.message}`);
      } else {
        insertedCount++;
      }
    }
    
    // Then also classify the source file in sources_google
    // This ensures we don't try to reclassify the same file multiple times
    for (const subjectId of classificationResult.subject_ids) {
      // Create a record in the table_classifications table
      const { error: insertSourceError } = await supabase
        .from('table_classifications')
        .insert({
          id: uuidv4(),
          entity_id: sourceId,
          entity_type: 'sources_google',
          subject_classification_id: subjectId,
          notes: `Automatically classified with title: ${classificationResult.title} (from document ${doc.id})`
        });
      
      if (insertSourceError) {
        Logger.error(`Error storing classification for source: ${insertSourceError.message}`);
      } else {
        // Don't count these in insertedCount since they're just backup classifications
      }
    }
    
    // Log summary of inserted classifications
    if (insertedCount > 0) {
      Logger.info(`Added ${insertedCount} new classifications for document: ${doc.id}`);
    } else {
      Logger.info(`No classifications added for document: ${doc.id}`);
    }
    
    return {
      documentId: doc.id,
      success: true,
      title: classificationResult.title,
      subjectIds: classificationResult.subject_ids
    };
  } catch (error) {
    Logger.error(`Error processing document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      documentId: doc.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper function to process documents with their content
 */
async function processDocsWithContent(
  expertDocs: any[],
  entityType: string,
  limit: number,
  verbose: boolean,
  dryRun: boolean,
  fileExtensions?: string[],
  expertName?: string,
  concurrency: number = 3,
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Now we need to verify which ones have processed_content (we didn't fetch it earlier to save bandwidth)
  if (expertDocs.length > 0) {
    // Get details for these specific documents with processed_content
    // Process in smaller batches to avoid "fetch failed" errors with large IN clauses
    const BATCH_SIZE = 50;
    let allDocsWithContent: any[] = [];
    
    // Process documents in batches
    for (let i = 0; i < Math.min(expertDocs.length, limit * 3); i += BATCH_SIZE) {
      const batchIds = expertDocs.map(doc => doc.id).slice(i, i + BATCH_SIZE);
      Logger.info(`Fetching batch ${i/BATCH_SIZE + 1} of documents with content (${batchIds.length} docs)...`);
      
      try {
        const { data: batchDocsWithContent, error: contentError } = await supabase
          .from(entityType)
          .select('id, source_id, processed_content, title')
          .in('id', batchIds)
          .not('processed_content', 'is', null);
        
        if (contentError) {
          Logger.error(`Error fetching batch of documents with content: ${contentError.message}`);
          continue; // Try the next batch instead of failing completely
        }
        
        if (batchDocsWithContent && batchDocsWithContent.length > 0) {
          allDocsWithContent = [...allDocsWithContent, ...batchDocsWithContent];
        }
        
        // If we've collected enough documents, we can stop
        if (allDocsWithContent.length >= limit) {
          break;
        }
      } catch (error) {
        Logger.error(`Exception fetching documents batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    expertDocs = allDocsWithContent;
    Logger.info(`After checking for processed content: ${expertDocs.length} documents with content`);
  }
  
  // Now apply the limit - after we've filtered out already classified docs
  // This ensures we get the requested number of unclassified docs
  if (expertDocs.length > limit) {
    Logger.info(`Found ${expertDocs.length} documents, limiting to ${limit} for processing`);
    expertDocs = expertDocs.slice(0, limit);
  }
  
  Logger.info(`Found ${expertDocs.length} expert documents with processed content.`);
  
  // Need to fetch sources separately since we can't join directly
  Logger.info(`Found ${expertDocs.length} expert documents with processed content.`);
  
  // Get source IDs for the filtered documents
  const sourceIds = expertDocs.map(doc => doc.source_id);
  
  Logger.info(`Fetching sources for ${sourceIds.length} expert documents...`);
  const { data: sources, error: sourcesError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type')
    .in('id', sourceIds);
  
  if (sourcesError) {
    Logger.error(`Error fetching sources: ${sourcesError.message}`);
    return;
  }
  
  // Create a lookup map for sources
  const sourcesMap: Record<string, any> = {};
  sources?.forEach(source => {
    sourcesMap[source.id] = source;
  });
  
  // Combine the data
  let documents = expertDocs.map(doc => ({
    ...doc,
    sources_google: sourcesMap[doc.source_id] || null
  }));
  
  // Filter by extensions if provided
  if (fileExtensions && fileExtensions.length > 0) {
    Logger.info(`Filtering by file extensions: ${fileExtensions.join(', ')}`);
    
    // Convert extensions to lowercase for case-insensitive matching
    const lowerExtensions = fileExtensions.map(ext => 
      (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase()
    );
    
    // Filter documents by extension
    documents = documents.filter(doc => {
      // Handle sources_google which could be an array or object
      const sourceInfo = Array.isArray(doc.sources_google) 
        ? (doc.sources_google.length > 0 ? doc.sources_google[0] : null) 
        : doc.sources_google;
      
      const filename = sourceInfo?.name || '';
      const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      return lowerExtensions.includes(extension);
    });
    
    Logger.info(`After extension filtering: ${documents.length} documents remaining.`);
  }
  
  // Filter by expert name if provided
  if (expertName) {
    Logger.info(`Filtering by expert name: ${expertName}`);
    
    // First, get the expert ID for the given name
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
    if (expertSourceIds.length === 0) {
      Logger.error(`No sources found for expert: ${expertName}`);
      return;
    }
    
    // Filter documents by these source IDs
    documents = documents.filter(doc => 
      expertSourceIds.includes(doc.source_id)
    );
    
    Logger.info(`After expert filtering: ${documents.length} documents remaining.`);
  }
  
  if (documents.length === 0) {
    Logger.info('No expert documents found with matching criteria.');
    return;
  }
  
  Logger.info(`Found ${documents.length} expert documents to process.`);
  
  // Load the subject classification prompt
  const promptResult = await promptService.loadPrompt('subject-classification-prompt');
  
  if (!promptResult || !promptResult.prompt) {
    Logger.error('Failed to load subject-classification-prompt.');
    return;
  }
  
  Logger.info('Successfully loaded subject-classification-prompt.');
  
  // Process documents concurrently
  if (concurrency > 1) {
    Logger.info(`Processing documents with concurrency of ${concurrency}`);
  }
  
  // Set up processing options
  const processingOptions = {
    entityType,
    dryRun,
    verbose,
    maxRetries,
    retryDelayMs
  };
  
  const startTime = Date.now();
  
  // Process documents with concurrency
  const results = await processWithConcurrency(
    documents,
    async (doc) => processDocument(doc, promptResult.combinedContent, processingOptions),
    concurrency
  );
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  // Summarize results
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  Logger.info(`Subject classification completed in ${duration.toFixed(2)} seconds.`);
  Logger.info(`Results: ${successCount} successes, ${failureCount} failures`);
  
  // If there were failures, list them
  if (failureCount > 0) {
    Logger.warn('Failed documents:');
    results
      .filter(r => !r.success)
      .forEach(result => {
        Logger.warn(`- Document ${result.documentId}: ${result.error}`);
      });
  }
}

export async function classifySubjectsCommand(options: ClassifySubjectsOptions): Promise<void> {
  const {
    limit = 10,
    fileExtensions,
    expertName,
    verbose = false,
    dryRun = false,
    skipClassified = false,
    entityType = 'expert_documents',
    concurrency = 3,
    maxRetries = 3,
    retryDelayMs = 1000
  } = options;

  try {
    Logger.info('Starting subject classification...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get documents from the specified entity type
    Logger.info(`Fetching ${entityType} with processed content...`);
    
    // Store document IDs that already have classifications if skipClassified is true
    let classifiedIds: string[] = [];
    
    if (skipClassified) {
      Logger.info('Fetching already classified document IDs to skip them...');
      
      // First get document IDs that have been directly classified
      const { data: alreadyClassified, error: classifiedError } = await supabase
        .from('table_classifications')
        .select('entity_id')
        .eq('entity_type', entityType);
      
      // Then get source IDs that have been classified
      const { data: classifiedSources, error: sourcesError } = await supabase
        .from('table_classifications')
        .select('entity_id')
        .eq('entity_type', 'sources_google');
        
      if (classifiedError) {
        Logger.warn(`Error fetching classified documents: ${classifiedError.message}`);
      } else if (sourcesError) {
        Logger.warn(`Error fetching classified sources: ${sourcesError.message}`);
      } else {
        // Get all expert_documents that reference classified sources
        let docsWithClassifiedSources: string[] = [];
        
        if (classifiedSources && classifiedSources.length > 0) {
          const sourceIds = classifiedSources.map(item => item.entity_id);
          
          // Only do this query if we have some classified sources
          if (sourceIds.length > 0) {
            // Break into chunks to avoid query length limits
            const CHUNK_SIZE = 100;
            for (let i = 0; i < sourceIds.length; i += CHUNK_SIZE) {
              const chunk = sourceIds.slice(i, i + CHUNK_SIZE);
              const { data: docsForSources, error: docsError } = await supabase
                .from(entityType)
                .select('id')
                .in('source_id', chunk);
                
              if (!docsError && docsForSources) {
                docsWithClassifiedSources = [
                  ...docsWithClassifiedSources,
                  ...docsForSources.map(doc => doc.id)
                ];
              }
            }
          }
        }
        
        // Combine directly classified documents and documents with classified sources
        const directlyClassifiedIds = (alreadyClassified || []).map(item => item.entity_id);
        classifiedIds = [...directlyClassifiedIds, ...docsWithClassifiedSources];
        
        // Make unique
        const uniqueIds = Array.from(new Set(classifiedIds));
        Logger.info(`Found ${uniqueIds.length} already classified ${entityType} to skip (including those with classified sources).`);
        classifiedIds = uniqueIds;
      }
    }
    
    // Just get raw documents from expert_documents table first
    // We've tried complex filtering at the DB level and it's not working
    // Instead, we'll get docs and filter in code
    
    // If we're skipping classified docs, let's be more efficient and find only unclassified docs
    if (skipClassified && classifiedIds.length > 0) {
      Logger.info(`Looking specifically for unclassified documents with processed content...`);
      
      // We need a more direct approach to find unclassified documents
      // Find docs with processed_content that do NOT appear in the classified IDs list
      // First, fetch the document IDs for docs with processed content
      Logger.info(`Fetching documents with processed content that are NOT yet classified...`);
      
      // Directly query for unclassified documents with processed content
      // Instead of using RPC, we'll use a more direct approach
      
      // Create a query to get a list of ALL document IDs that have processed content
      const allDocsQuery = supabase
        .from(entityType)
        .select('id')
        .not('processed_content', 'is', null)
        .not('source_id', 'is', null);
        
      const { data: allDocsWithContent, error: allDocsError } = await allDocsQuery;
      
      if (allDocsError) {
        Logger.error(`Error fetching documents with content: ${allDocsError.message}`);
        return;
      }
      
      if (!allDocsWithContent || allDocsWithContent.length === 0) {
        Logger.info('No documents found with processed content.');
        return;
      }
      
      Logger.info(`Found ${allDocsWithContent.length} total documents with processed content.`);
      
      // Create a set of all IDs that have processed content
      const allDocIds = new Set(allDocsWithContent.map(doc => doc.id));
      
      // Create a set of all IDs that have already been classified
      const classifiedIdsSet = new Set(classifiedIds);
      
      // Find IDs that are in allDocIds but NOT in classifiedIdsSet
      const unclassifiedIds = Array.from(allDocIds).filter(id => !classifiedIdsSet.has(id));
      
      Logger.info(`Found ${unclassifiedIds.length} unclassified documents with processed content.`);
      
      if (unclassifiedIds.length === 0) {
        Logger.info('No unclassified documents found to process.');
        return;
      }
      
      // Get the first batch of unclassified documents to process
      const idsToProcess = unclassifiedIds.slice(0, Math.min(unclassifiedIds.length, limit * 2));
      
      // Now fetch detailed info for just these unclassified documents
      const query = supabase
        .from(entityType)
        .select('id, source_id, title')
        .in('id', idsToProcess)
        .not('processed_content', 'is', null)
        .order('updated_at', { ascending: false });
      
      Logger.info(`Executing optimized query for unclassified documents...`);
      const { data: expertDocsRaw, error: docsError } = await query;
      
      if (docsError) {
        Logger.error(`Error fetching expert documents: ${docsError.message}`);
        return;
      }
      
      if (!expertDocsRaw || expertDocsRaw.length === 0) {
        Logger.info('No unclassified expert documents found with processed content.');
        return;
      }
      
      Logger.info(`Found ${expertDocsRaw.length} potentially unclassified documents.`);
      
      // Filter in code if we had to skip the not.in filter due to large classifiedIds
      let expertDocs = expertDocsRaw;
      if (classifiedIds.length > 100) {
        const classifiedIdsSet = new Set(classifiedIds);
        expertDocs = expertDocsRaw.filter((doc: {id: string}) => !classifiedIdsSet.has(doc.id));
        Logger.info(`After filtering out classified docs: ${expertDocs.length} documents remaining to process`);
      }
      
      // Now we go straight to fetching the content for these documents
      if (expertDocs.length === 0) {
        Logger.info('No unclassified documents found after filtering.');
        return;
      }
      
      // Now proceed directly to verifying processed_content for these docs
      const docsToProcess = Math.min(expertDocs.length, limit);
      Logger.info(`Processing the first ${docsToProcess} unclassified documents.`);
      
      // Get full content for these documents
      return await processDocsWithContent(expertDocs.slice(0, docsToProcess), entityType, limit, verbose, dryRun, fileExtensions, expertName, concurrency, maxRetries, retryDelayMs);
    }
    
    // If not skipping or no classified IDs, fall back to the regular approach
    let query = supabase
      .from(entityType)
      .select('id, source_id, title')  // Don't select processed_content to keep response smaller
      .not('processed_content', 'is', null)  // Must have processed content
      .not('source_id', 'is', null)  // Must have a source reference
      .order('updated_at', { ascending: false })  // Get newest first
      .limit(limit * 5);  // Get enough docs to work with after filtering
    
    // Skip already classified documents if requested
    if (skipClassified && classifiedIds.length > 0) {
      Logger.info(`Found ${classifiedIds.length} already classified documents to skip`);
      
      // Handle large ID lists by batching the not-in filter
      // Supabase might have limits on how many IDs can be in a single 'not in' clause
      if (classifiedIds.length > 100) {
        Logger.info(`Large number of classified IDs (${classifiedIds.length}), using filter instead`);
        // Instead of using "not in", we'll get all documents and filter them after
        // DO NOT apply any limit here - we need all documents to filter properly
      } else {
        query = query.not('id', 'in', classifiedIds);
      }
    }
    
    // No longer filtering for missing titles
    
    // Execute the query
    Logger.info('Executing query to fetch documents...');
    const { data: expertDocsRaw, error: docsError } = await query;
    
    if (docsError) {
      Logger.error(`Error fetching expert documents: ${docsError.message}`);
      return;
    }
    
    if (!expertDocsRaw || expertDocsRaw.length === 0) {
      Logger.info('No expert documents found with processed content.');
      return;
    }
    
    Logger.info(`Initial query returned ${expertDocsRaw.length} documents.`);
    
    // Let's do all filtering in code since the DB filtering appears to be inconsistent
    // Keep a running list of eligible documents
    let expertDocs = expertDocsRaw;
    Logger.info(`Starting with ${expertDocs.length} documents`);
    
    // Filter #1: Must have source_id
    expertDocs = expertDocs.filter(doc => doc.source_id && doc.source_id.trim() !== '');
    Logger.info(`After source_id filtering: ${expertDocs.length} documents remaining`);
    
    // Filter #2: Skip already classified documents
    if (skipClassified && classifiedIds.length > 0) {
      // Convert classified IDs to a Set for faster lookups
      const classifiedIdsSet = new Set(classifiedIds);
      
      // Filter out documents that are already classified
      expertDocs = expertDocs.filter(doc => !classifiedIdsSet.has(doc.id));
      Logger.info(`After filtering out classified docs: ${expertDocs.length} documents remaining to process`);
    }
    
    // Now we need to verify which ones have processed_content (we didn't fetch it earlier to save bandwidth)
    if (expertDocs.length > 0) {
      // Get details for these specific documents with processed_content
      // Process in smaller batches to avoid "fetch failed" errors with large IN clauses
      const BATCH_SIZE = 50;
      let allDocsWithContent: any[] = [];
      
      // Process documents in batches
      for (let i = 0; i < Math.min(expertDocs.length, limit * 3); i += BATCH_SIZE) {
        const batchIds = expertDocs.map(doc => doc.id).slice(i, i + BATCH_SIZE);
        Logger.info(`Fetching batch ${i/BATCH_SIZE + 1} of documents with content (${batchIds.length} docs)...`);
        
        try {
          const { data: batchDocsWithContent, error: contentError } = await supabase
            .from(entityType)
            .select('id, source_id, processed_content, title')
            .in('id', batchIds)
            .not('processed_content', 'is', null);
          
          if (contentError) {
            Logger.error(`Error fetching batch of documents with content: ${contentError.message}`);
            continue; // Try the next batch instead of failing completely
          }
          
          if (batchDocsWithContent && batchDocsWithContent.length > 0) {
            allDocsWithContent = [...allDocsWithContent, ...batchDocsWithContent];
          }
          
          // If we've collected enough documents, we can stop
          if (allDocsWithContent.length >= limit) {
            break;
          }
        } catch (error) {
          Logger.error(`Exception fetching documents batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      expertDocs = allDocsWithContent;
      Logger.info(`After checking for processed content: ${expertDocs.length} documents with content`);
    }
    
    // Now apply the limit - after we've filtered out already classified docs
    // This ensures we get the requested number of unclassified docs
    if (!verbose && expertDocs.length > limit) {
      Logger.info(`Found ${expertDocs.length} documents, limiting to ${limit} for processing`);
      expertDocs = expertDocs.slice(0, limit);
    }
    
    Logger.info(`Found ${expertDocs.length} expert documents with processed content.`);
    
    // Need to fetch sources separately since we can't join directly
    Logger.info(`Found ${expertDocs.length} expert documents with processed content.`);
    
    // Get source IDs for the filtered documents
    const sourceIds = expertDocs.map(doc => doc.source_id);
    
    Logger.info(`Fetching sources for ${sourceIds.length} expert documents...`);
    const { data: sources, error: sourcesError } = await supabase
      .from('sources_google')
      .select('id, name, mime_type')
      .in('id', sourceIds);
    
    if (sourcesError) {
      Logger.error(`Error fetching sources: ${sourcesError.message}`);
      return;
    }
    
    // Create a lookup map for sources
    const sourcesMap: Record<string, any> = {};
    sources?.forEach(source => {
      sourcesMap[source.id] = source;
    });
    
    // Combine the data
    let documents = expertDocs.map(doc => ({
      ...doc,
      sources_google: sourcesMap[doc.source_id] || null
    }));
    
    // Filter by extensions if provided
    if (fileExtensions && fileExtensions.length > 0) {
      Logger.info(`Filtering by file extensions: ${fileExtensions.join(', ')}`);
      
      // Convert extensions to lowercase for case-insensitive matching
      const lowerExtensions = fileExtensions.map(ext => 
        (ext.startsWith('.') ? ext : `.${ext}`).toLowerCase()
      );
      
      // Filter documents by extension
      documents = documents.filter(doc => {
        // Handle sources_google which could be an array or object
        const sourceInfo = Array.isArray(doc.sources_google) 
          ? (doc.sources_google.length > 0 ? doc.sources_google[0] : null) 
          : doc.sources_google;
        
        const filename = sourceInfo?.name || '';
        const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        return lowerExtensions.includes(extension);
      });
      
      Logger.info(`After extension filtering: ${documents.length} documents remaining.`);
    }
    
    // Filter by expert name if provided
    if (expertName) {
      Logger.info(`Filtering by expert name: ${expertName}`);
      
      // First, get the expert ID for the given name
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
      if (expertSourceIds.length === 0) {
        Logger.error(`No sources found for expert: ${expertName}`);
        return;
      }
      
      // Filter documents by these source IDs
      documents = documents.filter(doc => 
        expertSourceIds.includes(doc.source_id)
      );
      
      Logger.info(`After expert filtering: ${documents.length} documents remaining.`);
    }
    
    if (documents.length === 0) {
      Logger.info('No expert documents found with matching criteria.');
      return;
    }
    
    Logger.info(`Found ${documents.length} expert documents to process.`);
    
    // Load the subject classification prompt
    const promptResult = await promptService.loadPrompt('subject-classification-prompt');
    
    if (!promptResult || !promptResult.prompt) {
      Logger.error('Failed to load subject-classification-prompt.');
      return;
    }
    
    Logger.info('Successfully loaded subject-classification-prompt.');
    
    // Process documents concurrently
    if (concurrency > 1) {
      Logger.info(`Processing documents with concurrency of ${concurrency}`);
    }
    
    // Set up processing options
    const processingOptions = {
      entityType,
      dryRun,
      verbose,
      maxRetries,
      retryDelayMs
    };
    
    const startTime = Date.now();
    
    // Process documents with concurrency
    const results = await processWithConcurrency(
      documents,
      async (doc) => processDocument(doc, promptResult.combinedContent, processingOptions),
      concurrency
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Summarize results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    Logger.info(`Subject classification completed in ${duration.toFixed(2)} seconds.`);
    Logger.info(`Results: ${successCount} successes, ${failureCount} failures`);
    
    // If there were failures, list them
    if (failureCount > 0) {
      Logger.warn('Failed documents:');
      results
        .filter(r => !r.success)
        .forEach(result => {
          Logger.warn(`- Document ${result.documentId}: ${result.error}`);
        });
    }
    
  } catch (error) {
    Logger.error(`Error in subject classification command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}