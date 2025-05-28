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
  sourceId?: string; // Added to support directly classifying a specific source
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
 * Fetch unclassified documents using the same logic as list-unclassified
 */
async function fetchUnclassifiedDocuments(limit: number): Promise<any[]> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    Logger.info('Finding unclassified expert documents...');
    
    // 1. Get the list of entity_ids that have already been classified
    Logger.info('Fetching classified document IDs...');
    const { data: classified, error: classifiedError } = await supabase
      .from('table_classifications')
      .select('entity_id')
      .eq('entity_type', 'expert_documents');
      
    if (classifiedError) {
      Logger.error(`Error fetching classified documents: ${classifiedError.message}`);
      return [];
    }
    
    // Get unique entity_ids
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
      return [];
    }
    
    // Now filter out the ones that are already classified
    const allDocIds = allDocsWithContent?.map(doc => doc.id) || [];
    const unclassifiedIds = allDocIds.filter(id => !classifiedIds.includes(id));
    
    Logger.info(`Found ${allDocIds.length} documents with processed content.`);
    Logger.info(`Found ${unclassifiedIds.length} unclassified documents with processed content.`);
    
    if (unclassifiedIds.length === 0) {
      Logger.info('No unclassified documents found with processed content.');
      return [];
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
        .from('expert_documents')
        .select('id, source_id, processed_content, title')
        .in('id', idsToFetch);
        
      if (batchError) {
        Logger.error(`Error fetching batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batchError.message}`);
        continue; // Try the next batch
      }
      
      if (batchDocs && batchDocs.length > 0) {
        allUnclassifiedDocs = [...allUnclassifiedDocs, ...batchDocs];
      }
    }
    
    Logger.info(`Successfully fetched ${allUnclassifiedDocs.length} unclassified documents with content`);
    return allUnclassifiedDocs;
  } catch (error) {
    Logger.error(`Error finding unclassified documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

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
      .from('google_sources')
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
      .eq('entity_type', 'google_sources')
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
          entity_type: 'google_sources',
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
    .from('google_sources')
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
    skipClassified = true, // Always skip classified documents with the new approach
    entityType = 'expert_documents',
    concurrency = 3,
    maxRetries = 3,
    retryDelayMs = 1000
  } = options;

  try {
    Logger.info('Starting subject classification using list-unclassified approach...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get unclassified documents using the same logic as the list-unclassified command
    const unclassifiedDocs = await fetchUnclassifiedDocuments(limit);
    
    if (!unclassifiedDocs || unclassifiedDocs.length === 0) {
      Logger.info('No unclassified documents found to process.');
      return;
    }
    
    Logger.info(`Found ${unclassifiedDocs.length} unclassified documents with content.`);
    
    // Get source IDs for the unclassified documents
    const sourceIds = unclassifiedDocs.map(doc => doc.source_id).filter(id => id);
    
    Logger.info(`Fetching sources for ${sourceIds.length} expert documents...`);
    const { data: sources, error: sourcesError } = await supabase
      .from('google_sources')
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
    let documents = unclassifiedDocs.map(doc => ({
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