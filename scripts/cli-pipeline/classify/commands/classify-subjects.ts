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
  sources_google: SourceGoogle | null;
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
    
    const sourceInfo = doc.sources_google;
    const fileName = sourceInfo?.name || 'Unknown file';
    const mimeType = sourceInfo?.mime_type || 'Unknown type';
    
    Logger.info(`Processing document: ${fileName} (${mimeType})`);
    
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
      Logger.info(`Document source: ${fileName}`);
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
        
        // Try to parse the JSON
        classificationResult = JSON.parse(jsonStr) as SubjectClassificationResult;
        
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
    
    // Store classifications in the database
    // First check if classifications already exist for this entity
    const { data: existingClassifications, error: checkError } = await supabase
      .from('table_classifications')
      .select('subject_classification_id')
      .eq('entity_id', doc.id)
      .eq('entity_type', entityType);
      
    if (checkError) {
      Logger.error(`Error checking existing classifications: ${checkError.message}`);
      return {
        documentId: doc.id,
        success: false,
        error: `Error checking existing classifications: ${checkError.message}`
      };
    }
    
    // Create a set of existing subject IDs for quick lookup
    const existingSubjectIds = new Set(
      (existingClassifications || []).map(item => item.subject_classification_id)
    );
    
    // Only insert classifications that don't already exist for this entity
    let insertedCount = 0;
    for (const subjectId of classificationResult.subject_ids) {
      // Skip if this classification already exists
      if (existingSubjectIds.has(subjectId)) {
        if (verbose) {
          Logger.info(`Skipping existing classification ${subjectId} for document ${doc.id}`);
        }
        continue;
      }
      
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
        Logger.error(`Error storing classification: ${insertError.message}`);
      } else {
        insertedCount++;
      }
    }
    
    // Log summary of inserted classifications
    if (insertedCount > 0) {
      Logger.info(`Added ${insertedCount} new classifications for document: ${doc.id}`);
    } else if (existingSubjectIds.size > 0) {
      Logger.info(`Document ${doc.id} already had classifications, nothing new to add`);
    } else {
      Logger.info(`Successfully stored all classifications for document: ${doc.id}`);
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
      const { data: alreadyClassified, error: classifiedError } = await supabase
        .from('table_classifications')
        .select('entity_id')
        .eq('entity_type', entityType);
      
      if (classifiedError) {
        Logger.warn(`Error fetching classified documents: ${classifiedError.message}`);
      } else {
        classifiedIds = (alreadyClassified || []).map(item => item.entity_id);
        // Use Array.from instead of spread operator to avoid TypeScript issue
        const uniqueIds = Array.from(new Set(classifiedIds));
        Logger.info(`Found ${uniqueIds.length} already classified ${entityType} to skip.`);
        classifiedIds = uniqueIds;
      }
    }
    
    // Build the base query
    let query = supabase
      .from(entityType)
      .select('id, source_id, processed_content, title')
      .neq('processed_content', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    // Skip already classified documents if requested
    if (skipClassified && classifiedIds.length > 0) {
      Logger.info(`Found ${classifiedIds.length} already classified documents to skip`);
      
      // Handle large ID lists by batching the not-in filter
      // Supabase might have limits on how many IDs can be in a single 'not in' clause
      if (classifiedIds.length > 100) {
        Logger.info(`Large number of classified IDs (${classifiedIds.length}), using filter instead`);
        // Instead of using "not in", we'll get more documents than needed and filter them after
        query = query.limit(limit * 2); // Get more documents and filter later
      } else {
        query = query.not('id', 'in', classifiedIds);
      }
    }
    
    // No longer filtering for missing titles
    
    // Execute the query
    const { data: expertDocsRaw, error: docsError } = await query;
    
    if (docsError) {
      Logger.error(`Error fetching expert documents: ${docsError.message}`);
      return;
    }
    
    if (!expertDocsRaw || expertDocsRaw.length === 0) {
      Logger.info('No expert documents found with processed content.');
      return;
    }
    
    // If we're skipping classified documents and have many classified IDs,
    // filter the results manually to exclude already classified documents
    let expertDocs = expertDocsRaw;
    
    if (skipClassified && classifiedIds.length > 100) {
      // Convert classified IDs to a Set for faster lookups
      const classifiedIdsSet = new Set(classifiedIds);
      
      // Filter out documents that are already classified
      expertDocs = expertDocsRaw.filter(doc => !classifiedIdsSet.has(doc.id));
      
      // Limit to the requested number
      expertDocs = expertDocs.slice(0, limit);
      
      Logger.info(`After filtering: ${expertDocs.length} documents remaining to process`);
    }
    
    Logger.info(`Found ${expertDocs.length} expert documents with processed content.`);
    
    // Get sources for these expert documents
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
    
    // Combine the data and filter by extensions if needed
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
        const filename = doc.sources_google?.name || '';
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