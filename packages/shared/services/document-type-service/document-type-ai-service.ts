/**
 * Document Type AI Service
 * 
 * Provides AI-powered document type generation capabilities.
 * Extracted from ClassifyDocument.tsx UI component.
 */
import { Logger } from '../../utils/logger';
import { DocumentType, documentTypeService } from './document-type-service';
import { claudeService } from '../claude-service/claude-service';
import { SupabaseClientService } from '../supabase-client';

/**
 * Interface for AI response content
 */
export interface DocumentTypeAIResponse {
  name: string; // Renamed from document_type to name
  category: string;
  description?: string;
  file_extension?: string | null;
  required_fields?: Record<string, string>;
  validation_rules?: Record<string, any>;
  ai_processing_rules?: Record<string, any>;
  is_general_type?: boolean;
  expected_json_schema?: Record<string, any>;
  [key: string]: any; // Allow for additional fields
}

/**
 * Interface for AI document type generation results
 */
export interface GenerateDocumentTypeResult {
  response: string;
  jsonData: DocumentTypeAIResponse | null;
  comments: string;
}

/**
 * Interface for document type creation from AI response
 */
export interface CreateFromAIParams {
  aiResponseJson: string;
  commentText?: string;
}

/**
 * Document Type AI Service Implementation
 */
export class DocumentTypeAIService {
  private static instance: DocumentTypeAIService;
  private supabaseService: SupabaseClientService;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabaseService = SupabaseClientService.getInstance();
    Logger.debug('DocumentTypeAIService initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentTypeAIService {
    if (!DocumentTypeAIService.instance) {
      DocumentTypeAIService.instance = new DocumentTypeAIService();
    }
    return DocumentTypeAIService.instance;
  }

