/**
 * Document Type Service Types
 * 
 * Shared type definitions for document type services.
 */

/**
 * Document Type interface matching the database schema
 */
export interface DocumentType {
  id: string;
  name: string;  // Renamed from document_type to name
  category: string;
  description?: string | null;
  // file_extension?: string | null; // Not in database
  is_ai_generated?: boolean;
  // classifier?: 'pdf' | 'powerpoint' | 'docx' | 'expert' | null; // Not in database
  // Fields below are obsolete and no longer in the database schema
  // required_fields?: Record<string, any> | null;
  // validation_rules?: Record<string, any> | null;
  // ai_processing_rules?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  // New fields for hierarchical structure
  is_general_type?: boolean | null;
  prompt_id?: string | null;
  expected_json_schema?: Record<string, any> | null;
  mnemonic?: string | null;
}

/**
 * Interface for document type creation
 */
export interface CreateDocumentTypeParams {
  name: string;  // Renamed from document_type to name
  category: string;
  description?: string | null;
  // file_extension?: string | null; // Not in database
  is_ai_generated?: boolean;
  // classifier?: 'pdf' | 'powerpoint' | 'docx' | 'expert' | null; // Not in database
  // Fields below are obsolete and no longer in the database schema
  // required_fields?: Record<string, any> | null;
  // validation_rules?: Record<string, any> | null;
  // ai_processing_rules?: Record<string, any> | null;
  // New fields for hierarchical structure
  is_general_type?: boolean | null;
  prompt_id?: string | null;
  expected_json_schema?: Record<string, any> | null;
  mnemonic?: string | null;
}

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
 * Result of generating a document type
 */
export interface GenerateDocumentTypeResult {
  response: string;
  jsonData: DocumentTypeAIResponse | null;
  comments: string;
}

/**
 * Parameters for creating a document type from AI
 */
export interface CreateFromAIParams {
  aiResponse: DocumentTypeAIResponse;
  promptId?: string;
}