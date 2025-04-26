/**
 * Subject Classification Command
 * 
 * Applies the subject-classification-prompt to expert documents with processed content
 * and categorizes them based on their content.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { promptService } from '../../../../packages/shared/services/prompt-service';
import { ClaudeService } from '../../../../packages/shared/services/claude-service';
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
}

interface SubjectClassificationResult {
  title: string;
  subject_ids: string[];
}

interface ExpertDocument {
  id: string;
  source_id: string;
  processed_content?: any;
  sources_google: {
    id: string;
    name: string;
    mime_type: string;
  } | {
    id: string;
    name: string;
    mime_type: string;
  }[];
}

/**
 * Classify subjects for expert documents with processed content
 */
export async function classifySubjectsCommand(options: ClassifySubjectsOptions): Promise<void> {
  const {
    limit = 10,
    fileExtensions,
    expertName,
    verbose = false,
    dryRun = false,
    skipClassified = false,
    entityType = 'expert_documents'
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
        const uniqueIds = [...new Set(classifiedIds)];
        Logger.info(`Found ${uniqueIds.length} already classified ${entityType} to skip.`);
        classifiedIds = uniqueIds;
      }
    }
    
    // Build the base query
    let query = supabase
      .from(entityType)
      .select('id, source_id, processed_content')
      .neq('processed_content', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    // Skip already classified documents if requested
    if (skipClassified && classifiedIds.length > 0) {
      query = query.not('id', 'in', `(${classifiedIds.join(',')})`);
    }
    
    // Execute the query
    const { data: expertDocs, error: docsError } = await query;
    
    if (docsError) {
      Logger.error(`Error fetching expert documents: ${docsError.message}`);
      return;
    }
    
    if (!expertDocs || expertDocs.length === 0) {
      Logger.info('No expert documents found with processed content.');
      return;
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
    
    // Process each document
    for (const doc of documents) {
      try {
        if (!doc.processed_content) {
          Logger.warn(`Document ${doc.id} has no processed content, skipping.`);
          continue;
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
        const system = promptResult.combinedContent;
        const userMessage = `Please classify the following content:\n\n${content}`;
        
        if (verbose) {
          Logger.info(`Content length: ${content.length} characters`);
        }
        
        // Skip actual classification in dry run mode
        if (dryRun) {
          Logger.info(`[DRY RUN] Would classify document: ${doc.id}`);
          Logger.info(`Document source: ${fileName}`);
          Logger.info(`MIME type: ${mimeType}`);
          continue;
        }
        
        // Classify the content using Claude
        Logger.info(`Sending content to Claude for classification...`);
        const claudeService = new ClaudeService();
        
        try {
          // We need to modify the prompt to include system instructions
          const combinedPrompt = `${system}\n\n${userMessage}`;
          
          // Use standard prompt method with JSON parse
          const response = await claudeService.sendPrompt(combinedPrompt);
          
          // Parse the JSON response, handling potential markdown formatting
          let jsonStr = response;
          
          // Check if the response is wrapped in markdown code blocks
          const jsonMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonStr = jsonMatch[1];
          }
          
          // Try to parse the JSON
          const classificationResult = JSON.parse(jsonStr) as SubjectClassificationResult;
          
          if (!classificationResult || !classificationResult.subject_ids) {
            Logger.error(`Failed to get valid classification result for document ${doc.id}`);
            continue;
          }
          
          Logger.info(`Classification successful: "${classificationResult.title}"`);
          Logger.info(`Subject IDs: ${classificationResult.subject_ids.join(', ')}`);
          
          // Store classifications in the database
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
              Logger.error(`Error storing classification: ${insertError.message}`);
            }
          }
          
          Logger.info(`Successfully stored classifications for document: ${doc.id}`);
        } catch (apiError) {
          Logger.error(`Error calling Claude API: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        }
      } catch (docError) {
        Logger.error(`Error processing document ${doc.id}: ${docError instanceof Error ? docError.message : 'Unknown error'}`);
      }
    }
    
    Logger.info('Subject classification completed successfully.');
    
  } catch (error) {
    Logger.error(`Error in subject classification command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}