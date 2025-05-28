/**
 * Classify Remaining Experts Command
 * 
 * Applies subject classifications to expert documents that have processed content
 * but are not yet classified, using specific filters to exclude unsupported types.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { promptService } from '../../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ClassifyRemainingExpertsOptions {
  limit?: number;
  expertName?: string;
  verbose?: boolean;
  dryRun?: boolean;
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
  document_type_id?: string;
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
 * Fetch remaining expert documents that need classification based on specific criteria
 */
async function fetchRemainingExpertDocuments(limit: number, expertName?: string): Promise<ExpertDocument[]> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    Logger.info('Finding remaining expert documents that need classification...');

    // Define arrays for filtering
    const unsupportedFolders = [
      'bd903d99-64a1-4297-ba76-1094ab235dac',
      'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd',
      '0d61a685-10e0-4c82-b964-60b88b02ac15'
    ];

    const unsupportedDocTypes = [
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
      '9dbe32ff-5e82-4586-be63-1445e5bcc548'  // unknown document type
    ];

    const unsupportedMimeTypes = [
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

    // First, find expert documents with processed content
    Logger.info('Finding expert documents with processed content...');
    
    // Handle expert filtering if needed
    let expertSourceIds: string[] = [];
    
    if (expertName) {
      // Get the expert ID
      const { data: expertData, error: expertError } = await supabase
        .from('expert_profiles')
        .select('id')
        .eq('expert_name', expertName)
        .single();
        
      if (expertError) {
        Logger.error(`Error finding expert with name ${expertName}: ${expertError.message}`);
        return [];
      }
      
      if (!expertData) {
        Logger.error(`Expert not found with name: ${expertName}`);
        return [];
      }
      
      const expertId = expertData.id;
      
      // Get the sources for this expert
      const { data: expertSources, error: sourcesError } = await supabase
        .from('google_sources_experts')
        .select('source_id')
        .eq('expert_id', expertId);
        
      if (sourcesError) {
        Logger.error(`Error getting sources for expert: ${sourcesError.message}`);
        return [];
      }
      
      if (!expertSources || expertSources.length === 0) {
        Logger.error(`No sources found for expert: ${expertName}`);
        return [];
      }
      
      expertSourceIds = expertSources.map(source => source.source_id);
      Logger.info(`Filtering by expert: ${expertName} (${expertSourceIds.length} sources)`);
    }
    
    // Find documents with processed content in expert_documents
    Logger.info('Finding expert documents with processed content...');
    let expertDocsQuery = supabase
      .from('expert_documents')
      .select('id, title, source_id, document_type_id, processed_content')
      .not('processed_content', 'is', null);
    
    // Add expert filtering if specified
    if (expertName && expertSourceIds.length > 0) {
      expertDocsQuery = expertDocsQuery.in('source_id', expertSourceIds);
    }
    
    // Order by ID and get more than we need to account for filtering
    const { data: expertDocs, error: expertDocsError } = await expertDocsQuery
      .order('id', { ascending: false })
      .limit(limit * 5); // Get more than we need since we'll filter some out
    
    if (expertDocsError) {
      Logger.error(`Error fetching expert documents: ${expertDocsError.message}`);
      return [];
    }
    
    Logger.info(`Found ${expertDocs?.length || 0} expert documents with processed content.`);
    
    if (!expertDocs || expertDocs.length === 0) {
      return [];
    }
    
    // Get the source IDs to fetch additional information
    const sourceIds = expertDocs.map(doc => doc.source_id).filter(id => id);
    
    // Fetch source information for these documents
    Logger.info(`Fetching source information for ${sourceIds.length} sources...`);
    const { data: sources, error: sourcesError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type')
      .in('id', sourceIds);
    
    if (sourcesError) {
      Logger.error(`Error fetching sources: ${sourcesError.message}`);
      return [];
    }
    
    // Create a lookup map for sources
    const sourcesMap: Record<string, {id: string, name: string, mime_type: string}> = {};
    sources?.forEach(source => {
      sourcesMap[source.id] = source;
    });
    
    // Filter out documents with unsupported mime types and document types
    let allDocs = expertDocs.filter(doc => {
      // Need the source to check mime type
      const source = doc.source_id ? sourcesMap[doc.source_id] : null;
      if (!source) return false;
      
      // Check MIME type
      if (source.mime_type === 'application/vnd.google-apps.folder') return false;
      if (unsupportedMimeTypes.includes(source.mime_type)) return false;
      
      // Check document type
      if (doc.document_type_id && unsupportedDocTypes.includes(doc.document_type_id)) return false;
      
      return true;
    });
    
    Logger.info(`After filtering unsupported types: ${allDocs.length} documents (removed ${expertDocs.length - allDocs.length}).`);
    
    // Get the IDs of these documents
    const docIds = allDocs.map(doc => doc.id);
    
    // Now check which of these documents are already classified
    Logger.info('Checking which documents are already classified...');
    const { data: classifiedDocs, error: classifiedError } = await supabase
      .from('table_classifications')
      .select('entity_id')
      .eq('entity_type', 'expert_documents')
      .in('entity_id', docIds);
    
    if (classifiedError) {
      Logger.error(`Error checking classified documents: ${classifiedError.message}`);
      return [];
    }
    
    // Create a Set of already classified document IDs for fast lookups
    const classifiedIds = new Set(classifiedDocs?.map(doc => doc.entity_id) || []);
    Logger.info(`Found ${classifiedIds.size} already classified documents out of ${docIds.length}.`);
    
    // Filter out the already classified documents
    const unclassifiedDocs = allDocs.filter(doc => !classifiedIds.has(doc.id));
    Logger.info(`Found ${unclassifiedDocs.length} unclassified documents that need classification.`);
    
    // Limit to the requested number
    const documentsToProcess = unclassifiedDocs.slice(0, limit);
    
    Logger.info(`Selected ${documentsToProcess.length} documents for classification processing.`);
    
    // Transform the results to match our ExpertDocument interface
    const documents: ExpertDocument[] = documentsToProcess.map((doc: any) => {
      // Get source information from our sources map
      const sourceInfo = doc.source_id ? sourcesMap[doc.source_id] : null;
      
      return {
        id: doc.id,
        source_id: doc.source_id,
        processed_content: doc.processed_content,
        title: doc.title,
        document_type_id: doc.document_type_id,
        sources_google: sourceInfo ? {
          id: sourceInfo.id,
          name: sourceInfo.name,
          mime_type: sourceInfo.mime_type
        } : null
      };
    });
    
    return documents;
  } catch (error) {
    Logger.error(`Error fetching remaining expert documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // Check which promises are still pending
      const pendingPromises: Promise<void>[] = [];
      for (const promise of runningPromises) {
        // Create a flag to track if this promise is still pending
        let isResolved = false;
        
        // Set up a race between the promise and a flag-setter
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
    dryRun: boolean;
    verbose: boolean;
    maxRetries: number;
    retryDelayMs: number;
  }
): Promise<DocumentProcessResult> {
  const { dryRun, verbose, maxRetries, retryDelayMs } = options;
  const supabase = SupabaseClientService.getInstance().getClient();
  const entityType = 'expert_documents';
  
  try {
    if (!doc.processed_content) {
      return {
        documentId: doc.id,
        success: false,
        error: 'Document has no processed content'
      };
    }
    
    const sourceInfo = doc.sources_google;
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
    const sourceFileName = doc.sources_google?.name || 'Unknown file';
    
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
 * Main command function to classify remaining expert documents
 */
export async function classifyRemainingExpertsCommand(options: ClassifyRemainingExpertsOptions): Promise<void> {
  const {
    limit = 10,
    expertName,
    verbose = false,
    dryRun = false,
    concurrency = 3,
    maxRetries = 3,
    retryDelayMs = 1000
  } = options;

  try {
    Logger.info('Starting classification of remaining expert documents...');
    
    // Get documents that need classification using the specialized filtering logic
    const documents = await fetchRemainingExpertDocuments(limit, expertName);
    
    if (!documents || documents.length === 0) {
      Logger.info('No documents found to process based on the filtering criteria.');
      return;
    }
    
    Logger.info(`Found ${documents.length} documents to classify.`);
    
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
      dryRun,
      verbose,
      maxRetries,
      retryDelayMs
    };
    
    const startTime = Date.now();
    
    // Process documents with concurrency
    const results = await processWithConcurrency(
      documents,
      async (doc: ExpertDocument) => processDocument(doc, promptResult.combinedContent, processingOptions),
      concurrency
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Summarize results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    Logger.info(`Classification of remaining experts completed in ${duration.toFixed(2)} seconds.`);
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
    Logger.error(`Error in classify-remaining-experts command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}