  /**
   * Generate a document type definition using AI
   * @param requestPrompt User's description of the document type needed
   * @returns Object containing AI response, extracted JSON, and comments
   */
  public async generateDocumentType(requestPrompt: string): Promise<GenerateDocumentTypeResult> {
    try {
      Logger.debug('Generating document type with AI');
      const supabase = this.supabaseService.getClient();
      
      // First, check if we have a database prompt template
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompts')
        .select('*')
        .eq('name', 'document-type-request-template')
        .eq('status', 'active');
      
      if (promptsError) {
        Logger.error(`Error fetching prompt template: ${promptsError.message}`);
        throw new Error('Failed to load document type request template');
      }
      
      // Get existing document types to provide context to the AI
      const documentTypes = await documentTypeService.getAllDocumentTypes();
      
      // Use the database template if available, otherwise use the hardcoded one
      let systemPrompt = '';
      let userMessage = '';
      
      if (promptsData && promptsData.length > 0) {
        Logger.debug(`Using database prompt template: ${promptsData[0].name}`);
        // Parse the content from JSON string if needed
        const promptContent = typeof promptsData[0].content === 'string' 
          ? JSON.parse(promptsData[0].content) 
          : promptsData[0].content;
          
        systemPrompt = promptContent;
        userMessage = `Please create a document type definition based on this request:\n\n${requestPrompt}\n\nInclude realistic validation rules and AI processing rules that would be appropriate for this document type. Use existing document types for reference but do not duplicate them.`;
      } else {
        Logger.debug('Using hardcoded prompt template (no database template found)');
        // Use the original hardcoded template
        systemPrompt = `You are an expert system designer who creates document type schemas for a content management system. 
        You will receive a request from a user who needs a new document type defined. 
        Your job is to analyze the request and create a structured document type definition based on the request.
        
        First, provide a brief analysis of the request in plain text, including what you understand about:
        1. The purpose of this document type
        2. The key fields that will be needed
        3. Any special processing requirements
        
        Then, create a JSON object that defines the document type with all required fields. The schema must follow this structure:
        
        {
          "name": string, // A concise name for this document type
          "category": string, // One of these categories: "Academic", "Documentation", "Media", "Correspondence", "Transcripts", "Analysis", "Scripts", "Other"
          "description": string, // Detailed description of what this document type represents
          "file_extension": string | null, // Preferred file extension, or null if not specific
          "is_ai_generated": boolean, // Whether this document type was created via AI (true for this case)
          "is_general_type": boolean, // Whether this is a general category type (true) or specific subtype (false)
          "required_fields": {
            // Define fields that must be present in this document type
            "field_name": "field_type", // Types can be: string, number, boolean, date, array
            // Add as many fields as needed
          },
          "validation_rules": {
            // Optional validation rules for fields
            "field_name": { 
              "required": boolean,
              "minLength": number, // for strings
              "maxLength": number, // for strings
              "min": number, // for numbers
              "max": number, // for numbers
              // Add other validation rules as needed
            }
          },
          "ai_processing_rules": {
            // Rules for AI processing of this document type
            "extractFields": [string], // List of fields to extract
            "confidenceThreshold": number, // Minimum confidence score (0-1)
            // Add other processing rules as needed
          },
          "expected_json_schema": {
            // Optional JSON schema that defines the expected structure for content of this type
            "type": "object",
            "properties": {
              // Define properties as needed
            }
          }
        }
        
        Be creative but practical in your design. Include all fields that would be necessary for this document type.`;
        userMessage = `Please create a document type definition based on this request:\n\n${requestPrompt}\n\nInclude realistic validation rules and AI processing rules that would be appropriate for this document type. Use existing document types for reference but do not duplicate them.`;
      }

      // Use the shared Claude service
      const result = await claudeService.sendPrompt(userMessage, {
        system: systemPrompt,
        temperature: 0,
        maxTokens: 4000
      });
      
      // Parse the response to separate comments from JSON
      const response = result.trim();
      let jsonData: DocumentTypeAIResponse | null = null;
      let comments = '';
      
      try {
        // Try to find JSON in code blocks first
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                          response.match(/```\n([\s\S]*?)\n```/) || 
                          response.match(/({[\s\S]*})/);
        
        if (jsonMatch && jsonMatch[1]) {
          // We found JSON in code blocks
          const jsonStr = jsonMatch[1].trim();
          // Validate it parses correctly
          jsonData = JSON.parse(jsonStr);
          
          // Get the comments (everything before the JSON)
          const jsonIndex = response.indexOf(jsonMatch[0]);
          comments = response.substring(0, jsonIndex).trim();
        } else {
          // Attempt to find JSON object in the text
          const lastBraceIndex = response.lastIndexOf('}');
          const firstBraceIndex = response.indexOf('{');
          
          if (firstBraceIndex !== -1 && lastBraceIndex !== -1) {
            const jsonPart = response.substring(firstBraceIndex, lastBraceIndex + 1);
            try {
              // Validate it parses correctly
              jsonData = JSON.parse(jsonPart);
              comments = response.substring(0, firstBraceIndex).trim();
            } catch (parseError) {
              // If we can't parse JSON, treat it all as comments
              comments = response;
              Logger.warn('Could not extract valid JSON from AI response');
            }
          } else {
            // No JSON found, treat it all as comments
            comments = response;
            Logger.warn('Could not extract valid JSON from AI response');
          }
        }
      } catch (error) {
        Logger.error(`Error parsing AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
        comments = response;
      }

      Logger.debug('Successfully generated document type with AI');
      return {
        response,
        jsonData,
        comments
      };
    } catch (error) {
      Logger.error(`Exception in generateDocumentType: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create a document type from an AI-generated JSON response
   * @param params Object containing the AI-generated JSON and optional comment text
   * @returns The newly created document type
   */
  public async createFromAIResponse(params: CreateFromAIParams): Promise<DocumentType> {
    try {
      Logger.debug('Creating document type from AI response');
      
      // Validate the JSON
      if (!params.aiResponseJson.trim()) {
        throw new Error('No document type definition available');
      }
      
      let docTypeData: DocumentTypeAIResponse;
      // Try to parse the JSON
      try {
        docTypeData = JSON.parse(params.aiResponseJson);
      } catch (parseError) {
        Logger.error(`JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        throw new Error('Invalid JSON format. Please check the document type definition.');
      }
      
      // Validate required fields
      if (!docTypeData.name || !docTypeData.category) {
        throw new Error('Document type name and category are required');
      }

      // Create new document type using the service
      const newDocumentType = await documentTypeService.createDocumentType({
        name: docTypeData.name,
        description: docTypeData.description || null,
        category: docTypeData.category,
        // file_extension: docTypeData.file_extension || null, // Not in database
        is_ai_generated: true,
        // Removed obsolete fields:
        // required_fields: docTypeData.required_fields || null,
        // validation_rules: docTypeData.validation_rules || null,
        // ai_processing_rules: docTypeData.ai_processing_rules || null,
        is_general_type: docTypeData.is_general_type || false,
        expected_json_schema: docTypeData.expected_json_schema || null
      });
      
      Logger.debug(`Successfully created AI-generated document type: ${docTypeData.name}`);
      return newDocumentType;
    } catch (error) {
      Logger.error(`Exception in createFromAIResponse: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}

// Export singleton instance
export const documentTypeAIService = DocumentTypeAIService.getInstance();