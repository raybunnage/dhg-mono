/**
 * Document Classifier
 * 
 * Handles document classification using the prompt service and Claude
 */

import { claudeService } from '@shared/services/claude-service';
import { promptService } from './prompt-service';
import { SupabaseClientService } from '../supabase-client';
import { Database } from '../../../../supabase/types';

type DocumentType = Database['public']['Tables']['document_types']['Row'];

export interface ClassificationRequest {
  title: string;
  content: string;
  filePath: string;
  documentTypes: DocumentType[];
}

export interface ClassificationResult {
  document_type_id: string;
  document_type: string;
  confidence: number;
  rationale: string;
}

export class DocumentClassifier {
  private static instance: DocumentClassifier;
  private supabase = SupabaseClientService.getInstance().getClient();

  private constructor() {}

  public static getInstance(): DocumentClassifier {
    if (!DocumentClassifier.instance) {
      DocumentClassifier.instance = new DocumentClassifier();
    }
    return DocumentClassifier.instance;
  }

  /**
   * Classify a document using the prompt service
   */
  public async classifyDocument(request: ClassificationRequest): Promise<ClassificationResult | null> {
    try {
      // Load the classification prompt
      const promptResult = await promptService.loadPrompt('document-classification-prompt', {
        includeDatabaseQueries: true
      });

      if (!promptResult.prompt) {
        console.error('Could not load document classification prompt');
        return null;
      }

      // Prepare the prompt with document data
      const classificationPrompt = this.buildClassificationPrompt(
        promptResult.prompt.content,
        request
      );

      // Get classification from Claude
      const result = await claudeService.getJsonResponse<ClassificationResult>(
        classificationPrompt,
        { temperature: 0.2 }
      );

      return result;
    } catch (error) {
      console.error('Error classifying document:', error);
      return null;
    }
  }

  /**
   * Build the classification prompt with document data
   */
  private buildClassificationPrompt(promptTemplate: string, request: ClassificationRequest): string {
    // Replace placeholders in the prompt
    let prompt = promptTemplate;

    // Add document information
    prompt = prompt.replace('{{DOCUMENT_TITLE}}', request.title);
    prompt = prompt.replace('{{DOCUMENT_PATH}}', request.filePath);
    prompt = prompt.replace('{{DOCUMENT_CONTENT}}', request.content);

    // Add document types
    const typesJson = JSON.stringify(
      request.documentTypes.map(dt => ({
        id: dt.id,
        name: dt.name,
        description: dt.description
      })),
      null,
      2
    );
    prompt = prompt.replace('{{DOCUMENT_TYPES}}', typesJson);

    return prompt;
  }

  /**
   * Classify multiple documents in batch
   */
  public async classifyBatch(
    documents: Array<{ filePath: string; title: string; content: string }>
  ): Promise<Map<string, ClassificationResult | null>> {
    const results = new Map<string, ClassificationResult | null>();

    // Get document types once
    const { data: documentTypes } = await this.supabase
      .from('document_types')
      .select('*')
      .eq('is_general_type', false);

    if (!documentTypes) {
      console.error('Could not fetch document types');
      return results;
    }

    // Process each document
    for (const doc of documents) {
      const result = await this.classifyDocument({
        ...doc,
        documentTypes
      });
      results.set(doc.filePath, result);
    }

    return results;
  }
}

// Export singleton instance
export const documentClassifier = DocumentClassifier.getInstance();