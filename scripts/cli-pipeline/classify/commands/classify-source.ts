/**
 * Classify a specific source by ID command
 * 
 * Directly classifies a specific source or expert document by ID,
 * bypassing the normal filtering process.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { promptService } from '../../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ClassifySourceOptions {
  sourceId: string;
  entityType?: string;
  verbose?: boolean;
  dryRun?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  force?: boolean;
}

interface SubjectClassificationResult {
  title: string;
  subject_ids: string[];
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Classifies a specific source by ID
 */
export async function classifySourceCommand(options: ClassifySourceOptions): Promise<void> {
  const {
    sourceId,
    entityType = 'expert_documents',
    verbose = false,
    dryRun = false,
    maxRetries = 3,
    retryDelayMs = 1000
  } = options;

  if (!sourceId) {
    Logger.error('A source ID is required.');
    return;
  }

  try {
    Logger.info(`Starting classification for source ID: ${sourceId}`);
    const supabase = SupabaseClientService.getInstance().getClient();

    // 1. If we're classifying an expert_document, we need to fetch it first
    let expertDocument: any;
    if (entityType === 'expert_documents') {
      // Check if this is an expert_document ID or a sources_google ID
      
      // Try to get the expert_document directly
      const { data: doc, error: docError } = await supabase
        .from('expert_documents')
        .select('id, source_id, processed_content, title')
        .eq('id', sourceId)
        .single();
        
      if (docError || !doc) {
        // Not found as an expert_document ID, try to find by source_id
        Logger.info(`ID ${sourceId} not found directly as expert_document, checking as source ID...`);
        
        const { data: docBySource, error: sourceError } = await supabase
          .from('expert_documents')
          .select('id, source_id, processed_content, title')
          .eq('source_id', sourceId)
          .single();
          
        if (sourceError || !docBySource) {
          Logger.error(`No expert_document found with ID or source_id: ${sourceId}`);
          return;
        }
        
        Logger.info(`Found expert_document with source_id: ${sourceId}, document ID: ${docBySource.id}`);
        expertDocument = docBySource;
      } else {
        Logger.info(`Found expert_document with ID: ${sourceId}`);
        expertDocument = doc;
      }
      
      // Check that we have processed content
      if (!expertDocument.processed_content) {
        Logger.error(`Document ${expertDocument.id} has no processed content. Cannot classify.`);
        return;
      }
    } else {
      // When classifying other entity types, we'll need to adapt this code
      Logger.error(`Classification of entity type ${entityType} is not yet supported.`);
      return;
    }
    
    // 2. Get source information
    const { data: source, error: sourceError } = await supabase
      .from('sources_google')
      .select('id, name, mime_type')
      .eq('id', expertDocument.source_id)
      .single();
      
    if (sourceError || !source) {
      Logger.error(`Could not find source with ID: ${expertDocument.source_id}`);
      return;
    }
    
    Logger.info(`Processing source: ${source.name} (${source.mime_type})`);
    
    // 3. Check if this document or source already has classifications
    // Check if this document has classifications
    const { data: docClassifications, error: docClassError } = await supabase
      .from('table_classifications')
      .select('id')
      .eq('entity_id', expertDocument.id)
      .eq('entity_type', entityType)
      .limit(1);
      
    if (docClassError) {
      Logger.error(`Error checking document classifications: ${docClassError.message}`);
      return;
    }
    
    // Check if the source has classifications
    const { data: sourceClassifications, error: sourceClassError } = await supabase
      .from('table_classifications')
      .select('id')
      .eq('entity_id', expertDocument.source_id)
      .eq('entity_type', 'sources_google')
      .limit(1);
      
    if (sourceClassError) {
      Logger.error(`Error checking source classifications: ${sourceClassError.message}`);
      return;
    }
    
    const hasDocClassifications = docClassifications && docClassifications.length > 0;
    const hasSourceClassifications = sourceClassifications && sourceClassifications.length > 0;
    
    // Skip this check if --force flag was provided
    if ((hasDocClassifications || hasSourceClassifications) && !options.force) {
      Logger.info(`Document or source already has classifications. Use --force to override.`);
      Logger.info(`Document classifications: ${hasDocClassifications ? docClassifications!.length : 0}`);
      Logger.info(`Source classifications: ${hasSourceClassifications ? sourceClassifications!.length : 0}`);
      return;
    } else if (hasDocClassifications || hasSourceClassifications) {
      Logger.info(`Document or source already has classifications but --force flag was provided. Proceeding with reclassification.`);
      
      // Delete existing classifications if --force is used
      if (hasDocClassifications) {
        Logger.info(`Deleting existing document classifications for ID: ${expertDocument.id}`);
        const { error: deleteDocError } = await supabase
          .from('table_classifications')
          .delete()
          .eq('entity_id', expertDocument.id)
          .eq('entity_type', entityType);
          
        if (deleteDocError) {
          Logger.error(`Error deleting document classifications: ${deleteDocError.message}`);
          return;
        }
      }
      
      if (hasSourceClassifications) {
        Logger.info(`Deleting existing source classifications for ID: ${expertDocument.source_id}`);
        const { error: deleteSourceError } = await supabase
          .from('table_classifications')
          .delete()
          .eq('entity_id', expertDocument.source_id)
          .eq('entity_type', 'sources_google');
          
        if (deleteSourceError) {
          Logger.error(`Error deleting source classifications: ${deleteSourceError.message}`);
          return;
        }
      }
    }
    
    // 4. Extract content from processed_content
    let content = '';
    if (typeof expertDocument.processed_content === 'string') {
      content = expertDocument.processed_content;
    } else if (expertDocument.processed_content.content) {
      content = typeof expertDocument.processed_content.content === 'string' 
        ? expertDocument.processed_content.content 
        : JSON.stringify(expertDocument.processed_content.content);
    } else if (expertDocument.processed_content.text) {
      content = typeof expertDocument.processed_content.text === 'string'
        ? expertDocument.processed_content.text
        : JSON.stringify(expertDocument.processed_content.text);
    } else {
      // Just stringify the whole object as a fallback
      content = JSON.stringify(expertDocument.processed_content);
    }
    
    // Set a max chunk size that leaves enough room for the subject classification prompt and Claude's response
    // Using a more conservative chunk size to avoid context limit errors
    const MAX_CHUNK_LENGTH = 12000;
    let contentChunks: string[] = [];
    
    // Split content into chunks if it's large
    if (content.length > MAX_CHUNK_LENGTH) {
      Logger.info(`Content length (${content.length} chars) exceeds maximum chunk size. Splitting into chunks...`);
      
      // Create multiple chunks with some overlap
      let currentPosition = 0;
      while (currentPosition < content.length) {
        // Determine the end of this chunk (with potential overlap)
        const chunkEnd = Math.min(currentPosition + MAX_CHUNK_LENGTH, content.length);
        
        // Extract the chunk
        const chunk = content.substring(currentPosition, chunkEnd);
        contentChunks.push(chunk);
        
        // Move to the next chunk with a slight overlap for context preservation
        // Using a 10% overlap to maintain context between chunks
        currentPosition = chunkEnd - Math.min(1500, chunkEnd - currentPosition);
        
        // Avoid infinite loops due to overlap calculation
        if (currentPosition >= content.length - 100) break;
      }
      
      Logger.info(`Split content into ${contentChunks.length} chunks for processing`);
    } else {
      // Single chunk for smaller content
      contentChunks = [content];
    }
    
    // 5. Load the subject classification prompt
    const promptResult = await promptService.loadPrompt('subject-classification-prompt');
    
    if (!promptResult || !promptResult.prompt) {
      Logger.error('Failed to load subject-classification-prompt.');
      return;
    }
    
    Logger.info('Successfully loaded subject-classification-prompt.');
    
    // 6. Skip actual classification in dry run mode
    if (dryRun) {
      Logger.info(`[DRY RUN] Would classify document: ${expertDocument.id}`);
      Logger.info(`Document source: ${source.name}`);
      Logger.info(`MIME type: ${source.mime_type}`);
      if (contentChunks.length > 1) {
        Logger.info(`Would process in ${contentChunks.length} chunks due to content size`);
      }
      return;
    }
    
    // 7. Classify the content using Claude with retry logic
    let allClassifications: SubjectClassificationResult[] = [];
    
    // Process each content chunk and merge results
    for (let i = 0; i < contentChunks.length; i++) {
      Logger.info(`Processing chunk ${i+1} of ${contentChunks.length} (${contentChunks[i].length} chars)...`);
      
      // Log content preview in verbose mode
      if (options.verbose) {
        const previewLength = 100;
        const contentPreview = contentChunks[i].length > previewLength 
          ? contentChunks[i].substring(0, previewLength) + '...' 
          : contentChunks[i];
        Logger.info(`Content preview: ${contentPreview}`);
      }
      
      let attempts = 0;
      let lastError: any = null;
      let classificationResult: SubjectClassificationResult | null = null;
      
      // Adjust prompt based on whether this is one chunk or multiple
      let userMessage = '';
      if (contentChunks.length > 1) {
        userMessage = `Please classify the following content (chunk ${i+1} of ${contentChunks.length}):\n\n${contentChunks[i]}`;
      } else {
        userMessage = `Please classify the following content:\n\n${contentChunks[i]}`;
      }
      
      Logger.info(`Sending content chunk ${i+1} to Claude for classification...`);
      
      while (attempts < maxRetries) {
        attempts++;
        try {
          // We need to modify the prompt to include system instructions
          const combinedPrompt = `${promptResult.combinedContent}\n\n${userMessage}`;
          
          // Use Claude service (singleton pattern) with limited output tokens
          const response = await claudeService.sendPrompt(combinedPrompt, {
            maxTokens: 1000 // Limit output tokens since we only need the JSON classification
          });
          
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
            throw new Error(`Failed to get valid classification result for document ${expertDocument.id} in chunk ${i+1}`);
          }
          
          // Add this chunk's classification to our results
          allClassifications.push(classificationResult);
          
          // Successfully got classification, break the retry loop
          break;
        } catch (error) {
          lastError = error;
          Logger.warn(`Attempt ${attempts}/${maxRetries} for chunk ${i+1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          if (attempts < maxRetries) {
            // Exponential backoff
            const backoffTime = retryDelayMs * Math.pow(2, attempts - 1);
            Logger.info(`Retrying chunk ${i+1} in ${backoffTime}ms...`);
            await sleep(backoffTime);
          }
        }
      }
      
      // Handle case where all retries failed for this chunk
      if (!classificationResult) {
        Logger.error(`Failed to classify chunk ${i+1} after ${maxRetries} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
        if (i === 0 && contentChunks.length > 1) {
          // If the first chunk fails and we have multiple chunks, try to continue with other chunks
          Logger.warn(`Continuing with remaining chunks despite failure on chunk ${i+1}`);
          continue;
        } else if (contentChunks.length === 1) {
          // Only one chunk and it failed
          return;
        }
      }
    }
    
    // Merge all classifications if we processed multiple chunks
    let classificationResult: SubjectClassificationResult | null = null;
    
    if (allClassifications.length === 0) {
      Logger.error(`No successful classifications for any content chunks`);
      return;
    } else if (allClassifications.length === 1) {
      // Just use the single classification
      classificationResult = allClassifications[0];
    } else {
      // Merge multiple classifications
      Logger.info(`Merging classifications from ${allClassifications.length} chunks...`);
      
      // Start with the first classification's title
      let mergedTitle = allClassifications[0].title;
      
      // Create a Set to deduplicate subject IDs
      const uniqueSubjectIds = new Set<string>();
      
      // Add all subject IDs from all classifications
      for (const classification of allClassifications) {
        // Add all subject IDs to our unique set
        classification.subject_ids.forEach(id => uniqueSubjectIds.add(id));
        
        // Use the most complete title (usually the first chunk has the best summary)
        if (classification.title.length > mergedTitle.length) {
          mergedTitle = classification.title;
        }
      }
      
      // Create merged classification result
      classificationResult = {
        title: mergedTitle,
        subject_ids: Array.from(uniqueSubjectIds)
      };
      
      Logger.info(`Merged ${uniqueSubjectIds.size} unique subject classifications from ${allClassifications.length} chunks`);
    }
    
    // If we've exhausted all retries and still failed
    if (!classificationResult) {
      Logger.error(`Failed to classify document after all attempts`);
      return;
    }
    
    Logger.info(`Classification successful: "${classificationResult.title}"`);
    Logger.info(`Subject IDs: ${classificationResult.subject_ids.join(', ')}`);
    
    // 8. Store the classifications - first for the document
    let insertedCount = 0;
    for (const subjectId of classificationResult.subject_ids) {
      // Create a record in the table_classifications table
      const { error: insertError } = await supabase
        .from('table_classifications')
        .insert({
          id: uuidv4(),
          entity_id: expertDocument.id,
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
    
    // 9. Then also classify the source file in sources_google
    // This ensures we don't try to reclassify the same file multiple times
    for (const subjectId of classificationResult.subject_ids) {
      // Create a record in the table_classifications table
      const { error: insertSourceError } = await supabase
        .from('table_classifications')
        .insert({
          id: uuidv4(),
          entity_id: expertDocument.source_id,
          entity_type: 'sources_google',
          subject_classification_id: subjectId,
          notes: `Automatically classified with title: ${classificationResult.title} (from document ${expertDocument.id})`
        });
      
      if (insertSourceError) {
        Logger.error(`Error storing classification for source: ${insertSourceError.message}`);
      }
    }
    
    // 10. Log summary of inserted classifications
    if (insertedCount > 0) {
      Logger.info(`Added ${insertedCount} classifications for document: ${expertDocument.id}`);
      Logger.info(`Added ${classificationResult.subject_ids.length} classifications for source: ${expertDocument.source_id}`);
      Logger.info(`Classification title: "${classificationResult.title}"`);
    } else {
      Logger.info(`No classifications were added.`);
    }
    
  } catch (error) {
    Logger.error(`Error in classify-source command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}