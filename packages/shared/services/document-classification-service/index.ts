/**
 * Document Classification Service
 * 
 * A singleton service for classifying documents using Claude AI
 * Centralizes document classification logic used across the codebase
 */

import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../supabase-client';
import { claudeService } from '../claude-service/claude-service';
import { promptService } from '../prompt-service';

// Classification result interface
export interface DocumentClassificationResult {
  name: string; // Previously document_type
  document_type_id: string;
  classification_confidence: number; 
  classification_reasoning: string;
  document_summary: string;
  key_topics: string[];
  target_audience: string;
  unique_insights: string[];
}

/**
 * Document Classification Service singleton
 */
export class DocumentClassificationService {
  private static instance: DocumentClassificationService;
  private supabaseService: SupabaseClientService;

  // Default classification prompt
  private defaultPrompt = 'document-classification-prompt-new';
  
  // Document type ID for unknown documents
  private unknownDocTypeId = '9dbe32ff-5e82-4586-be63-1445e5bcc548';

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabaseService = SupabaseClientService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentClassificationService {
    if (!DocumentClassificationService.instance) {
      DocumentClassificationService.instance = new DocumentClassificationService();
    }
    return DocumentClassificationService.instance;
  }

  /**
   * Set the default classification prompt
   * @param promptName Name of the classification prompt to use
   */
  public setDefaultPrompt(promptName: string): void {
    this.defaultPrompt = promptName;
  }

  /**
   * Create a fallback classification when Claude API fails
   */
  public createFallbackClassification(file: {
    name?: string;
    mime_type?: string;
  }): DocumentClassificationResult {
    const fileName = file.name || 'Unknown Document';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeType = file.mime_type || '';
    
    // Determine document type based on file extension and name
    let documentTypeName = 'unknown document type';
    let documentTypeId = this.unknownDocTypeId;
    
    // Basic file type detection from extension and name patterns
    if (extension === 'docx' || extension === 'doc' || mimeType.includes('wordprocessingml')) {
      documentTypeName = 'word document';
      documentTypeId = 'bb90f01f-b6c4-4030-a3ea-db9dd8c4b55a';
    } else if (extension === 'txt' || mimeType === 'text/plain') {
      documentTypeName = 'text document';
      documentTypeId = '99db0af9-0e09-49a7-8405-899849b8a86c';
    } else if (extension === 'pdf' || mimeType === 'application/pdf') {
      documentTypeName = 'scientific pdf';
      documentTypeId = '8aa50d2a-6e35-45a0-896d-29d81f6d2c91';
    } else if (extension === 'ppt' || extension === 'pptx' || mimeType.includes('presentationml')) {
      documentTypeName = 'powerpoint presentation';
      documentTypeId = '0e0c4e20-1f33-42f9-83d0-11db7de35f8f';
    }
    
    // Check if it's a transcript based on filename patterns
    if (fileName.toLowerCase().includes('transcript')) {
      documentTypeName = 'presentation transcript';
      documentTypeId = 'c1a7b78b-c61e-44a4-8b77-a27a38cbba7e';
    }
    
    // Return a basic classification structure
    return {
      name: documentTypeName,
      document_type_id: documentTypeId,
      classification_confidence: 0.6, // Lower confidence for fallback
      classification_reasoning: `Fallback classification created automatically. Determined type based on filename "${fileName}" and type "${mimeType || extension}".`,
      document_summary: `This document could not be analyzed by AI. The classification is based on the file's metadata.`,
      key_topics: ['File analysis unavailable'],
      target_audience: 'Unknown (automatic classification)',
      unique_insights: [
        'Document was classified automatically based on filename and type'
      ]
    };
  }

