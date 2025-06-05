// Classification response schema for validation

export interface ClassificationResponse {
  document_type_id: string;
  document_type_name: string;
  confidence: number;
  reasoning: string;
  keywords?: string[];
  summary?: string;
}

// Simple validation function since dhg-admin-google doesn't have zod
export const ClassificationResponseSchema = {
  parse: (data: any): ClassificationResponse => {
    // Validate required fields
    if (!data.document_type_id || typeof data.document_type_id !== 'string') {
      throw new Error('Invalid document_type_id');
    }
    
    if (!data.document_type_name || typeof data.document_type_name !== 'string') {
      throw new Error('Invalid document_type_name');
    }
    
    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
      throw new Error('Invalid confidence score');
    }
    
    if (!data.reasoning || typeof data.reasoning !== 'string') {
      throw new Error('Invalid reasoning');
    }
    
    // Return validated data
    return {
      document_type_id: data.document_type_id,
      document_type_name: data.document_type_name,
      confidence: data.confidence,
      reasoning: data.reasoning,
      keywords: Array.isArray(data.keywords) ? data.keywords : undefined,
      summary: typeof data.summary === 'string' ? data.summary : undefined
    };
  }
};

// Expert document status enum
export enum ExpertDocumentStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  PENDING = 'pending'
}

// Processing status enum
export enum ProcessingStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

// Document status enum
export enum DocumentStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}