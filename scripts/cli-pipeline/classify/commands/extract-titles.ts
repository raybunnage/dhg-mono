/**
 * Extract Titles Command
 * 
 * Extracts titles from MP4 files in sources_google and updates the corresponding expert_documents records
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { promptService } from '../../../../packages/shared/services/prompt-service';
import { claudeService } from '@shared/services/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ExtractTitlesOptions {
  limit?: number;
  expertName?: string;
  verbose?: boolean;
  dryRun?: boolean;
  skipExisting?: boolean;
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface SourceDoc {
  sourceId: string;
  sourceName: string;
  mimeType: string;
  expertDocId: string;
  content: any;
  title: string | null;
}

interface TitleExtractionResult {
  sourceId: string;
  expertDocId: string;
  success: boolean;
  title?: string;
  error?: string;
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
 * Extract title from a source document
 */
async function extractTitle(
  doc: SourceDoc,
  systemPrompt: string,
  options: {
    dryRun: boolean;
    verbose: boolean;
    maxRetries: number;
    retryDelayMs: number;
  }
): Promise<TitleExtractionResult> {
  const { dryRun, verbose, maxRetries, retryDelayMs } = options;
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Skip documents without content
    if (!doc.content) {
      return {
        sourceId: doc.sourceId,
        expertDocId: doc.expertDocId,
        success: false,
        error: 'No processed content available'
      };
    }
    
    Logger.info(`Processing source: ${doc.sourceName} (${doc.mimeType})`);
    
    // Extract content from processed_content
    let content = '';
    if (typeof doc.content === 'string') {
      content = doc.content;
    } else if (doc.content.content) {
      content = typeof doc.content.content === 'string' 
        ? doc.content.content 
        : JSON.stringify(doc.content.content);
    } else if (doc.content.text) {
      content = typeof doc.content.text === 'string'
        ? doc.content.text
        : JSON.stringify(doc.content.text);
    } else {
      // Just stringify the whole object as a fallback
      content = JSON.stringify(doc.content);
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
    
    // Skip actual extraction in dry run mode
    if (dryRun) {
      Logger.info(`[DRY RUN] Would extract title for document: ${doc.expertDocId}`);
      Logger.info(`Source: ${doc.sourceName} (${doc.mimeType})`);
      if (doc.title) {
        Logger.info(`[DRY RUN] Current title: "${doc.title}"`);
      } else {
        Logger.info(`[DRY RUN] Document has no title currently set`);
      }
      
      return {
        sourceId: doc.sourceId,
        expertDocId: doc.expertDocId,
        success: true,
        title: 'DRY RUN - Generated Title'
      };
    }
    
    // Extract title using Claude with retry logic
    Logger.info(`Sending content to Claude for title extraction...`);
    
    let attempts = 0;
    let lastError: any = null;
    let extractionResult: { title: string, subject_ids: string[] } | null = null;
    
    while (attempts < maxRetries) {
      attempts++;
      try {
        // We need to modify the prompt to include system instructions
        const combinedPrompt = `${systemPrompt}\n\n${userMessage}`;
        
        // Use Claude service singleton
        const response = await claudeService.sendPrompt(combinedPrompt);
        
        // Parse the JSON response, handling potential markdown formatting
        let jsonStr = response;
        
        // Check if the response is wrapped in markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonStr = jsonMatch[1];
        }
        
        // Try to parse the JSON
        extractionResult = JSON.parse(jsonStr) as { title: string, subject_ids: string[] };
        
        if (!extractionResult || !extractionResult.title) {
          throw new Error(`Failed to get valid title for document ${doc.expertDocId}`);
        }
        
        // Successfully got title, break the retry loop
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
    if (!extractionResult) {
      return {
        sourceId: doc.sourceId,
        expertDocId: doc.expertDocId,
        success: false,
        error: `Failed after ${maxRetries} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
      };
    }
    
    Logger.info(`Title extraction successful: "${extractionResult.title}"`);
    
    // Update the title in the expert_documents table
    Logger.info(`Updating title for document ${doc.expertDocId} to: "${extractionResult.title}"`);
    
    const { error: titleUpdateError } = await supabase
      .from('google_expert_documents')
      .update({ title: extractionResult.title })
      .eq('id', doc.expertDocId);
    
    if (titleUpdateError) {
      Logger.error(`Error updating title: ${titleUpdateError.message}`);
      return {
        sourceId: doc.sourceId,
        expertDocId: doc.expertDocId,
        success: false,
        error: `Error updating title: ${titleUpdateError.message}`
      };
    }
    
    Logger.info(`Successfully updated title for document: ${doc.expertDocId}`);
    
    return {
      sourceId: doc.sourceId,
      expertDocId: doc.expertDocId,
      success: true,
      title: extractionResult.title
    };
  } catch (error) {
    Logger.error(`Error processing document ${doc.expertDocId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      sourceId: doc.sourceId,
      expertDocId: doc.expertDocId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main command function to extract titles from MP4 files
 */
export async function extractTitlesCommand(options: ExtractTitlesOptions): Promise<void> {
  const {
    limit = 50,
    expertName,
    verbose = false,
    dryRun = false,
    skipExisting = true,
    concurrency = 3,
    maxRetries = 3,
    retryDelayMs = 1000
  } = options;

  try {
    Logger.info('Starting title extraction for MP4 files...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First, find MP4 files in sources_google
    Logger.info(`Finding MP4 files in sources_google...`);
    
    // Get MP4 files from sources_google
    let sourceQuery = supabase
      .from('google_sources')
      .select('id, name, mime_type')
      .eq('mime_type', 'video/mp4')
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
    
    // Query for expert documents with processed content
    const { data: expertDocs, error: docsError } = await supabase
      .from('google_expert_documents')
      .select('id, source_id, processed_content, title')
      .in('source_id', sourceIds)
      .neq('processed_content', null);
      
    if (docsError) {
      Logger.error(`Error fetching expert documents: ${docsError.message}`);
      return;
    }
    
    Logger.info(`Found ${expertDocs ? expertDocs.length : 0} expert documents with content.`);
    
    // Transform data for processing
    let sourceDocs: SourceDoc[] = [];

    // Process each expert document
    for (const doc of expertDocs || []) {
      // Skip if missing content
      if (!doc.processed_content) {
        continue;
      }

      // Skip if we want to filter out documents that already have titles
      if (skipExisting && doc.title) {
        continue;
      }
      
      // Get the associated source
      const source = sourceMap[doc.source_id];
      if (!source) {
        continue;
      }

      sourceDocs.push({
        sourceId: source.id,
        sourceName: source.name,
        mimeType: source.mime_type,
        expertDocId: doc.id,
        content: doc.processed_content,
        title: doc.title
      });
    }

    Logger.info(`After filtering, found ${sourceDocs.length} documents to process.`);
    
    // Load the subject classification prompt
    const promptResult = await promptService.loadPrompt('subject-classification-prompt');
    
    if (!promptResult || !promptResult.prompt) {
      Logger.error('Failed to load subject-classification-prompt.');
      return;
    }
    
    Logger.info('Successfully loaded subject-classification-prompt.');
    
    // Process sources concurrently
    if (concurrency > 1) {
      Logger.info(`Processing sources with concurrency of ${concurrency}`);
    }
    
    // Set up processing options
    const processingOptions = {
      dryRun,
      verbose,
      maxRetries,
      retryDelayMs
    };
    
    const startTime = Date.now();
    
    // Process sources with concurrency
    const results = await processWithConcurrency(
      sourceDocs,
      async (doc) => extractTitle(doc, promptResult.combinedContent, processingOptions),
      concurrency
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Summarize results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    Logger.info(`Title extraction completed in ${duration.toFixed(2)} seconds.`);
    Logger.info(`Results: ${successCount} titles updated, ${failureCount} failures`);
    
    // If there were failures, list them
    if (failureCount > 0) {
      Logger.warn('Failed documents:');
      results
        .filter(r => !r.success)
        .forEach(result => {
          Logger.warn(`- Document ${result.expertDocId}: ${result.error}`);
        });
    }
    
  } catch (error) {
    Logger.error(`Error in title extraction command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}