  /**
   * Classify document content using Claude AI
   * @param content Text content of the document
   * @param fileName Optional file name for better results
   * @param promptName Optional custom prompt name (defaults to service default)
   * @param maxRetries Number of retries for Claude API calls
   */
  public async classifyDocument(
    content: string,
    fileName?: string,
    promptName?: string,
    maxRetries = 3
  ): Promise<DocumentClassificationResult | null> {
    try {
      // Use provided prompt or default prompt
      const actualPromptName = promptName || this.defaultPrompt;
      
      // Load the prompt
      const promptResult = await promptService.loadPrompt(actualPromptName);
      if (!promptResult.success) {
        console.error(`Failed to load prompt: ${actualPromptName}`);
        throw new Error(`Failed to load classification prompt ${actualPromptName}`);
      }
      
      // Create user message
      let userMessage = `Please classify the following document`;
      if (fileName) {
        userMessage += ` titled "${fileName}"`;
      }
      userMessage += `:\n\n${content}`;
      
      // Classification result
      let classificationResult: DocumentClassificationResult | null = null;
      let lastError: Error | null = null;
      
      // Try multiple times if needed
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Use prompt to classify document
          const claudeResponse = await promptService.usePromptWithClaude(
            actualPromptName,
            userMessage,
            { responseFormat: { type: "json" } }
          );
          
          // Parse the JSON result
          if (claudeResponse.success && claudeResponse.data) {
            let jsonStr = claudeResponse.data;
            
            // Try to parse the JSON response
            try {
              // Parse the JSON directly
              classificationResult = JSON.parse(jsonStr) as DocumentClassificationResult;
            } catch (jsonError) {
              // Try to clean the JSON if there was an error
              console.warn(`Error parsing JSON response: ${jsonError}. Attempting to clean JSON.`);
              
              // Clean the JSON string by removing anything before the first { and after the last }
              const firstBrace = jsonStr.indexOf('{');
              const lastBrace = jsonStr.lastIndexOf('}');
              
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const cleanedJsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                // Try parsing the cleaned JSON
                classificationResult = JSON.parse(cleanedJsonStr) as DocumentClassificationResult;
              } else {
                throw new Error(`Invalid JSON structure in Claude response`);
              }
            }
            
            // Validate the classification result
            if (!classificationResult || !classificationResult.name) {
              throw new Error(`Invalid classification result returned from Claude`);
            }
            
            // Successfully got classification, break the retry loop
            break;
          } else {
            throw new Error(`Claude response unsuccessful: ${claudeResponse.error || 'Unknown error'}`);
          }
        } catch (error) {
          // Record the last error for reporting if all attempts fail
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Log retry attempts
          if (attempt < maxRetries - 1) {
            console.warn(`Classification attempt ${attempt + 1} failed: ${lastError.message}. Retrying...`);
          }
        }
      }
      
      // If we couldn't get a valid classification after all retries, throw an error
      if (!classificationResult) {
        throw new Error(`Failed to classify document after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }
      
      return classificationResult;
    } catch (error) {
      console.error(`Error in classifyDocument: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Save document classification to the database
   * @param sourceId ID of the sources_google record
   * @param classification Classification result to save
   * @param expertDocumentId Optional expert_document ID (if it exists)
   * @param fileContent Raw file content (will be saved if provided)
   * @param dryRun If true, don't make actual database changes
   */
  public async saveClassification(
    sourceId: string,
    classification: DocumentClassificationResult,
    expertDocumentId?: string,
    fileContent?: string,
    dryRun = false
  ): Promise<boolean> {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would save classification for source ${sourceId} with type ${classification.name}`);
        return true;
      }
      
      const supabase = this.supabaseService.getClient();
      const now = new Date().toISOString();
      
      // 1. Update the document_type_id in sources_google
      const { error: sourceUpdateError } = await supabase
        .from('google_sources')
        .update({ document_type_id: classification.document_type_id })
        .eq('id', sourceId);
        
      if (sourceUpdateError) {
        console.error(`Error updating document type: ${sourceUpdateError.message}`);
        return false;
      }
      
      // 2. Update or insert expert_document
      if (expertDocumentId) {
        // Update existing expert document
        const { error: expertUpdateError } = await supabase
          .from('expert_documents')
          .update({
            document_type_id: classification.document_type_id,
            document_processing_status: 'processed',
            document_processing_status_updated_at: now,
            updated_at: now,
            raw_content: fileContent || undefined,
            metadata: {
              document_summary: classification.document_summary || "",
              key_topics: classification.key_topics || [],
              target_audience: classification.target_audience || "",
              unique_insights: classification.unique_insights || [],
              document_type: classification.name || "", // Using name instead of document_type
              classification_confidence: classification.classification_confidence || 0.75,
              classification_reasoning: classification.classification_reasoning || ""
            }
          })
          .eq('id', expertDocumentId);
          
        if (expertUpdateError) {
          console.error(`Error updating expert document: ${expertUpdateError.message}`);
          return false;
        }
      } else {
        // Create new expert document
        const newExpertDoc = {
          id: uuidv4(),
          source_id: sourceId,
          document_type_id: classification.document_type_id,
          document_processing_status: 'processed',
          document_processing_status_updated_at: now,
          source_type: 'google_drive',
          created_at: now,
          updated_at: now,
          raw_content: fileContent || undefined,
          classification_confidence: classification.classification_confidence || 0.75,
          metadata: {
            document_summary: classification.document_summary || "",
            key_topics: classification.key_topics || [],
            target_audience: classification.target_audience || "",
            unique_insights: classification.unique_insights || [],
            document_type: classification.name || "", // Using name instead of document_type
            classification_confidence: classification.classification_confidence || 0.75,
            classification_reasoning: classification.classification_reasoning || "",
            classification_metadata: classification,
          }
        };
        
        const { error: insertError } = await supabase
          .from('expert_documents')
          .insert(newExpertDoc);
          
        if (insertError) {
          console.error(`Error inserting expert document: ${insertError.message}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error in saveClassification: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

// Export singleton instance
export const documentClassificationService = DocumentClassificationService.getInstance();